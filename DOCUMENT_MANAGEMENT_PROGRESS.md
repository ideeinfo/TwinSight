# 文档管理功能实现进度

## ✅ 已完成

### 1. 数据库层
- ✅ 创建documents表SQL脚本 (`server/db/create_documents_table.sql`)
  - 支持与assets, spaces, specs三种对象关联
  - 添加级联删除约束
  - 创建性能索引

### 2. 后端数据模型
- ✅ 创建document.js模型 (`server/models/document.js`)
  - getDocuments() - 获取文档列表
  - getDocumentById() - 获取单个文档
  - createDocument() - 创建文档记录
  - updateDocumentTitle() - 更新标题
  - deleteDocument() - 删除文档
  - getDocumentStats() - 统计信息

### 3. 后端API路由
- ✅ 创建documents.js路由 (`server/routes/documents.js`)
  - POST /api/documents/upload - 文件上传
  - GET /api/documents - 获取列表
  - GET /api/documents/:id - 获取详情
  - PUT /api/documents/:id - 更新标题
  - DELETE /api/documents/:id - 删除文档
  - GET /api/documents/:id/download - 下载文档
  
- ✅ 集成到server/index.js
  - 注册/api/documents路由
  - 添加/documents静态文件服务

- ✅ 安装multer依赖 (`npm install multer`)

### 4. 文件上传配置
- ✅ 存储位置：`public/documents/`
- ✅ 文件命名：`{timestamp}_{random}_{filename}`
- ✅ 文件类型限制：PDF, JPG, PNG, MP4
- ✅ 文件大小限制：50MB
- ✅ MIME类型验证

## 🚧 待实现

### 5. 前端组件
- ⏳ DocumentList.vue组件
  - 文档列表显示
  - 文件图标
  - 上传按钮
  - 编辑标题功能
  - 删除确认
  - 下载链接

### 6. 集成到RightPanel
- ⏳ 在ELEMENT tab添加"文档"栏
- ⏳ 在TYPE tab添加"文档"栏
- ⏳ 传递关联参数（assetCode/spaceCode/specCode）

### 7. 国际化
- ⏳ 添加中英文翻译
- ⏳ document.* 文本键

### 8. 测试
- ⏳ 上传功能测试
- ⏳ 编辑标题测试
- ⏳ 删除功能测试
- ⏳ 下载功能测试
- ⏳ 关联关系测试

## 📋 下一步
创建DocumentList.vue前端组件
