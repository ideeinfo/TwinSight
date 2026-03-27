# InfluxDB 服务 (Frontend)

## 概述

前端 InfluxDB 服务通过后端 API 代理访问 InfluxDB 时序数据。所有操作都经过认证，支持多模型配置。

## 核心功能

- 查询平均值时序数据
- 查询房间时序数据
- 查询多房间最新值
- InfluxDB 状态检查

## API 函数

### queryAverageSeries

查询平均值时序数据。

```typescript
async function queryAverageSeries(
  startMs: number,
  endMs: number,
  windowMs: number,
  fileId?: number
): Promise<Point[]>
```

**参数:**
- `startMs` - 开始时间戳（毫秒）
- `endMs` - 结束时间戳（毫秒）
- `windowMs` - 聚合窗口（毫秒）
- `fileId` - 可选，指定模型 ID

**返回:**
```typescript
type Point = { timestamp: number; value: number };
```

**示例:**
```typescript
const data = await queryAverageSeries(
  Date.now() - 3600000,  // 1小时前
  Date.now(),            // 现在
  60000,                 // 1分钟聚合
  123                    // 模型ID
);
```

### queryRoomSeries

查询指定房间的时序数据。

```typescript
async function queryRoomSeries(
  roomCode: string,
  startMs: number,
  endMs: number,
  windowMs: number,
  fileId?: number
): Promise<Point[]>
```

**参数:**
- `roomCode` - 房间编码
- `startMs` - 开始时间戳
- `endMs` - 结束时间戳
- `windowMs` - 聚合窗口（0 表示原始数据）
- `fileId` - 可选，指定模型 ID

### queryLatestByRooms

查询多个房间的最新值。

```typescript
async function queryLatestByRooms(
  roomCodes: string[],
  lookbackMs: number,
  fileId?: number
): Promise<Record<string, number>>
```

**参数:**
- `roomCodes` - 房间编码数组
- `lookbackMs` - 回溯时间（毫秒）
- `fileId` - 可选，指定模型 ID

**返回:**
```typescript
{
  "ROOM-101": 23.5,
  "ROOM-102": 24.1
}
```

### getInfluxStatus

获取 InfluxDB 配置状态（带缓存）。

```typescript
async function getInfluxStatus(fileId?: number): Promise<InfluxStatus | null>
```

**返回:**
```typescript
type InfluxStatus = {
  configured?: boolean;
  enabled?: boolean;
  url?: string;
  org?: string;
  bucket?: string;
} | null;
```

### isInfluxConfigured

快速检查 InfluxDB 是否已配置。

```typescript
async function isInfluxConfigured(fileId?: number): Promise<boolean>
```

### clearInfluxStatusCache

清理状态缓存。

```typescript
function clearInfluxStatusCache(fileId?: number): void
```

- 不传 `fileId`：清空所有缓存
- 传 `fileId`：只清理对应模型缓存

## 请求去重

服务自动处理并发请求去重：

```typescript
// 相同参数的并发请求会共享一个 Promise
const promise1 = queryRoomSeries('ROOM-101', ...);
const promise2 = queryRoomSeries('ROOM-101', ...); // 共享 promise1
```

支持去重的函数：
- `queryAverageSeries`
- `queryRoomSeries`
- `queryLatestByRooms`
- `getInfluxStatus`

## 缓存策略

### 状态缓存

```typescript
const STATUS_CACHE_TTL_MS = 10_000; // 10 秒
```

状态查询结果缓存 10 秒，减少重复请求。

### 手动清理

在配置变更后需要手动清理缓存：

```typescript
import { clearInfluxStatusCache } from '@/services/influx';

// 保存配置后
await saveInfluxConfig(fileId, config);
clearInfluxStatusCache(fileId);
```

## 认证

所有请求自动携带 JWT Token：

```typescript
const getHeaders = (contentType?: string) => {
  const authStore = useAuthStore();
  const headers: Record<string, string> = {};
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  // ...
};
```

## 多模型支持

通过 `fileId` 参数指定目标模型：

```typescript
// 查询特定模型的数据
const data = await queryRoomSeries('ROOM-101', t1, t2, 0, 123);

// 不指定则使用当前激活模型
const data = await queryRoomSeries('ROOM-101', t1, t2, 0);
```

## 错误处理

所有函数在出错时返回空数据或 `false`，不抛出异常：

```typescript
// 查询失败返回空数组
try {
  return data.success ? data.data : [];
} catch (error) {
  console.error('查询失败:', error);
  return [];
}
```

## 环境配置

```bash
# .env
VITE_API_URL=http://localhost:3001
```
