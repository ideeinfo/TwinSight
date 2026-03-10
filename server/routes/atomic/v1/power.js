/**
 * Atomic API - 电源追溯端点
 * 
 * POST /api/atomic/v1/power/trace
 * 内部转发到现有的 Logic Engine: POST /api/topology/trace
 */

import { Router } from 'express';
import axios from 'axios';

const router = Router();
const LOGIC_ENGINE_URL = process.env.LOGIC_ENGINE_URL || 'http://localhost:8000';

/**
 * POST /trace
 * 电源拓扑追溯
 * 
 * Body: { mcCode, direction, fileId? }
 * Response: { success, data: { nodes, edges, startNode }, meta }
 */
router.post('/trace', async (req, res) => {
    const startTime = Date.now();

    try {
        const { mcCode, direction, fileId } = req.body;

        if (!mcCode || !direction) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'mcCode and direction are required',
                    request_id: req.tracing?.requestId
                }
            });
        }

        // 遵循项目规范：Python Logic Engine 期望 snake_case
        // Logic Engine Pydantic 模型使用 object_id 而非 mc_code
        const logicEnginePayload = {
            object_id: mcCode,
            direction: direction,
            file_id: fileId
        };

        // 转发到 Logic Engine
        const response = await axios.post(
            `${LOGIC_ENGINE_URL}/api/topology/trace`,
            logicEnginePayload,
            { timeout: 10000 }
        );

        res.json({
            success: true,
            data: response.data,
            meta: {
                request_id: req.tracing?.requestId,
                duration_ms: Date.now() - startTime,
                source: 'logic_engine'
            }
        });
    } catch (error) {
        if (error.response) {
            console.error('❌ [atomic/power/trace] Logic Engine Error:', error.response.status, JSON.stringify(error.response.data));
        } else {
            console.error('❌ [atomic/power/trace] Network/Other Error:', error.message);
        }

        res.status(error.response?.status || 500).json({
            success: false,
            error: {
                code: 'POWER_TRACE_FAILED',
                message: error.response?.data?.detail || error.response?.data || error.message,
                request_id: req.tracing?.requestId
            }
        });
    }
});

export default router;
