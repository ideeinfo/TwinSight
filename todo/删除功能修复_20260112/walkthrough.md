# 删除功能修复 - 演示

我已修复了删除确认框按钮缺失中文翻译的问题，并实现了文件夹的递归删除功能。

## 更改内容

### 前端修复
`src/components/DocumentManager.vue`

1.  **按钮汉化**: 为所有删除操作（文件、批量、文件夹）的 `ElMessageBox.confirm` 添加了配置对象：
    ```javascript
    {
      confirmButtonText: t('common.confirm'), // "确认"
      cancelButtonText: t('common.cancel'),   // "取消"
      type: 'warning'
    }
    ```
2.  **文案更新**: 更新了删除文件夹的提示信息，明确告知将删除包含的所有内容。

### 后端修复
`server/routes/v2/documents.js`

1.  **递归删除**: 修改了 `DELETE /folders/:id` 接口。
    - 不再限制非空文件夹。
    - 自动查找并删除文件夹下的所有子文件夹和文档（包括物理文件和数据库记录）。

## 验证结果

### 功能演示
1.  **删除确认框**: 点击删除时，弹窗中的按钮现在显示为中文的“确认”和“取消”。
2.  **删除文件夹**: 即使文件夹内有文件或子文件夹，现在也可以成功删除，并且会清理所有相关数据。
