# API参考

<cite>
**本文档中引用的文件**   
- [ai.js](file://server/routes/v1/ai.js)
- [assets.js](file://server/routes/v1/assets.js)
- [auth.js](file://server/routes/v1/auth.js)
- [documents.js](file://server/routes/v1/documents.js)
- [models.js](file://server/routes/v1/models.js)
- [spaces.js](file://server/routes/v1/spaces.js)
- [timeseries.js](file://server/routes/v1/timeseries.js)
- [users.js](file://server/routes/v1/users.js)
- [index.js](file://server/routes/v1/index.js)
- [auth.js](file://server/config/auth.js)
- [validate.js](file://server/middleware/validate.js)
- [auth.js](file://server/middleware/auth.js)
- [user.js](file://server/models/user.js)
- [asset.js](file://server/models/asset.js)
- [space.js](file://server/models/space.js)
- [document.js](file://server/models/document.js)
</cite>

## 目录
1. [API版本控制策略](#apiv1)
2. [认证与授权](#认证与授权)
3. [AI服务](#ai)
4. [资产管理](#assets)
5. [文档管理](#documents)
6. [模型文件](#models)
7. [空间管理](#spaces)
8. [时序数据](#timeseries)
9. [用户管理](#users)
10. [健康检查](#健康检查)

## API版本控制策略

本系统采用基于URL路径的版本控制策略，所有v1版本的API端点均以`/api/v1/`为前缀。这种策略确保了API的向后兼容性，允许在不破坏现有客户端的情况下引入新功能或修改现有功能。未来版本将通过新增版本号（如`/api/v2/`）来实现，当前v1版本将保持稳定并持续维护。

**API版本演进计划：**
- **短期**：在v1版本中通过新增端点和可选参数扩展功能
- **中期**：收集v1使用反馈，优化数据结构和性能
- **长期**：规划v2版本，重构不一致的接口设计，引入更现代化的认证机制

**Section sources**
- [index.js](file://server/routes/v1/index.js#L1-L42)

## 认证与授权

所有需要认证的API端点都需要在请求头中包含Bearer Token。认证流程如下：
1. 用户通过`/api/v1/auth/login`端点使用邮箱和密码登录
2. 服务器返回包含accessToken的响应，该token需在后续请求的Authorization头中使用
3. accessToken有有效期，过期后可使用refreshToken获取新的accessToken

系统采用基于角色的访问控制（RBAC）模型，包含以下预定义角色及其权限：
- **admin**：系统管理员，拥有所有权限
- **manager**：管理角色，可读写资产、空间、文档等
- **editor**：编辑角色，可读取和更新但不能创建
- **viewer**：查看角色，仅可读取数据
- **guest**：访客角色，仅可读取核心数据

**Section sources**
- [auth.js](file://server/config/auth.js#L1-L142)
- [auth.js](file://server/middleware/auth.js#L1-L120)
- [validate.js](file://server/middleware/validate.js#L1-L72)

## AI服务

AI服务提供知识库管理和智能分析功能，支持基于文档内容的智能问答。

### 获取AI服务健康状态
**HTTP方法**: GET  
**URL路径**: `/api/v1/ai/health`  
**请求头**: `Authorization: Bearer <token>`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "openwebui": "connected",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```
**错误状态码**: 500 (服务异常)

### 获取所有知识库
**HTTP方法**: GET  
**URL路径**: `/api/v1/ai/knowledge-bases`  
**请求头**: `Authorization: Bearer <token>`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "description": "string"
    }
  ]
}
```
**错误状态码**: 500 (查询失败)

### 创建知识库
**HTTP方法**: POST  
**URL路径**: `/api/v1/ai/knowledge-bases`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "name": "string",
  "description": "string",
  "fileId": "integer"
}
```
**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string"
  }
}
```
**错误状态码**: 400 (参数错误), 500 (创建失败)

### 手动同步文档到知识库
**HTTP方法**: POST  
**URL路径**: `/api/v1/ai/sync-kb`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "kbId": "string",
  "documentIds": ["integer"],
  "fileId": "integer"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "total": "integer",
    "synced": "integer",
    "failed": "integer",
    "results": [
      {
        "id": "integer",
        "status": "synced|failed",
        "error": "string"
      }
    ]
  }
}
```
**错误状态码**: 400 (参数错误), 404 (知识库不存在), 500 (同步失败)

### 使用RAG进行查询
**HTTP方法**: POST  
**URL路径**: `/api/v1/ai/query`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "prompt": "string",
  "kbId": "string",
  "fileId": "integer",
  "allowWebSearch": "boolean"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "response": "string",
    "sources": ["object"]
  }
}
```
**错误状态码**: 400 (参数错误), 500 (查询失败)

### 获取AI分析上下文
**HTTP方法**: GET  
**URL路径**: `/api/v1/ai/context`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `roomCode`, `fileId`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "space": {
      "code": "string",
      "name": "string"
    },
    "assets": ["object"],
    "documents": ["object"],
    "knowledgeBase": {
      "id": "string",
      "name": "string"
    }
  }
}
```
**错误状态码**: 400 (缺少参数), 404 (房间不存在), 500 (查询失败)

### 格式化AI回复中的来源链接
**HTTP方法**: POST  
**URL路径**: `/api/v1/ai/format-sources`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "sources": ["object"],
  "fileId": "integer"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "formattedSources": [
      {
        "name": "string",
        "title": "string",
        "url": "string",
        "documentId": "integer",
        "isInternal": "boolean"
      }
    ]
  }
}
```
**错误状态码**: 400 (参数错误), 500 (格式化失败)

**Section sources**
- [ai.js](file://server/routes/v1/ai.js#L1-L416)

## 资产管理

提供资产的增删改查和批量操作功能。

### 获取资产列表
**HTTP方法**: GET  
**URL路径**: `/api/v1/assets`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `fileId`, `specCode`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "asset_code": "string",
      "name": "string",
      "spec_code": "string",
      "floor": "string",
      "room": "string"
    }
  ]
}
```
**错误状态码**: 500 (查询失败)

### 根据编码获取资产
**HTTP方法**: GET  
**URL路径**: `/api/v1/assets/{code}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `code`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "asset_code": "string",
    "name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (资产不存在), 500 (查询失败)

### 创建资产
**HTTP方法**: POST  
**URL路径**: `/api/v1/assets`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "assetCode": "string",
  "name": "string",
  "specCode": "string",
  "floor": "string",
  "room": "string",
  "dbId": "integer",
  "fileId": "integer"
}
```
**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "asset_code": "string",
    "name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 500 (创建失败)

### 更新资产
**HTTP方法**: PUT  
**URL路径**: `/api/v1/assets/{code}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `code`  
**请求体**:
```json
{
  "name": "string",
  "specCode": "string",
  "floor": "string",
  "room": "string"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "asset_code": "string",
    "name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (资产不存在), 500 (更新失败)

### 删除资产
**HTTP方法**: DELETE  
**URL路径**: `/api/v1/assets/{code}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `code`  
**成功响应 (200)**:
```json
{
  "success": true,
  "message": "删除成功"
}
```
**错误状态码**: 400 (参数验证失败), 404 (资产不存在), 500 (删除失败)

### 批量导入资产
**HTTP方法**: POST  
**URL路径**: `/api/v1/assets/batch`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "assets": [
    {
      "assetCode": "string",
      "name": "string",
      "specCode": "string",
      "floor": "string",
      "room": "string",
      "dbId": "integer"
    }
  ]
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "total": "integer",
    "created": "integer",
    "updated": "integer"
  }
}
```
**错误状态码**: 400 (参数验证失败), 500 (批量操作失败)

### 获取资产规格列表
**HTTP方法**: GET  
**URL路径**: `/api/v1/assets/specs`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `fileId`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "spec_code": "string",
      "spec_name": "string",
      "category": "string",
      "family": "string",
      "type": "string"
    }
  ]
}
```
**错误状态码**: 500 (查询失败)

### 根据编码获取资产规格
**HTTP方法**: GET  
**URL路径**: `/api/v1/assets/specs/{code}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `code`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "spec_code": "string",
    "spec_name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (规格不存在), 500 (查询失败)

**Section sources**
- [assets.js](file://server/routes/v1/assets.js#L1-L254)
- [asset.js](file://server/models/asset.js#L1-L257)

## 文档管理

提供文档的上传、查询、更新和删除功能。

### 获取文档列表
**HTTP方法**: GET  
**URL路径**: `/api/v1/documents`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `assetCode`, `spaceCode`, `category`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "integer",
      "title": "string",
      "file_name": "string",
      "file_path": "string",
      "file_size": "integer",
      "mime_type": "string",
      "asset_code": "string",
      "space_code": "string"
    }
  ]
}
```
**错误状态码**: 500 (查询失败)

### 根据ID获取文档
**HTTP方法**: GET  
**URL路径**: `/api/v1/documents/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "title": "string",
    "file_name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (文档不存在), 500 (查询失败)

### 上传文档
**HTTP方法**: POST  
**URL路径**: `/api/v1/documents`  
**请求头**: `Authorization: Bearer <token>`  
**表单数据**: `file` (文件), `title`, `description`, `category`, `assetId`, `spaceId`  
**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "title": "string",
    "file_name": "string"
  }
}
```
**错误状态码**: 400 (缺少文件或参数), 500 (上传失败)

### 更新文档信息
**HTTP方法**: PUT  
**URL路径**: `/api/v1/documents/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**请求体**:
```json
{
  "title": "string",
  "description": "string",
  "category": "string"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "title": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (文档不存在), 500 (更新失败)

### 删除文档
**HTTP方法**: DELETE  
**URL路径**: `/api/v1/documents/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "message": "删除成功"
}
```
**错误状态码**: 400 (参数验证失败), 404 (文档不存在), 500 (删除失败)

### 获取资产关联的文档
**HTTP方法**: GET  
**URL路径**: `/api/v1/documents/asset/{assetCode}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `assetCode`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "integer",
      "title": "string"
    }
  ]
}
```
**错误状态码**: 400 (参数验证失败), 500 (查询失败)

### 获取空间关联的文档
**HTTP方法**: GET  
**URL路径**: `/api/v1/documents/space/{spaceCode}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `spaceCode`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "integer",
      "title": "string"
    }
  ]
}
```
**错误状态码**: 400 (参数验证失败), 500 (查询失败)

**Section sources**
- [documents.js](file://server/routes/v1/documents.js#L1-L326)
- [document.js](file://server/models/document.js#L1-L167)

## 模型文件

管理3D模型文件及其与资产和空间的关联。

### 获取模型文件列表
**HTTP方法**: GET  
**URL路径**: `/api/v1/models`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `facilityId`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "integer",
      "file_name": "string",
      "file_path": "string",
      "file_size": "integer",
      "is_active": "boolean",
      "display_order": "integer"
    }
  ]
}
```
**错误状态码**: 500 (查询失败)

### 根据ID获取模型文件
**HTTP方法**: GET  
**URL路径**: `/api/v1/models/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "file_name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (模型文件不存在), 500 (查询失败)

### 更新模型文件信息
**HTTP方法**: PUT  
**URL路径**: `/api/v1/models/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**请求体**:
```json
{
  "title": "string",
  "description": "string",
  "facilityId": "integer",
  "displayOrder": "integer"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "title": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (模型文件不存在), 500 (更新失败)

### 删除模型文件
**HTTP方法**: DELETE  
**URL路径**: `/api/v1/models/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "message": "删除成功"
}
```
**错误状态码**: 400 (参数验证失败), 404 (模型文件不存在), 500 (删除失败)

### 激活模型文件
**HTTP方法**: POST  
**URL路径**: `/api/v1/models/{id}/activate`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "is_active": true
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (模型文件不存在), 500 (激活失败)

### 获取当前激活的模型文件
**HTTP方法**: GET  
**URL路径**: `/api/v1/models/active`  
**请求头**: `Authorization: Bearer <token>`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "file_name": "string"
  }
}
```
**错误状态码**: 404 (无激活模型), 500 (查询失败)

### 获取模型文件关联的资产
**HTTP方法**: GET  
**URL路径**: `/api/v1/models/{id}/assets`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "asset_code": "string",
      "name": "string"
    }
  ]
}
```
**错误状态码**: 400 (参数验证失败), 500 (查询失败)

### 获取模型文件关联的空间
**HTTP方法**: GET  
**URL路径**: `/api/v1/models/{id}/spaces`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "space_code": "string",
      "name": "string"
    }
  ]
}
```
**错误状态码**: 400 (参数验证失败), 500 (查询失败)

**Section sources**
- [models.js](file://server/routes/v1/models.js#L1-L225)

## 空间管理

提供空间的增删改查和批量操作功能。

### 获取空间列表
**HTTP方法**: GET  
**URL路径**: `/api/v1/spaces`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `fileId`, `floor`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "space_code": "string",
      "name": "string",
      "classification_code": "string",
      "floor": "string",
      "area": "number"
    }
  ]
}
```
**错误状态码**: 500 (查询失败)

### 根据编码获取空间
**HTTP方法**: GET  
**URL路径**: `/api/v1/spaces/{code}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `code`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "space_code": "string",
    "name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (空间不存在), 500 (查询失败)

### 创建空间
**HTTP方法**: POST  
**URL路径**: `/api/v1/spaces`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "spaceCode": "string",
  "name": "string",
  "floor": "string",
  "area": "number",
  "dbId": "integer",
  "fileId": "integer",
  "classificationCode": "string"
}
```
**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "space_code": "string",
    "name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 500 (创建失败)

### 更新空间
**HTTP方法**: PUT  
**URL路径**: `/api/v1/spaces/{code}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `code`  
**请求体**:
```json
{
  "name": "string",
  "floor": "string",
  "area": "number",
  "classificationCode": "string"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "space_code": "string",
    "name": "string"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (空间不存在), 500 (更新失败)

### 删除空间
**HTTP方法**: DELETE  
**URL路径**: `/api/v1/spaces/{code}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `code`  
**成功响应 (200)**:
```json
{
  "success": true,
  "message": "删除成功"
}
```
**错误状态码**: 400 (参数验证失败), 404 (空间不存在), 500 (删除失败)

### 批量导入空间
**HTTP方法**: POST  
**URL路径**: `/api/v1/spaces/batch`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "spaces": [
    {
      "spaceCode": "string",
      "name": "string",
      "floor": "string",
      "area": "number",
      "dbId": "integer"
    }
  ]
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "total": "integer",
    "created": "integer",
    "updated": "integer"
  }
}
```
**错误状态码**: 400 (参数验证失败), 500 (批量操作失败)

### 获取所有楼层列表
**HTTP方法**: GET  
**URL路径**: `/api/v1/spaces/floors`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `fileId`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": ["string"]
}
```
**错误状态码**: 500 (查询失败)

**Section sources**
- [spaces.js](file://server/routes/v1/spaces.js#L1-L221)
- [space.js](file://server/models/space.js#L1-L224)

## 时序数据

提供时序数据的查询和统计功能。

### 查询时序数据
**HTTP方法**: GET  
**URL路径**: `/api/v1/timeseries/query`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `roomCode`, `start`, `end`, `aggregateWindow`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "integer",
      "value": "number"
    }
  ]
}
```
**错误状态码**: 400 (参数验证失败), 500 (InfluxDB未配置或查询失败)

### 批量查询多个房间的时序数据
**HTTP方法**: POST  
**URL路径**: `/api/v1/timeseries/query/batch`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "roomCodes": ["string"],
  "startTime": "integer",
  "endTime": "integer",
  "aggregateWindow": "string"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "roomCode1": [
      {
        "timestamp": "integer",
        "value": "number"
      }
    ]
  }
}
```
**错误状态码**: 400 (参数验证失败), 500 (InfluxDB未配置或查询失败)

### 获取多个房间的最新温度值
**HTTP方法**: POST  
**URL路径**: `/api/v1/timeseries/latest`  
**请求头**: `Authorization: Bearer <token>`  
**请求体**:
```json
{
  "roomCodes": ["string"]
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "roomCode": "string",
      "value": "number",
      "timestamp": "integer"
    }
  ]
}
```
**错误状态码**: 400 (参数验证失败), 500 (InfluxDB未配置或查询失败)

### 获取单个房间的最新温度值
**HTTP方法**: GET  
**URL路径**: `/api/v1/timeseries/latest/{roomCode}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `roomCode`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "roomCode": "string",
    "value": "number",
    "timestamp": "integer"
  }
}
```
**错误状态码**: 400 (参数验证失败), 404 (无温度数据), 500 (InfluxDB未配置或查询失败)

### 获取时间范围内的统计数据
**HTTP方法**: GET  
**URL路径**: `/api/v1/timeseries/statistics`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `roomCode`, `start`, `end`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "min": "number",
    "max": "number",
    "avg": "number",
    "count": "integer"
  }
}
```
**错误状态码**: 400 (参数验证失败), 500 (InfluxDB未配置或查询失败)

**Section sources**
- [timeseries.js](file://server/routes/v1/timeseries.js#L1-L353)

## 用户管理

提供用户信息的查询和管理功能。

### 获取用户列表
**HTTP方法**: GET  
**URL路径**: `/api/v1/users`  
**请求头**: `Authorization: Bearer <token>`  
**查询参数**: `page`, `limit`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "integer",
        "email": "string",
        "name": "string",
        "avatar_url": "string",
        "is_active": "boolean",
        "roles": ["string"]
      }
    ],
    "total": "integer",
    "page": "integer",
    "limit": "integer",
    "totalPages": "integer"
  }
}
```
**错误状态码**: 500 (查询失败)

### 获取用户详情
**HTTP方法**: GET  
**URL路径**: `/api/v1/users/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "email": "string",
    "name": "string",
    "avatar_url": "string",
    "is_active": "boolean",
    "roles": ["string"]
  }
}
```
**错误状态码**: 404 (用户不存在), 500 (查询失败)

### 更新用户
**HTTP方法**: PUT  
**URL路径**: `/api/v1/users/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**请求体**:
```json
{
  "name": "string",
  "avatarUrl": "string",
  "isActive": "boolean"
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "integer",
    "email": "string",
    "name": "string",
    "avatar_url": "string",
    "is_active": "boolean",
    "roles": ["string"]
  },
  "message": "用户更新成功"
}
```
**错误状态码**: 500 (更新失败)

### 设置用户角色
**HTTP方法**: PUT  
**URL路径**: `/api/v1/users/{id}/roles`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**请求体**:
```json
{
  "roles": ["string"]
}
```
**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "roles": ["string"]
  },
  "message": "角色设置成功"
}
```
**错误状态码**: 400 (参数验证失败), 500 (设置失败)

### 删除用户
**HTTP方法**: DELETE  
**URL路径**: `/api/v1/users/{id}`  
**请求头**: `Authorization: Bearer <token>`  
**路径参数**: `id`  
**成功响应 (200)**:
```json
{
  "success": true,
  "message": "用户删除成功"
}
```
**错误状态码**: 400 (不能删除自己), 500 (删除失败)

**Section sources**
- [users.js](file://server/routes/v1/users.js#L1-L178)
- [user.js](file://server/models/user.js#L1-L252)

## 健康检查

提供API服务的健康状态检查。

### 健康检查
**HTTP方法**: GET  
**URL路径**: `/api/v1/health`  
**成功响应 (200)**:
```json
{
  "success": true,
  "message": "API v1 is running",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Section sources**
- [index.js](file://server/routes/v1/index.js#L1-L42)