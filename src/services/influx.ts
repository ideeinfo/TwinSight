/**
 * InfluxDB 服务 - 通过后端代理访问
 * 所有 InfluxDB 操作都通过后端 API 进行
 */

import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
const STATUS_CACHE_TTL_MS = 10_000;

type InfluxStatus = {
  configured?: boolean;
  enabled?: boolean;
  url?: string;
  org?: string;
  bucket?: string;
} | null;

type StatusCacheEntry = {
  value: InfluxStatus;
  expiresAt: number;
};

const statusCache = new Map<string, StatusCacheEntry>();
const statusInFlight = new Map<string, Promise<InfluxStatus>>();
const averageInFlight = new Map<string, Promise<Point[]>>();
const roomInFlight = new Map<string, Promise<Point[]>>();
const latestInFlight = new Map<string, Promise<Record<string, number>>>();

const getStatusCacheKey = (fileId?: number) => (fileId ? `file:${fileId}` : 'global');

// Helper to get auth headers
const getHeaders = (contentType?: string) => {
  const authStore = useAuthStore();
  const headers: Record<string, string> = {};
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
};

export type Point = { timestamp: number; value: number };

/**
 * 检查 InfluxDB 是否已配置
 */
export async function isInfluxConfigured(fileId?: number): Promise<boolean> {
  try {
    const status = await getInfluxStatus(fileId);
    return !!(status?.configured && status?.enabled);
  } catch {
    return false;
  }
}

/**
 * 写入房间历史数据（通过 Stream API）
 * 注意：这个方法主要用于外部数据接入，前端一般不直接调用
 */
export async function writeRoomHistory(_roomCode: string, _points: Point[]) {
  // 写入操作需要 API Key，通常由外部系统调用
  // 前端不应直接调用此方法
  console.warn('writeRoomHistory: 前端不应直接调用，请使用 Stream URL 接入数据');
  return { ok: false, reason: 'use_stream_url' };
}

/**
 * 查询平均值时序数据
 */
export async function queryAverageSeries(
  startMs: number,
  endMs: number,
  windowMs: number,
  fileId?: number
): Promise<Point[]> {
  const key = `avg:${startMs}:${endMs}:${windowMs}:${fileId ?? 'global'}`;
  const pending = averageInFlight.get(key);
  if (pending) return await pending;

  const req = (async (): Promise<Point[]> => {
    try {
      const params = new URLSearchParams({
        startMs: startMs.toString(),
        endMs: endMs.toString(),
        windowMs: windowMs.toString()
      });

      if (fileId) {
        params.append('fileId', fileId.toString());
      }

      const resp = await fetch(`${API_BASE}/api/v1/timeseries/query/average?${params}`, { headers: getHeaders() });
      if (!resp.ok) return [];

      const data = await resp.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('查询平均值失败:', error);
      return [];
    } finally {
      averageInFlight.delete(key);
    }
  })();

  averageInFlight.set(key, req);
  return await req;
}

/**
 * 查询房间时序数据
 */
export async function queryRoomSeries(
  roomCode: string,
  startMs: number,
  endMs: number,
  windowMs: number,
  fileId?: number
): Promise<Point[]> {
  const key = `room:${roomCode}:${startMs}:${endMs}:${windowMs}:${fileId ?? 'global'}`;
  const pending = roomInFlight.get(key);
  if (pending) return await pending;

  const req = (async (): Promise<Point[]> => {
    try {
      const params = new URLSearchParams({
        roomCode,
        startMs: startMs.toString(),
        endMs: endMs.toString(),
        windowMs: windowMs.toString()
      });

      if (fileId) {
        params.append('fileId', fileId.toString());
      }

      const resp = await fetch(`${API_BASE}/api/v1/timeseries/query/room?${params}`, { headers: getHeaders() });
      if (!resp.ok) return [];

      const data = await resp.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('查询房间数据失败:', error);
      return [];
    } finally {
      roomInFlight.delete(key);
    }
  })();

  roomInFlight.set(key, req);
  return await req;
}

/**
 * 查询多个房间的最新值
 */
export async function queryLatestByRooms(
  roomCodes: string[],
  lookbackMs: number,
  fileId?: number
): Promise<Record<string, number>> {
  if (!roomCodes?.length) return {};

  const codeKey = [...roomCodes].sort().join(',');
  const key = `latest:${codeKey}:${lookbackMs}:${fileId ?? 'global'}`;
  const pending = latestInFlight.get(key);
  if (pending) return await pending;

  const req = (async (): Promise<Record<string, number>> => {
    try {
      const resp = await fetch(`${API_BASE}/api/v1/timeseries/query/latest`, {
        method: 'POST',
        headers: getHeaders('application/json'),
        body: JSON.stringify({ roomCodes, lookbackMs, fileId })
      });

      if (!resp.ok) return {};

      const data = await resp.json();
      return data.success ? data.data : {};
    } catch (error) {
      console.error('查询最新值失败:', error);
      return {};
    } finally {
      latestInFlight.delete(key);
    }
  })();

  latestInFlight.set(key, req);
  return await req;
}

/**
 * 获取 InfluxDB 配置状态
 */
export async function getInfluxStatus(fileId?: number) {
  const key = getStatusCacheKey(fileId);
  const now = Date.now();
  const cached = statusCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = statusInFlight.get(key);
  if (inFlight) {
    return await inFlight;
  }

  const req = (async (): Promise<InfluxStatus> => {
    try {
      const url = fileId
        ? `${API_BASE}/api/v1/timeseries/status?fileId=${fileId}`
        : `${API_BASE}/api/v1/timeseries/status`;

      const resp = await fetch(url, { headers: getHeaders() });
      if (!resp.ok) {
        statusCache.set(key, { value: null, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });
        return null;
      }

      const data = await resp.json();
      const value = data.success ? data.data : null;
      statusCache.set(key, { value, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });
      return value;
    } catch {
      statusCache.set(key, { value: null, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });
      return null;
    } finally {
      statusInFlight.delete(key);
    }
  })();

  statusInFlight.set(key, req);

  return await req;
}

/**
 * 清理 Influx 状态缓存
 * - 不传 fileId: 清空所有缓存
 * - 传 fileId: 只清理对应模型缓存
 */
export function clearInfluxStatusCache(fileId?: number) {
  if (typeof fileId === 'number') {
    const key = getStatusCacheKey(fileId);
    statusCache.delete(key);
    statusInFlight.delete(key);
    return;
  }

  statusCache.clear();
  statusInFlight.clear();
}

export async function getInfluxStatusUncached(fileId?: number) {
  try {
    const url = fileId
      ? `${API_BASE}/api/v1/timeseries/status?fileId=${fileId}`
      : `${API_BASE}/api/v1/timeseries/status`;

    const resp = await fetch(url, { headers: getHeaders() });
    if (!resp.ok) return null;

    const data = await resp.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}
