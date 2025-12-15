# 文档管理功能 - 集成到RightPanel

## 快速集成步骤

### 1. 在RightPanel.vue中导入DocumentList组件

```vue
<script setup>
import DocumentList from './DocumentList.vue';
// ... 其他imports
</script>
```

### 2. 在ELEMENT标签的"关系"栏下方添加文档栏

找到ELEMENT tab的"关系"部分（大约在第35-55行），在其下方添加：

```vue
<!-- 文档 - 在"关系"下方 -->
<DocumentList 
  :assetCode="localProperties.code" 
  :spaceCode="localProperties.code"
  v-if="!isMultipleSelected"
/>
```

### 3. 在TYPE标签的"设计属性"栏下方添加文档栏

找到TYPE tab的"设计属性"部分（大约在第70-85行），在其下方添加：

```vue
<!-- 文档 - 在"设计属性"下方 -->
<DocumentList 
  :specCode="localProperties.typeComments || localProperties.specCode"
  v-if="!isMultipleSelected"
/>
```

## 注意事项

1. **关联逻辑**
   - ELEMENT tab: 根据当前模式使用 `assetCode` 或 `spaceCode`
   - TYPE tab: 使用 `specCode`（从typeComments或specCode获取）

2. **多选时隐藏**
   - `v-if="!isMultipleSelected"` 确保多选时不显示文档栏

3. **数据库准备**
   - 需要先执行 `server/db/create_documents_table.sql` 创建表

## 已完成功能

✅ 后端API（上传、列表、编辑、删除、下载）  
✅ DocumentList组件（前端UI）  
✅ 国际化文本（中英文）  
✅ 文件类型验证（PDF, JPG, PNG, MP4）  
✅ 文件大小限制（50MB）  
✅ 自动关联到assets/spaces/specs  

## 待测试

- 上传不同类型的文件
- 编辑文档标题
- 删除文档
- 下载文档
- 切换选择对象时文档列表更新
