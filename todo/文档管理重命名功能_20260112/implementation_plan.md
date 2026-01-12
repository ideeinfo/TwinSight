# 文档管理 - 启用重命名功能

在文档管理模块的文档列表和网格视图中，为文件和文件夹添加“重命名”上下文菜单选项。后端已通过 `PATCH` 接口支持此功能，因此只需进行前端修改。

## 拟议更改 (Proposed Changes)

### [components]

#### [MODIFY] [DocumentManager.vue](file:///d:/TwinSIght/antigravity/twinsight/src/components/DocumentManager.vue)
- **更新菜单**：
  - 在列表视图 (`el-table`) 的下拉菜单中，为文件夹和文件添加“重命名”选项。
  - 在网格视图 (`grid-view`) 的下拉菜单中，添加“重命名”选项。
  - 添加 `Edit` 图标的使用 (`@element-plus/icons-vue`)。
- **添加状态和对话框**：
  - 添加 `isRenameDialogOpen` (boolean) 和 `renameForm` ({ id, name, type }) 响应式变量。
  - 添加一个新的 `el-dialog` 用于重命名输入。
- **添加逻辑**：
  - 在 `handleCommand` 中处理 `rename` 命令。
  - 实现 `openRenameDialog(item)` 函数，用于初始化表单并打开对话框。
  - 实现 `confirmRename()` 函数：
    - 根据 `renameForm.type` ('folder' 或 'file') 调用相应的 API。
    - API 路径：
      - 文档: `PATCH /api/v2/documents/:id` (body: `{ title: newName }`)
      - 文件夹: `PATCH /api/v2/documents/folders/:id` (body: `{ name: newName }`)
    - 成功后刷新列表并关闭对话框。

## 验证计划 (Verification Plan)

### 手动验证 (Manual Verification)
1.  **重命名文件**：
    - 在列表或网格视图中选择一个文件。
    - 点击更多菜单 (...)，选择“重命名”。
    - 输入新名称并确认。
    - 验证文件名称已更新，且列表已刷新。
2.  **重命名文件夹**：
    - 对文件夹执行相同操作。
    - 验证文件夹名称已在左侧树和右侧列表中更新。
