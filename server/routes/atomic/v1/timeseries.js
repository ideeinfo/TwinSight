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
                // 调用现有 GET /api/v1/timeseries/query/average
                const params = new URLSearchParams({
                    roomCodes: roomCodes.join(','),
                    fileId: String(fileId),
                    ...(startMs && { startMs: String(startMs) }),
                    ...(endMs && { endMs: String(endMs) })
                });
                const response = await axios.get(
                    `${baseUrl}/api/v1/timeseries/query/average?${params}`,
                    { headers, timeout: 10000 }
                );
                result = response.data;
                break;
            }

            case 'range':
            default: {
                // 调用现有 GET /api/v1/timeseries/query/room
                const params = new URLSearchParams({
                    roomCodes: roomCodes.join(','),
                    fileId: String(fileId),
                    ...(startMs && { startMs: String(startMs) }),
                    ...(endMs && { endMs: String(endMs) })
                });
                const response = await axios.get(
                    `${baseUrl}/api/v1/timeseries/query/room?${params}`,
                    { headers, timeout: 15000 }
                );
                result = response.data;
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
