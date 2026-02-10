# 手动同步知识库文档功能 - 实现计划

## 目标

在模型文件上下文菜单中添加"同步知识库"功能，允许用户手动同步该模型相关的文档到Open WebUI知识库。

## 功能设计

### 1. 后端API设计

**端点**: `POST /api/files/:id/sync-docs`

**功能**:
1. 检查模型是否已有知识库
2. 查询该模型相关的所有文档（通过assets/spaces/specs表关联）
3. 过滤出未同步的文档（kb_documents表中没有记录或sync_status不为'synced'）
4. 调用`syncDocumentsToKB`批量同步
5. 返回同步结果统计

**SQL查询逻辑**:
```sql
-- 查询模型相关的未同步文档
SELECT DISTINCT d.id, d.title, d.file_path as path, d.file_type
FROM documents d
LEFT JOIN assets a ON d.asset_code = a.asset_code AND a.file_id = $1
LEFT JOIN spaces s ON d.space_code = s.space_code AND s.file_id = $1
LEFT JOIN asset_specs sp ON d.spec_code = sp.spec_code AND sp.file_id = $1
LEFT JOIN kb_documents kd ON kd.document_id = d.id AND kd.kb_id = (
    SELECT id FROM knowledge_bases WHERE file_id = $1
)
WHERE (a.file_id = $1 OR s.file_id = $1 OR sp.file_id = $1)
  AND d.file_path IS NOT NULL
  AND (kd.id IS NULL OR kd.sync_status != 'synced')
ORDER BY d.created_at DESC
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "total": 10,
    "synced": 8,
    "failed": 2,
    "skipped": 0
  },
  "message": "成功同步 8 个文档，2 个失败"
}
```

### 2. 前端UI设计

**位置**: `src/components/FilePanel.vue`

**菜单项**:
- 文本：`{{ t('filePanel.syncKB') }}`（"同步知识库"）
- 图标：同步/刷新图标
- 权限：`model:upload`
- 位置：在"创建知识库"菜单项后

**交互流程**:
1. 用户点击"同步知识库"
2. 检查是否已有知识库
   - 无知识库：提示"请先创建知识库"
   - 有知识库：执行同步
3. 显示加载状态
4. 同步完成后显示结果提示

---

## 实现步骤

### 阶段1: 后端实现

#### 文件: `server/routes/files.js`

添加新端点:

```javascript
/**
 * 手动同步文档到知识库
 * POST /api/files/:id/sync-docs
 */
router.post('/:id/sync-docs', authenticate, authorize(PERMISSIONS.MODEL_UPLOAD), async (req, res) => {
    try {
        const file = await modelFileModel.getModelFileById(req.params.id);
        if (!file) {
           return res.status(404).json({ success: false, error: '文件不存在' });
        }

        // 检查是否已有知识库
        const kbResult = await getDbPool().query(
            'SELECT id, openwebui_kb_id FROM knowledge_bases WHERE file_id = $1',
            [file.id]
        );

        if (kbResult.rows.length === 0 || !kbResult.rows[0].openwebui_kb_id) {
            return res.status(400).json({
                success: false,
                error: '该模型尚未创建知识库，请先创建知识库'
            });
        }

        const kb = kbResult.rows[0];
        console.log(`📝 开始同步模型 ${file.id} 的文档到知识库 ${kb.openwebui_kb_id}...`);

        // 查询未同步的文档
        const docsResult = await getDbPool().query(`
            SELECT DISTINCT d.id, d.title, d.file_path as path, d.file_type
            FROM documents d
            LEFT JOIN assets a ON d.asset_code = a.asset_code AND a.file_id = $1
            LEFT JOIN spaces s ON d.space_code = s.space_code AND s.file_id = $1
            LEFT JOIN asset_specs sp ON d.spec_code = sp.spec_code AND sp.file_id = $1
            LEFT JOIN kb_documents kd ON kd.document_id = d.id AND kd.kb_id = $2
            WHERE (a.file_id = $1 OR s.file_id = $1 OR sp.file_id = $1)
              AND d.file_path IS NOT NULL
              AND (kd.id IS NULL OR kd.sync_status != 'synced')
            ORDER BY d.created_at DESC
        `, [file.id, kb.id]);

        const documents = docsResult.rows;
        console.log(`📄 找到 ${documents.length} 个待同步文档`);

        if (documents.length === 0) {
            return res.json({
                success: true,
                data: { total: 0, synced: 0, failed: 0, skipped: 0 },
                message: '没有需要同步的文档'
            });
        }

        // 调用同步函数
        const { syncDocumentsToKB } = await import('../services/openwebui-service.js');
        const syncResult = await syncDocumentsToKB(kb.id, documents);

        console.log(`✅ 同步完成: 成功 ${syncResult.success}, 失败 ${syncResult.failed}`);

        res.json({
            success: true,
            data: {
                total: documents.length,
                synced: syncResult.success,
                failed: syncResult.failed,
                skipped: 0
            },
            message: `成功同步 ${syncResult.success} 个文档${syncResult.failed > 0 ? `，${syncResult.failed} 个失败` : ''}`
        });

    } catch (error) {
        console.error('同步文档失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
```

### 阶段2: 前端实现

#### 文件: `src/components/FilePanel.vue`

**1. 添加菜单项** (模板部分):

```vue
<!-- 在"创建知识库"菜单项后添加 -->
<div v-if="authStore.hasPermission('model:upload')" class="context-menu-item" @click="handleSyncDocs">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
  {{ t('filePanel.syncKB') }}
</div>
```

**2. 添加处理函数** (script部分):

```javascript
// 同步文档到知识库
const handleSyncDocs = async () => {
  const file = contextMenu.value.file;
  hideContextMenu();

  try {
    const response = await fetch(`${API_BASE}/api/files/${file.id}/sync-docs`, {
      method: 'POST',
      headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 400) {
        await showAlert(data.error);
      } else {
        await showAlert('同步失败: ' + data.error);
      }
      return;
    }

    if (data.success) {
      await showAlert(data.message);
      await loadFiles();
    }
  } catch (error) {
    console.error('同步文档错误:', error);
    await showAlert('同步文档失败: ' + error.message);
  }
};
```

### 阶段3: 国际化

#### 文件: `src/i18n/index.js`

```javascript
// 中文
filePanel: {
  // ... 其他翻译
  syncKB: '同步知识库',
  syncKBSuccess: '文档同步成功',
  syncKBFailed: '文档同步失败',
  noKBToSync: '请先创建知识库'
}

// English
filePanel: {
  // ... other translations
  syncKB: 'Sync Knowledge Base',
  syncKBSuccess: 'Documents synced successfully',
  syncKBFailed: 'Failed to sync documents',
  noKBToSync: 'Please create knowledge base first'
}
```

---

## 测试计划

### 1. 正常同步流程
- 创建知识库
- 上传文档到模型相关的assets/spaces
- 点击"同步知识库"
- 验证文档出现在Open WebUI中

### 2. 边缘情况
- 未创建知识库时点击同步 → 显示提示
- 没有待同步文档 → 显示"没有需要同步的文档"
- 文档已全部同步 → 显示"没有需要同步的文档"

### 3. 错误处理
- Open WebUI不可用 → 显示错误提示
- 文档文件不存在 → 记录失败但不阻塞其他文档

---

## 优势

1. **用户控制**: 用户可以选择何时同步，不会在创建知识库时自动执行
2. **增量同步**: 只同步未同步的文档，避免重复
3. **独立功能**: 不影响现有的创建知识库流程
4. **错误恢复**: 如果部分文档同步失败，可以重新执行同步
