/**
 * 时序数据 API 服务
 */
import http from '../http';

const BASE_PATH = '/api/timeseries';

export interface TimeSeriesPoint {
    timestamp: number;
    value: number;
}

export interface TimeSeriesQuery {
    roomCode: string;
    startTime: number;
    endTime: number;
    aggregateWindow?: string;
}

export interface LatestValue {
    roomCode: string;
    value: number;
    timestamp: number;
}

/**
 * 查询时序数据
 */
export async function queryTimeSeries(query: TimeSeriesQuery): Promise<TimeSeriesPoint[]> {
    const response = await http.get<TimeSeriesPoint[]>(`${BASE_PATH}/query`, {
        roomCode: query.roomCode,
        start: query.startTime,
        end: query.endTime,
        aggregateWindow: query.aggregateWindow,
    });
    return response.data || [];
}

/**
 * 批量查询多个房间的时序数据
 */
export async function queryMultipleTimeSeries(
    roomCodes: string[],
    startTime: number,
    endTime: number,
    aggregateWindow?: string
): Promise<Record<string, TimeSeriesPoint[]>> {
    const response = await http.post<Record<string, TimeSeriesPoint[]>>(`${BASE_PATH}/query/batch`, {
        roomCodes,
        startTime,
        endTime,
        aggregateWindow,
    });
    return response.data || {};
}

/**
 * 获取最新值
 */
export async function getLatestValues(roomCodes: string[]): Promise<LatestValue[]> {
    const response = await http.post<LatestValue[]>(`${BASE_PATH}/latest`, { roomCodes });
    return response.data || [];
}

/**
 * 获取单个房间的最新值
 */
export async function getLatestValue(roomCode: string): Promise<LatestValue | null> {
    const response = await http.get<LatestValue>(`${BASE_PATH}/latest/${roomCode}`);
    return response.data || null;
}

/**
 * 获取时间范围内的统计数据
 */
export async function getStatistics(
    roomCode: string,
    startTime: number,
    endTime: number
): Promise<{ min: number; max: number; avg: number; count: number }> {
    const response = await http.get<{ min: number; max: number; avg: number; count: number }>(
        `${BASE_PATH}/statistics`,
        { roomCode, start: startTime, end: endTime }
    );
    return response.data || { min: 0, max: 0, avg: 0, count: 0 };
}

export const timeseriesApi = {
    queryTimeSeries,
    queryMultipleTimeSeries,
    getLatestValues,
    getLatestValue,
    getStatistics,
};
