/**
 * AI 分析 API 路由
 * 提供前端调用的 AI 分析接口
 */

import express from 'express';
// 使用 n8n 工作流调用方式
import { triggerTemperatureAlert, triggerManualAnalysis, checkN8nHealth } from '../services/n8n-service.js';
// 直接调用 Gemini API（备用）
// import { analyzeTemperatureAlert } from '../services/gemini-service.js';

const router = express.Router();

/**
 * GET /api/ai/health
 * 检查 AI 服务是否可用
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
 * 触发温度报警分析（通过 n8n 工作流）
 * 
 * Body:
 * {
 *   roomCode: string,
 *   roomName: string,
 *   temperature: number,
 *   threshold: number,
 *   alertType: 'high' | 'low',
 *   fileId: number
 * }
 */
router.post('/temperature-alert', async (req, res) => {
    try {
        const { roomCode, roomName, temperature, threshold, alertType, fileId } = req.body;

        if (!roomCode || temperature === undefined) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: roomCode, temperature'
            });
        }

        // 根据报警类型设置默认阈值：高温28°C，低温0°C
        const defaultThreshold = alertType === 'low' ? 0 : 28;
        const finalThreshold = threshold || defaultThreshold;
        const finalAlertType = alertType || 'high';

        console.log(`📡 收到温度报警请求 (n8n):`, {
            roomName, roomCode, temperature, threshold: finalThreshold, alertType: finalAlertType
        });

        // 调用 n8n 工作流
        const n8nResult = await triggerTemperatureAlert({
            roomCode,
            roomName: roomName || roomCode,
            temperature,
            threshold: finalThreshold,
            alertType: finalAlertType,
            fileId,
        });

        console.log(`📊 n8n 工作流返回:`, JSON.stringify(n8nResult, null, 2));

        if (n8nResult.success && n8nResult.result) {
            const workflowResult = n8nResult.result;

            // 检查是否是空对象
            if (Object.keys(workflowResult).length === 0) {
                console.error('⚠️ n8n 返回了空对象，可能工作流中某个节点执行失败');
                return res.status(500).json({
                    success: false,
                    error: 'n8n workflow returned empty result. Check n8n execution logs.'
                });
            }

            console.log(`✅ n8n 返回成功: analysis 长度=${workflowResult.analysis?.length || 0}`);

            res.json({
                success: true,
                data: {
                    analysis: workflowResult.analysis,
                    alert: workflowResult.alert
                }
            });
        } else {
            console.error('❌ n8n 工作流调用失败:', n8nResult.error);
            res.status(500).json({
                success: false,
                error: n8nResult.error || 'n8n workflow failed'
            });
        }
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
