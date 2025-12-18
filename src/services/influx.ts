/**
 * InfluxDB 服务 - 通过后端代理访问
 * 所有 InfluxDB 操作都通过后端 API 进行
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type Point = { timestamp: number; value: number };

/**
 * 检查 InfluxDB 是否已配置
 */
export async function isInfluxConfigured(fileId?: number): Promise<boolean> {
  try {
    const url = fileId
      ? `${API_BASE}/api/v1/timeseries/status?fileId=${fileId}`
      : `${API_BASE}/api/v1/timeseries/status`;

    const resp = await fetch(url);
    if (!resp.ok) return false;

    const data = await resp.json();
    return data.success && data.data?.configured && data.data?.enabled;
  } catch {
    return false;
  }
}

/**
 * 写入房间历史数据（通过 Stream API）
 * 注意：这个方法主要用于外部数据接入，前端一般不直接调用
 */
export async function writeRoomHistory(roomCode: string, points: Point[]) {
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
  try {
    const params = new URLSearchParams({
      startMs: startMs.toString(),
      endMs: endMs.toString(),
      windowMs: windowMs.toString()
    });

    if (fileId) {
      params.append('fileId', fileId.toString());
    }

    const resp = await fetch(`${API_BASE}/api/v1/timeseries/query/average?${params}`);
    if (!resp.ok) return [];

    const data = await resp.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('查询平均值失败:', error);
    return [];
  }
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

    const resp = await fetch(`${API_BASE}/api/v1/timeseries/query/room?${params}`);
    if (!resp.ok) return [];

    const data = await resp.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('查询房间数据失败:', error);
    return [];
  }
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

  try {
    const resp = await fetch(`${API_BASE}/api/v1/timeseries/query/latest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCodes, lookbackMs, fileId })
    });

    if (!resp.ok) return {};

    const data = await resp.json();
    return data.success ? data.data : {};
  } catch (error) {
    console.error('查询最新值失败:', error);
    return {};
  }
}

/**
 * 获取 InfluxDB 配置状态
 */
export async function getInfluxStatus(fileId?: number) {
  try {
    const url = fileId
      ? `${API_BASE}/api/v1/timeseries/status?fileId=${fileId}`
      : `${API_BASE}/api/v1/timeseries/status`;

    const resp = await fetch(url);
    if (!resp.ok) return null;

    const data = await resp.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}
