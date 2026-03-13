/**
 * Atomic API - 时序数据查询端点
 * 
 * POST /api/atomic/v1/timeseries/query
 * 聚合现有的 timeseries 查询能力（room / latest / average）
 */

import { Router } from 'express';
import axios from 'axios';

const router = Router();

// 内部 API 基地址（自身服务）
const getInternalBaseUrl = (req) => {
    return `${req.protocol}://${req.get('host')}`;
};

/**
 * POST /query
 * 统一时序数据查询
 * 
 * Body: {
 *   roomCodes: string[],       // 房间编码列表
 *   startMs?: number,          // 起始时间戳（毫秒）
 *   endMs?: number,            // 结束时间戳（毫秒）
 *   fileId: number,            // 模型文件 ID
 *   queryType?: 'range' | 'latest' | 'average'  // 查询类型（默认 range）
 * }
 */
router.post('/query', async (req, res) => {
    const startTime = Date.now();

    try {
        const { roomCodes, startMs, endMs, fileId, queryType = 'range' } = req.body;

        if (!roomCodes || !Array.isArray(roomCodes) || roomCodes.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'roomCodes (non-empty array) is required',
                    request_id: req.tracing?.requestId
                }
            });
        }

        if (!fileId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'fileId is required',
                    request_id: req.tracing?.requestId
                }
            });
        }

        if (startMs && endMs && Number(startMs) > Number(endMs)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'startMs must be less than or equal to endMs',
                    request_id: req.tracing?.requestId
                }
            });
        }

        const baseUrl = getInternalBaseUrl(req);
        const authHeader = req.headers.authorization;
        const headers = authHeader ? { Authorization: authHeader } : {};
        let result;

        switch (queryType) {
            case 'latest': {
                // 调用现有 POST /api/v1/timeseries/query/latest
                const response = await axios.post(
                    `${baseUrl}/api/v1/timeseries/query/latest`,
                    { roomCodes, fileId },
                    { headers, timeout: 10000 }
                );
                result = response.data;
                break;
            }

            case 'average': {
                // average 模式：startMs 和 endMs 必填
                if (!startMs || !endMs) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'INVALID_PARAMS',
                            message: 'startMs and endMs are required for average query type',
                            request_id: req.tracing?.requestId
                        }
                    });
                }

                const parsedStartMs = Number(startMs);
                const parsedEndMs = Number(endMs);
                if (isNaN(parsedStartMs) || isNaN(parsedEndMs)) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'INVALID_PARAMS',
                            message: 'startMs and endMs must be valid numbers',
                            request_id: req.tracing?.requestId
                        }
                    });
                }

                const bucketWindowMs = 60000;

                // 对每个 roomCode 并发调用底层 /room 接口（固定窗口，保证跨房间时间桶对齐）
                const roomRequests = roomCodes.map(code => {
                    const params = new URLSearchParams({
                        roomCode: code,
                        fileId: String(fileId),
                        startMs: String(parsedStartMs),
                        endMs: String(parsedEndMs),
                        windowMs: String(bucketWindowMs)
                    });
                    return axios.get(`${baseUrl}/api/v1/timeseries/query/room?${params}`, { headers, timeout: 15000 })
                        .then(res => res.data.data || res.data)
                        .catch(err => {
                            console.warn(`[atomic/timeseries/average] roomCode ${code} query failed:`, err.message);
                            return []; // 单个房间失败不阻塞整体
                        });
                });

                const roomResults = await Promise.all(roomRequests);

                // 按 timestamp 做时间桶归并
                // key: timestamp string, value: number[]
                const bucketMap = new Map();

                for (const points of roomResults) {
                    if (!Array.isArray(points)) continue;
                    for (const point of points) {
                        // 时序点结构：{ _time / timestamp, _value / value, ... }
                        const tsRaw = point._time ?? point.timestamp ?? point.time;
                        const val = point._value ?? point.value ?? point.mean;
                        if (tsRaw == null || val == null || isNaN(Number(val))) continue;

                        const tsMs = typeof tsRaw === 'number' ? tsRaw : Date.parse(tsRaw);
                        if (Number.isNaN(tsMs)) continue;

                        const key = String(tsMs);
                        if (!bucketMap.has(key)) {
                            bucketMap.set(key, []);
                        }
                        bucketMap.get(key).push(Number(val));
                    }
                }

                // 计算每个时间桶的算术平均
                const averagedPoints = [];
                for (const [ts, values] of bucketMap) {
                    const tsMs = Number(ts);
                    if (Number.isNaN(tsMs)) continue;
                    const sum = values.reduce((a, b) => a + b, 0);
                    averagedPoints.push({
                        _time: new Date(tsMs).toISOString(),
                        _value: sum / values.length,
                        _room_count: values.length
                    });
                }

                // 按时间排序
                averagedPoints.sort((a, b) => {
                    return new Date(a._time).getTime() - new Date(b._time).getTime();
                });

                result = averagedPoints;
                break;
            }

            case 'range':
            default: {
                // 底层接口仅受理单 roomCode，所以进行批量并发请求
                const requests = roomCodes.map(code => {
                    const params = new URLSearchParams({
                        roomCode: code,
                        fileId: String(fileId),
                        ...(startMs && { startMs: String(startMs) }),
                        ...(endMs && { endMs: String(endMs) })
                    });
                    return axios.get(`${baseUrl}/api/v1/timeseries/query/room?${params}`, { headers, timeout: 15000 })
                        .then(res => res.data.data || res.data)
                        .catch(err => {
                            console.warn(`[atomic/timeseries/query] roomCode ${code} range query failed:`, err.message);
                            return []; // 如果某个查不到，默认返回空数组避免全盘失败
                        });
                });

                const responses = await Promise.all(requests);

                // 将多个设备的数组合并
                let combinedData = [];
                for (const res of responses) {
                    if (Array.isArray(res)) {
                        combinedData = combinedData.concat(res);
                    }
                }

                result = combinedData;
                break;
            }
        }

        res.json({
            success: true,
            data: result.data || result,
            meta: {
                request_id: req.tracing?.requestId,
                duration_ms: Date.now() - startTime,
                query_type: queryType,
                room_count: roomCodes.length
            }
        });
    } catch (error) {
        console.error('❌ [atomic/timeseries/query]', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: {
                code: 'TIMESERIES_QUERY_FAILED',
                message: error.response?.data?.error || error.message,
                request_id: req.tracing?.requestId
            }
        });
    }
});

export default router;
