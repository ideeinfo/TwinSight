# 外部时序数据接入功能

## 功能概述

此功能允许外部系统（如 IoT 设备、BMS 系统、Node-RED 等）通过 HTTP POST 请求将时序数据推送到系统中，数据将存储在 InfluxDB 中用于可视化和分析。

## 功能特点

1. **自动生成安全 URL** - 每个空间/连接都有唯一的数据接入 URL，包含加密的 API Key
2. **一键复制** - 点击列表项右侧的链接图标即可复制 URL 到剪贴板
3. **JSON 格式数据** - 支持任意 JSON 格式的数值数据
4. **写入 InfluxDB** - 数据自动存储到 InfluxDB 时序数据库

## API 端点

### 1. 推送时序数据

```http
POST /api/v1/timeseries/streams/{spaceCode}?key={apiKey}
Content-Type: application/json

{
  "room_temp": 25.8,
  "room_humi": 65,
  "timestamp": 1702648800000  // 可选，毫秒时间戳
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "Data written successfully",
  "spaceCode": "SPACE_A101",
  "fieldsWritten": 2
}
```

### 2. 获取空间的 Stream URL

```http
GET /api/v1/timeseries/stream-url/{spaceCode}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "spaceCode": "SPACE_A101",
    "streamUrl": "http://localhost:3001/api/v1/timeseries/streams/SPACE_A101?key=dwRvzsxLSa-RPixSS2J7bQ",
    "apiKey": "dwRvzsxLSa-RPixSS2J7bQ"
  }
}
```

### 3. 批量获取 Stream URL

```http
POST /api/v1/timeseries/stream-urls
Content-Type: application/json

{
  "spaceCodes": ["SPACE_A101", "SPACE_A102", "SPACE_A103"]
}
```

## 使用方法

### 在 UI 中复制 URL

1. 进入 **连接** 视图（左侧面板）
2. 找到目标空间/房间
3. 点击右侧的 **链接图标** 🔗
4. URL 自动复制到剪贴板，显示 "URL 已复制" 提示

### 从外部系统推送数据

#### 使用 cURL

```bash
curl -X POST "http://localhost:3001/api/v1/timeseries/streams/SPACE_A101?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"room_temp": 25.8, "room_humi": 65}'
```

#### 使用 Node-RED

1. 使用 **HTTP Request** 节点
2. 设置 Method 为 `POST`
3. 设置 URL 为复制的 Stream URL
4. 设置 Payload 为 JSON 格式

#### 使用 JavaScript/Fetch

```javascript
fetch('http://localhost:3001/api/v1/timeseries/streams/SPACE_A101?key=YOUR_API_KEY', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    room_temp: 25.8,
    room_humi: 65
  })
});
```

## 配置说明

在 `server/.env` 中配置：

```env
# InfluxDB 配置
INFLUX_URL=http://localhost:8086
INFLUX_ORG=tandem
INFLUX_BUCKET=tandem
INFLUX_TOKEN=your_influxdb_token

# API 密钥种子（用于生成安全的 API Key）
API_KEY_SECRET=your_secret_key
```

## 安全说明

- 每个空间的 API Key 基于空间编码和服务器密钥生成
- API Key 使用 HMAC-SHA256 算法
- 建议在生产环境中更换默认的 `API_KEY_SECRET`
- 如需更高安全性，可在前端配置使用 HTTPS

## 数据格式

推送的 JSON 数据将转换为 InfluxDB Line Protocol 格式：

```
{field_name},room={space_code},code={space_code} value={value} {timestamp}
```

例如：
```
room_temp,room=SPACE_A101,code=SPACE_A101 value=25.8 1702648800000
room_humi,room=SPACE_A101,code=SPACE_A101 value=65 1702648800000
```

这样可以在 InfluxDB 中按房间/空间编码进行查询和聚合。
