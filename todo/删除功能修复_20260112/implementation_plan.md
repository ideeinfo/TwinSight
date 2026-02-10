# fix: 修复删除确认框按钮翻译 & 实现文件夹递归删除

用户反馈了两个问题：
1.  删除确认框按钮缺少中文翻译。
2.  无法删除非空文件夹（只能删除文档）。

## 用户审查 (User Review Required)
> [!WARNING]
> 将更改文件夹删除逻辑为**递归删除**。删除文件夹时，将同时删除该文件夹下的**所有子文件夹和所有文档**（包括物理文件）。此操作不可恢复。

## 拟议更改 (Proposed Changes)

### [components]

#### [MODIFY] [DocumentManager.vue](file:///d:/TwinSIght/antigravity/twinsight/src/components/DocumentManager.vue)
- 在 `handleDelete`, `handleBatchDelete`, `handleDeleteFolder` 中调用 `ElMessageBox.confirm` 时，配置 `confirmButtonText: t('common.confirm')` 和 `cancelButtonText: t('common.cancel')`。
- 更新 `handleDeleteFolder` 的提示信息，明确告知用户将删除文件夹内的所有内容。

### [server/routes/v2]

#### [MODIFY] [documents.js](file:///d:/TwinSIght/antigravity/twinsight/server/routes/v2/documents.js)
- 修改 `DELETE /folders/:id` 接口：
  - 移除 "文件夹不为空" 的检查。
  - 实现递归查找：找到该文件夹及其所有子文件夹下的所有文档。
  - 遍历并删除这些文档的物理文件。
  - 执行数据库删除（依赖外键级联删除或手动递归删除记录）。
  - *注：假设数据库表 `documents` 对 `folder_id` 有 `ON DELETE CASCADE`，或者需要手动删除。为了安全起见，逻辑中将先查询文件路径进行删除，然后删除 DB 记录。*

## 验证计划 (Verification Plan)

### 手动验证 (Manual Verification)
1.  **UI 文本验证**：
    - 触发删除操作，确认按钮显示中文 "确认" 和 "取消"。
2.  **文件夹删除验证**：
    - 创建一个包含文档和子文件夹（子文件夹中也有文档）的测试文件夹。
    - 尝试删除该顶层文件夹。
    - 确认操作成功（不再报错 "文件夹不为空"）。
    - 确认数据库中相关记录已被删除。
    - 确认具体物理文件已被删除。
