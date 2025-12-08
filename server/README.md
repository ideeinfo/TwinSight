# Tandem Demo - PostgreSQL 数据库集成

本项目集成了 PostgreSQL 数据库，用于存储从模型中提取的资产和空间数据。

## 📦 数据库表结构

### 1. 分类编码表 (classifications)
存储资产和空间的 OmniClass 分类信息。

| 字段名 | 类型 | 说明 | 数据来源 |
|--------|------|------|----------|
| classification_code | VARCHAR(100) | 分类编码 | 资产: Classification.OmniClass.21.Number<br>空间: Classification.Space.Number |
| classification_desc | VARCHAR(500) | 分类描述 | 资产: Classification.OmniClass.21.Description<br>空间: Classification.Space.Description |
| classification_type | VARCHAR(20) | 分类类型 | 'asset' 或 'space' |

### 2. 资产规格表 (asset_specs)
存储资产构件的类型规格信息（按类型注释去重）。

| 字段名 | 类型 | 说明 | 数据来源 |
|--------|------|------|----------|
| spec_code | VARCHAR(100) | 规格编码 (主键) | 类型注释 |
| classification_code | VARCHAR(100) | 分类编码 | OmniClass 21 编号 |
| classification_desc | VARCHAR(500) | 分类描述 | OmniClass 21 描述 |
| category | VARCHAR(200) | 类别 | 类别 |
| family | VARCHAR(200) | 族 | 族 |
| type | VARCHAR(200) | 类型 | 类型 |
| manufacturer | VARCHAR(200) | 制造商 | 制造商 |
| address | VARCHAR(500) | 地址 | 地址 |
| phone | VARCHAR(50) | 电话 | 电话 |

### 3. 资产表 (assets)
存储资产构件的基本信息。

| 字段名 | 类型 | 说明 | 数据来源 |
|--------|------|------|----------|
| asset_code | VARCHAR(100) | 编码 (主键) | MC编码 |
| spec_code | VARCHAR(100) | 规格编码 (外键) | 类型注释 |
| name | VARCHAR(200) | 名称 | 名称（标识分组下） |
| floor | VARCHAR(100) | 楼层 | 楼层 |
| room | VARCHAR(200) | 房间 | 名称（房间分组下） |
| db_id | INTEGER | Viewer dbId | 模型元素ID |

### 4. 空间表 (spaces)
存储房间构件的基本信息。

| 字段名 | 类型 | 说明 | 数据来源 |
|--------|------|------|----------|
| space_code | VARCHAR(100) | 空间编码 (主键) | 编号 |
| name | VARCHAR(200) | 名称 | 名称 |
| classification_code | VARCHAR(100) | 分类编码 | Classification.Space.Number |
| classification_desc | VARCHAR(500) | 分类描述 | Classification.Space.Description |
| floor | VARCHAR(100) | 楼层 | 标高 |
| area | DECIMAL(15,4) | 面积 | 面积 |
| perimeter | DECIMAL(15,4) | 周长 | 周长 |
| db_id | INTEGER | Viewer dbId | 模型元素ID |

## 🚀 快速开始

### 1. 启动 PostgreSQL 数据库

```bash
# 启动 Docker 容器
docker-compose up -d
```

### 2. 安装后端依赖

```bash
cd server
npm install
```

### 3. 初始化数据库表

```bash
npm run db:init
```

### 4. 启动后端服务

```bash
npm run dev
```

服务将在 `http://localhost:3001` 启动。

### 5. 启动前端

```bash
# 在项目根目录
npm run dev
```

## 📡 API 接口

### 分类编码
- `GET /api/classifications` - 获取所有分类编码
- `GET /api/classifications?type=asset` - 获取资产分类
- `GET /api/classifications?type=space` - 获取空间分类
- `POST /api/classifications/batch` - 批量导入分类编码

### 资产规格
- `GET /api/asset-specs` - 获取所有资产规格
- `GET /api/asset-specs/:code` - 根据编码获取规格
- `POST /api/asset-specs/batch` - 批量导入资产规格

### 资产
- `GET /api/assets` - 获取所有资产
- `GET /api/assets/:code` - 根据编码获取资产
- `GET /api/assets/floor/:floor` - 根据楼层获取资产
- `GET /api/assets/room/:room` - 根据房间获取资产
- `POST /api/assets/batch` - 批量导入资产

### 空间
- `GET /api/spaces` - 获取所有空间
- `GET /api/spaces/:code` - 根据编码获取空间
- `GET /api/spaces/floor/:floor` - 根据楼层获取空间
- `POST /api/spaces/batch` - 批量导入空间

### 综合导入
- `POST /api/import/model-data` - 从模型导入所有数据

请求体格式:
```json
{
  "assets": [
    {
      "dbId": 123,
      "mcCode": "MC-001",
      "name": "设备名称",
      "floor": "1F",
      "room": "房间名",
      "omniClass21Number": "21-01 10 10",
      "omniClass21Description": "分类描述",
      "category": "类别",
      "family": "族",
      "type": "类型",
      "typeComments": "规格编码",
      "manufacturer": "制造商",
      "address": "地址",
      "phone": "电话"
    }
  ],
  "spaces": [
    {
      "dbId": 456,
      "spaceCode": "R-001",
      "name": "房间名称",
      "classificationCode": "13-11 00 00",
      "classificationDesc": "分类描述",
      "floor": "标高 1",
      "area": "25.5",
      "perimeter": "20.2"
    }
  ]
}
```

## 🔧 环境配置

### 数据库配置 (server/.env)
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=tandem
SERVER_PORT=3001
```

### 前端 API 配置
在 `src/services/postgres.js` 中，API 基础 URL 默认为 `http://localhost:3001`。

可以在项目根目录创建 `.env.local` 文件来覆盖:
```
VITE_API_URL=http://localhost:3001
```

## 📊 从模型导出数据

1. 启动前端和后端服务
2. 加载 3D 模型
3. 等待模型完全加载
4. 使用 `DataExportPanel` 组件的"提取并导出数据"按钮

数据将自动从模型中提取并存入 PostgreSQL 数据库。
