# 时序数据 API (Timeseries API)

## 概述

时序数据 API 提供 InfluxDB 的代理访问，支持多模型配置和实时数据流。所有 InfluxDB 操作均通过后端代理，使用数据库中存储的配置。

## 多模型支持

从 2025-03 版本开始，时序数据 API 支持多模型架构：
- 每个 BIM 模型可以拥有独立的 InfluxDB 配置
- 通过 `fileId` 参数指定目标模型
- 向后兼容旧版单模型配置

## API 端点

### 数据写入

#### POST `/api/v1/timeseries/streams/:fileId/:spaceCode`

接收时序数据流（新版，包含 fileId）。

**参数:**
- `fileId` - 模型文件 ID
- `spaceCode` - 空间编码
- `key` (query) - API Key 用于验证

**请求体:**
```json
{
  "temperature": 23.5,
  "humidity": 65,
  "timestamp": 1711536000000
}
```

**响应:**
```json
{
  "success": true,
  "message": "Data written successfully",
  "fileId": "123",
  "spaceCode": "ROOM-101",
  "fieldsWritten": 2
}
```

#### POST `/api/v1/timeseries/streams/:spaceCode` (已弃用)

旧版端点，向后兼容。建议使用新版包含 fileId 的端点。

### 数据查询

#### GET `/api/v1/timeseries/query/average`

查询平均值时序数据。

**参数:**
- `startMs` - 开始时间戳（毫秒）
- `endMs` - 结束时间戳（毫秒）
- `windowMs` - 聚合窗口（毫秒）
- `fileId` (可选) - 指定模型 ID

**响应:**
```json
{
  "success": true,
  "data": [
    { "timestamp": 1711536000000, "value": 23.5 },
    { "timestamp": 1711536060000, "value": 23.7 }
  ]
}
```

#### GET `/api/v1/timeseries/query/room`

查询指定房间的时序数据。

**参数:**
- `roomCode` - 房间编码
- `startMs` - 开始时间戳
- `endMs` - 结束时间戳
- `windowMs` - 聚合窗口（0 表示不聚合）
- `fileId` (可选) - 指定模型 ID

#### POST `/api/v1/timeseries/query/latest`

查询多个房间的最新值。

**请求体:**
```json
{
  "roomCodes": ["ROOM-101", "ROOM-102"],
  "lookbackMs": 300000,
  "fileId": 123
}
```

### Stream URL 生成

#### GET `/api/v1/timeseries/stream-url/:fileId/:spaceCode`

生成数据流的 URL 和 API Key。

**响应:**
```json
{
  "success": true,
  "data": {
    "fileId": "123",
    "spaceCode": "ROOM-101",
    "streamUrl": "https://api.example.com/api/v1/timeseries/streams/123/ROOM-101?key=xxx",
    "apiKey": "xxxxxxxx"
  }
}
```

#### POST `/api/v1/timeseries/stream-urls`

批量获取多个空间的 Stream URL。

**请求体:**
```json
{
  "fileId": 123,
  "spaceCodes": ["ROOM-101", "ROOM-102", "ROOM-103"]
}
```

### 状态检查

#### GET `/api/v1/timeseries/status`

检查 InfluxDB 配置状态。

**参数:**
- `fileId` (可选) - 指定模型 ID

**响应:**
```json
{
  "success": true,
  "data": {
    "configured": true,
    "enabled": true,
    "url": "http://influxdb:8086",
    "org": "my-org",
    "bucket": "my-bucket"
  }
}
```

## API Key 验证

Stream API 使用 HMAC-SHA256 生成和验证 API Key：

```javascript
// Key 生成
const hmac = crypto.createHmac('sha256', API_KEY_SECRET);
hmac.update(`${fileId}:${spaceCode}`);
const apiKey = hmac.digest('base64url').substring(0, 22);
```

API Key 绑定到特定的 `fileId` 和 `spaceCode` 组合，确保数据隔离。

## 配置优先级

InfluxDB 配置按以下优先级获取：

1. **指定 fileId** - 使用特定模型的配置
2. **spaceCode 关联** - 通过空间编码查找关联模型
3. **激活模型** - 使用当前激活的模型配置
4. **全局配置** - 回退到全局环境变量配置

## 错误处理

常见错误码：

| 状态码 | 含义 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 缺少 API Key |
| 403 | API Key 无效 |
| 503 | InfluxDB 未配置 |

## 环境变量

```bash
# InfluxDB 配置
INFLUXDB_URL=http://localhost:8086
INFLUXDB_ORG=my-org
INFLUXDB_BUCKET=my-bucket
INFLUXDB_TOKEN=xxx

# API Key 密钥
API_KEY_SECRET=tandem-timeseries-secret-2024

# 超时设置
INFLUX_TIMEOUT_MS=3000

# 调试模式
TIMESERIES_DEBUG=true
```
