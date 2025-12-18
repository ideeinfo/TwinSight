/**
 * AI 分析 API 路由
 * 提供前端调用的 AI 分析接口
 */

import express from 'express';
import { triggerTemperatureAlert, triggerManualAnalysis, checkN8nHealth } from '../services/n8n-service.js';

const router = express.Router();

/**
 * GET /api/ai/health
 * 检查 AI 服务（n8n）是否可用
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = await checkN8nHealth();
        res.json({
            success: true,
            data: {
                n8n: isHealthy ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString(),
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/temperature-alert
 * 触发温度报警分析
 * 
 * Body:
 * {
 *   roomCode: string,
 *   roomName: string,
 *   temperature: number,
 *   threshold: number,
 *   fileId: number
 * }
 */
router.post('/temperature-alert', async (req, res) => {
    try {
        const { roomCode, roomName, temperature, threshold, fileId } = req.body;

        if (!roomCode || temperature === undefined) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: roomCode, temperature'
            });
        }

        const result = await triggerTemperatureAlert({
            roomCode,
            roomName: roomName || roomCode,
            temperature,
            threshold: threshold || 30,
            fileId,
            timestamp: new Date().toISOString(),
        });

        res.json({
            success: result.success,
            data: result.result,
            error: result.error
        });
    } catch (error) {
        console.error('❌ 温度报警 API 错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/analyze
 * 请求手动分析（资产或房间）
 * 
 * Body:
 * {
 *   type: 'asset' | 'room',
 *   target: { ... },  // 资产或房间对象
 *   question?: string,  // 可选的用户问题
 *   fileId: number
 * }
 */
router.post('/analyze', async (req, res) => {
    try {
        const { type, target, question, fileId } = req.body;

        if (!type || !target) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: type, target'
            });
        }

        if (!['asset', 'room'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'type 必须是 asset 或 room'
            });
        }

        const result = await triggerManualAnalysis({
            type,
            target,
            question,
            fileId,
        });

        res.json({
            success: result.success,
            data: result.result,
            error: result.error
        });
    } catch (error) {
        console.error('❌ 手动分析 API 错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
