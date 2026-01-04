# 文档管理功能实现计划

## 需求概述
在右侧面板中添加文档管理功能，支持与资产、房间、资产规格关联的文档上传、编辑、删除。

## 功能位置
1. **元素标签** - "关系"栏下方
   - 关联对象：资产（assets）或房间（spaces）
2. **类型标签** - "设计属性"栏下方
   - 关联对象：资产规格（asset_specs）

## 数据库设计

### documents 表
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50),
  mime_type VARCHAR(100),
  
  -- 关联字段（三选一）
  asset_code VARCHAR(100),
  space_code VARCHAR(100),
  spec_code VARCHAR(100),
  
  -- 外键约束
  CONSTRAINT fk_asset FOREIGN KEY (asset_code) REFERENCES assets(mc_code) ON DELETE CASCADE,
  CONSTRAINT fk_space FOREIGN KEY (space_code) REFERENCES spaces(space_code) ON DELETE CASCADE,
  CONSTRAINT fk_spec FOREIGN KEY (spec_code) REFERENCES asset_specs(spec_code) ON DELETE CASCADE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 确保关联唯一性
  CONSTRAINT chk_single_relation CHECK (
    (asset_code IS NOT NULL AND space_code IS NULL AND spec_code IS NULL) OR
    (asset_code IS NULL AND space_code IS NOT NULL AND spec_code IS NULL) OR
    (asset_code IS NULL AND space_code IS NULL AND spec_code IS NOT NULL)
  )
);

CREATE INDEX idx_documents_asset ON documents(asset_code);
CREATE INDEX idx_documents_space ON documents(space_code);
CREATE INDEX idx_documents_spec ON documents(spec_code);
```

## 后端 API

### 路由设计
- `POST /api/documents/upload` - 上传文档
- `GET /api/documents?asset_code=xxx` - 获取资产文档列表
- `GET /api/documents?space_code=xxx` - 获取空间文档列表
- `GET /api/documents?spec_code=xxx` - 获取规格文档列表
- `PUT /api/documents/:id` - 更新文档标题
- `DELETE /api/documents/:id` - 删除文档
- `GET /api/documents/:id/download` - 下载文档

### 文件存储
- 路径：`public/documents/`
- 命名：`{timestamp}_{random}_{original_name}`

## 前端实现

### 1. 新组件：DocumentList.vue
- 显示文档列表
- 上传按钮
- 编辑标题
- 删除文档
- 文件图标（根据类型）
- 下载链接

### 2. 集成到 RightPanel.vue
- 在ELEMENT tab的"关系"下方
- 在TYPE tab的"设计属性"下方
- 根据当前选中对象传递关联参数

### 3. 国际化文本
```javascript
document: {
  title: '文档',
  upload: '上传文档',
  edit: '编辑标题',
  delete: '删除',
  download: '下载',
  noDocuments: '暂无文档',
  uploadSuccess: '上传成功',
  deleteConfirm: '确定删除此文档吗？',
  supportedFormats: '支持格式：PDF, JPG, PNG, MP4'
}
```

## 支持的文件类型
- PDF - `.pdf`
- 图片 - `.jpg`, `.jpeg`, `.png`
- 视频 - `.mp4`
- MIME types:
  - `application/pdf`
  - `image/jpeg`, `image/png`
  - `video/mp4`

## 实现顺序
1. ✅ 创建实现计划文档
2. 创建数据库schema
3. 实现后端API
4. 创建DocumentList组件
5. 集成到RightPanel
6. 添加国际化文本
7. 测试功能
