/**
 * Atomic API - UI 控制指令端点
 * 
 * POST /api/atomic/v1/ui/command
 * 接收 navigate/highlight/isolate/reset 指令，
 * 后续通过 WebSocket 控制通道分发到前端（Day4 实现）。
 * 当前最小实现：记录指令并返回确认。
 */

import { Router } from 'express';

const router = Router();

// 支持的指令类型
const VALID_COMMANDS = ['navigate', 'highlight', 'isolate', 'reset'];

/**
 * POST /command
 * 发送 UI 控制指令
 * 
 * Body: {
 *   type: 'navigate' | 'highlight' | 'isolate' | 'reset',
 *   target: string,           // 目标对象编码（如 =A1.FAN01）
 *   sessionId?: string,       // 目标会话 ID（定向推送）
 *   params?: object           // 附加参数
 * }
 */
router.post('/command', async (req, res) => {
    const startTime = Date.now();

    try {
        const { type, target, sessionId, params } = req.body;

        if (!type || !VALID_COMMANDS.includes(type)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_COMMAND',
                    message: `type must be one of: ${VALID_COMMANDS.join(', ')}`,
                    request_id: req.tracing?.requestId
                }
            });
        }

        if (!target && type !== 'reset') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'target is required for non-reset commands',
                    request_id: req.tracing?.requestId
                }
            });
        }

        // 构造指令
        const command = {
            type,
            target,
            sessionId,
            params,
            scope: req.scope,
            actor: {
                userId: req.user?.id,
                username: req.user?.username
            },
            timestamp: new Date().toISOString()
        };

        // TODO (Day4): 通过 WebSocket 控制通道推送到前端
        // 当前最小实现：记录日志并返回确认
        console.log(`🎮 [ui-command] ${type} -> ${target}`, JSON.stringify(command));

        // 尝试通过 WebSocket 推送（如果已初始化）
        const io = req.app.get('io');
        if (io) {
            const targetRoom = sessionId
                ? `session:${sessionId}`
                : `project:${req.scope.projectId}`;
            io.to(targetRoom).emit('ui:command', command);
            console.log(`📡 [ui-command] Pushed to room: ${targetRoom}`);
        }

        res.json({
            success: true,
            data: {
                commandId: `cmd_${Date.now()}`,
                delivered: !!io,
                command
            },
            meta: {
                request_id: req.tracing?.requestId,
                duration_ms: Date.now() - startTime
            }
        });
    } catch (error) {
        console.error('❌ [atomic/ui/command]', error.message);
        res.status(500).json({
            success: false,
            error: {
                code: 'UI_COMMAND_FAILED',
                message: error.message,
                request_id: req.tracing?.requestId
            }
        });
    }
});

export default router;
