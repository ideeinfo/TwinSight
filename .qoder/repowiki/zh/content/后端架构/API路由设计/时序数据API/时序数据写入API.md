# 时序数据写入API

<cite>
**本文档引用文件**  
- [timeseries.js](file://server/routes/timeseries.js#L267-L335)
- [influx-config.js](file://server/models/influx-config.js#L9)
- [schema.sql](file://server/db/schema.sql#L103-L119)
</cite>

## 目录
1. [简介](#简介)
2. [核心组件](#核心组件)
3. [架构概述](#架构概述)
4. [详细组件分析](#详细组件分析)
5. [依赖分析](#依赖分析)
6. [性能考虑](#性能考虑)
7. [故障排除指南](#故障排除指南)
8. [结论](#结论)

## 简介
本文档详细说明了时序数据写入API的实现机制，重点介绍POST /api/v1/timeseries/streams/:spaceCode接口的实现细节。文档涵盖了基于HMAC的API Key验证流程、数据格式要求、写入InfluxDB的具体过程，以及相关的安全设计和错误处理机制。

## 核心组件
本节分析时序数据写入API的核心组件，包括API路由、认证机制和数据写入逻辑。

**节来源**
- [timeseries.js](file://server/routes/timeseries.js#L267-L335)
- [influx-config.js](file://server/models/influx-config.js#L9)

## 架构概述
时序数据写入API采用分层架构设计，通过后端代理所有InfluxDB操作。系统使用数据库中存储的配置信息连接到InfluxDB，并通过安全的API Key机制验证客户端身份。

```mermaid
graph TD
Client[客户端] --> |POST /api/v1/timeseries/streams/:spaceCode| API[API网关]
API --> Auth[API Key验证]
Auth --> |验证通过| Config[获取InfluxDB配置]
Config --> |配置有效| Write[写入InfluxDB]
Write --> |成功| Success[返回成功响应]
Write --> |失败| Error[返回错误响应]
Auth --> |验证失败| Unauthorized[返回401/403]
Config --> |配置无效| ServiceUnavailable[返回503]
```

**图来源**  
- [timeseries.js](file://server/routes/timeseries.js#L267-L335)

## 详细组件分析

### API Key验证机制分析
时序数据写入API采用基于HMAC的安全验证机制，确保只有授权客户端能够写入数据。

#### 安全设计类图
```mermaid
classDiagram
class APIKeyGenerator {
+generateStreamApiKey(spaceCode) string
+validateStreamApiKey(spaceCode, providedKey) boolean
+generateStreamUrl(spaceCode, baseUrl) string
}
class InfluxDBWriter {
+writeToInflux(config, spaceCode, data, timestamp) Promise~Object~
+buildInfluxHeaders(config) Object
+buildInfluxBaseUrl(config) string
}
class ConfigManager {
+getActiveInfluxConfig() Promise~Object~
+getInfluxConfigByFileId(fileId) Promise~Object~
}
APIKeyGenerator --> InfluxDBWriter : "调用"
APIKeyGenerator --> ConfigManager : "调用"
InfluxDBWriter --> ConfigManager : "依赖"
```

**图来源**  
- [timeseries.js](file://server/routes/timeseries.js#L18-L42)

#### API调用序列图
```mermaid
sequenceDiagram
participant Client as "客户端"
participant Router as "路由处理器"
participant Validator as "API Key验证器"
participant Config as "配置管理器"
participant Influx as "InfluxDB写入器"
Client->>Router : POST /api/v1/timeseries/streams/ : spaceCode
Router->>Validator : 提取API Key
Validator->>Validator : validateStreamApiKey()
alt 验证失败
Validator-->>Router : 返回403
Router-->>Client : 403 无效API Key
else 验证成功
Router->>Config : getActiveInfluxConfig()
alt 配置无效
Config-->>Router : 返回null
Router-->>Client : 503 服务不可用
else 配置有效
Router->>Influx : writeToInflux()
Influx->>Influx : 构建Line Protocol
Influx->>Influx : 发送HTTP请求
alt 写入成功
Influx-->>Router : 返回ok : true
Router-->>Client : 200 成功
else 写入失败
Influx-->>Router : 返回错误
Router-->>Client : 500 内部错误
end
end
end
```

**图来源**  
- [timeseries.js](file://server/routes/timeseries.js#L267-L335)

### 数据写入流程分析
本节详细分析数据写入InfluxDB的具体过程，包括Line Protocol构建和HTTP请求发送。

#### 数据处理流程图
```mermaid
flowchart TD
Start([接收到POST请求]) --> Extract["提取spaceCode和API Key"]
Extract --> Validate["验证API Key有效性"]
Validate --> Valid{"验证通过?"}
Valid --> |否| Return403["返回403 无效API Key"]
Valid --> |是| GetConfig["获取InfluxDB配置"]
GetConfig --> HasConfig{"配置存在?"}
HasConfig --> |否| Return503["返回503 服务不可用"]
HasConfig --> |是| ParseBody["解析请求体数据"]
ParseBody --> CheckData["检查数据有效性"]
CheckData --> ValidData{"数据有效?"}
ValidData --> |否| Return400["返回400 无效数据"]
ValidData --> |是| BuildLine["构建Line Protocol"]
BuildLine --> SendRequest["发送到InfluxDB"]
SendRequest --> Success{"写入成功?"}
Success --> |是| Return200["返回200 成功"]
Success --> |否| LogError["记录错误日志"]
LogError --> Return500["返回500 内部错误"]
Return403 --> End([响应客户端])
Return503 --> End
Return400 --> End
Return200 --> End
Return500 --> End
```

**图来源**  
- [timeseries.js](file://server/routes/timeseries.js#L137-L180)

**节来源**
- [timeseries.js](file://server/routes/timeseries.js#L137-L180)

## 依赖分析
时序数据写入API依赖于多个核心组件和外部服务，确保系统的稳定性和安全性。

```mermaid
graph TD
timeseries.js --> influx-config.js
timeseries.js --> crypto
timeseries.js --> fetch
influx-config.js --> database.js
timeseries.js --> express
influx-config.js --> schema.sql
```

**图来源**  
- [timeseries.js](file://server/routes/timeseries.js#L1-L563)
- [influx-config.js](file://server/models/influx-config.js#L1-L184)

**节来源**
- [timeseries.js](file://server/routes/timeseries.js#L1-L563)
- [influx-config.js](file://server/models/influx-config.js#L1-L184)

## 性能考虑
时序数据写入API在设计时考虑了性能优化，包括：
- 使用HMAC-SHA256进行安全验证，平衡安全性和性能
- 采用流式处理方式构建Line Protocol，减少内存占用
- 使用异步非阻塞I/O操作，提高并发处理能力
- 通过连接池和重用机制优化InfluxDB通信性能

## 故障排除指南
本节说明API的错误处理机制和常见问题的解决方案。

**节来源**
- [timeseries.js](file://server/routes/timeseries.js#L280-L330)

## 结论
时序数据写入API提供了一个安全、高效的机制，用于将时序数据写入InfluxDB。通过基于HMAC的API Key验证、灵活的配置管理和健壮的错误处理，系统确保了数据写入的安全性和可靠性。客户端可以通过简单的HTTP POST请求，使用预生成的API Key将数据推送到指定的空间。