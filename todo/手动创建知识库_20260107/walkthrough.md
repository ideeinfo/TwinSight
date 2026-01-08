# 手动同步知识库文档功能 - 实现记录

## 功能背景

用户要求添加"同步知识库"功能，允许手动同步模型相关文档到Open WebUI知识库，而不是在创建知识库时自动同步。

**优势**：
- 用户可控制何时同步
- 增量同步，只同步未同步的文档
- 不影响知识库创建流程
- 支持错误恢复

## 实现细节

### 1. 后端API - `server/routes/files.js`

**端点**: `POST /api/files/:id/sync-docs`

**关键代码**: [files.js#L687-L760](file:///d:/TwinSIght/antigravity/twinsight/server/routes/files.js#L687-L760)

#### SQL查询逻辑

```sql
-- 查询模型相关的未同步文档
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
```

**说明**：
- 通过`assets`、`spaces`、`asset_specs`表关联查询模型相关文档
- 使用`LEFT JOIN kb_documents`过滤已同步文档
- 条件：`kd.id IS NULL`（从未同步）或`kd.sync_status != 'synced'`（同步失败）

#### 主要逻辑流程

```javascript
// 1. 检查知识库是否存在
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

// 2. 查询未同步文档
const docsResult = await getDbPool().query(`...`, [file.id, kb.id]);
const documents = docsResult.rows;

// 3. 如果没有待同步文档
if (documents.length === 0) {
    return res.json({
        success: true,
        data: { total: 0, synced: 0, failed: 0, skipped: 0 },
        message: '没有需要同步的文档'
    });
}

// 4. 调用同步函数
const { syncDocumentsToKB } = await import('../services/openwebui-service.js');
const syncResult = await syncDocumentsToKB(kb.id, documents);

// 5. 返回统计结果
res.json({
    success: true,
    data: {
        total: documents.length,
        synced: syncResult.success,
        failed: syncResult.failed,
        skipped: 0
    },
    message: `成功同步 ${syncResult.success} 个文档...`
});
```

### 2. 前端UI - `src/components/FilePanel.vue`

#### 上下文菜单项

**位置**: [FilePanel.vue#L168-L176](file:///d:/TwinSIght/antigravity/twinsight/src/components/FilePanel.vue#L168-L176)

```vue
<div v-if="authStore.hasPermission('model:upload')" class="context-menu-item" @click="handleSyncDocs">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
  {{ t('filePanel.syncKB') }}
</div>
```

#### 处理函数

**位置**: [FilePanel.vue#L766-L794](file:///d:/TwinSIght/antigravity/twinsight/src/components/FilePanel.vue#L766-L794)

```javascript
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
      await showAlert(data.error || t('filePanel.syncKBFailed'));
      return;
    }

    if (data.success) {
      await showAlert(data.message);
      await loadFiles();
    }
  } catch (error) {
    console.error('同步文档错误:', error);
    await showAlert(t('filePanel.syncKBFailed') + ': ' + error.message);
  }
};
```

### 3. 国际化配置 - `src/i18n/index.js`

**中文**:
- `syncKB`: "同步知识库"
- `syncKBFailed`: "同步失败"

**English**:
- `syncKB`: "Sync Knowledge Base"
- `syncKBFailed`: "Sync failed"

## 代码提交

```bash
git add server/routes/files.js src/components/FilePanel.vue src/i18n/index.js
git commit -m "feat: 添加手动同步知识库文档功能

- 新增POST /api/files/:id/sync-docs端点
- 查询模型相关的未同步文档（通过assets/spaces/specs关联）
- 只同步kb_documents表中不存在或status!=synced的文档
- 前端添加同步知识库菜单项
- 添加中英文国际化文本
- 返回详细的同步统计信息"
```

**Commit ID**: `b763674`

## 测试指导

### 测试场景1：正常同步

1. 创建知识库
2. 在某个视图上传文档
3. 确保文档关联到该模型的assets/spaces/specs
4. 右键模型文件，点击"同步知识库"
5. **预期结果**:
   - 显示："成功同步 X 个文档"
   - 文档出现在Open WebUI知识库中
   - 后端日志显示同步进度

### 测试场景2：未创建知识库

1. 选择一个没有知识库的模型
2. 右键点击"同步知识库"
3. **预期结果**:
   - 显示："该模型尚未创建知识库，请先创建知识库"

### 测试场景3：没有待同步文档

1. 已创建知识库并同步过文档
2. 再次点击"同步知识库"
3. **预期结果**:
   - 显示："没有需要同步的文档"

### 测试场景4：增量同步

1. 第一次同步3个文档
2. 再上传2个新文档
3. 再次点击"同步知识库"
4. **预期结果**:
   - 只同步新增的2个文档
   - 显示："成功同步 2 个文档"

### 测试场景5：错误恢复

1. 第一次同步时部分文档失败
2. 修复问题后再次同步
3. **预期结果**:
   - 重新同步之前失败的文档

## 后端日志示例

```
📝 开始同步模型 5 的文档到知识库 abc-123...
📄 找到 3 个待同步文档
📦 批量同步 3 个文档到知识库 abc-123
✅ 同步完成: 成功 3, 失败 0
```

## 特性优势

1. **增量同步**: 只同步未同步的文档，避免重复
2. **用户可控**: 用户决定何时同步，不会自动执行
3. **错误恢复**: 失败的文档可以重新同步
4. **详细反馈**: 返回total/synced/failed统计信息
5. **权限保护**: 需要`model:upload`权限
6. **独立功能**: 不影响现有的创建知识库流程

## 验证清单

- [x] 后端API端点POST /api/files/:id/sync-docs
- [x] SQL查询正确关联assets/spaces/specs
- [x] 过滤已同步文档（kb_documents表）
- [x] 调用syncDocumentsToKB函数
- [x] 返回详细统计信息
- [x] 前端菜单项"同步知识库"
- [x] 处理函数handleSyncDocs
- [x] 中英文国际化
- [x] 错误处理（无知识库、网络错误）
