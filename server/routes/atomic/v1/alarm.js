/**
 * Atomic API - 报警事件端点
 * 
 * POST /api/atomic/v1/alarm/create
 * 创建标准报警事件记录
 * 
 * Week1 最小实现：记录到日志并返回 ID
 * TODO (Week2): 落库到 alarm 表
 */

import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

/**
 * POST /create
 * 创建报警事件
 * 
 * Body: {
 *   severity: 'critical' | 'warning' | 'info',
 *   source: string,         // 来源（rule/manual/iot）
 *   objectCode?: string,    // 相关对象编码
 *   message: string,        // 报警描述
 *   metadata?: object       // 附加元数据
 * }
 */
router.post('/create', async (req, res) => {
    const startTime = Date.now();

    try {
        const { severity, source, objectCode, message, metadata } = req.body;

        if (!severity || !['critical', 'warning', 'info'].includes(severity)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'severity must be one of: critical, warning, info',
                    request_id: req.tracing?.requestId
                }
            });
        }

        if (!source || !message) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'source and message are required',
                    request_id: req.tracing?.requestId
                }
            });
        }

        // 生成报警 ID
        const alarmId = `alarm_${crypto.randomUUID()}`;

        // 构造报警记录
        const alarm = {
            alarmId,
            severity,
            source,
            objectCode,
            message,
            metadata,
            scope: req.scope,
            actor: {
                userId: req.user?.id,
                username: req.user?.username
            },
            createdAt: new Date().toISOString()
        };

        // Week1 最小实现：记录到日志
        // TODO (Week2): 写入 alarm 数据库表
        console.log(`🚨 [alarm] ${severity.toUpperCase()} | ${source} | ${message}`, JSON.stringify(alarm));

        res.json({
            success: true,
            data: {
                alarmId,
                severity,
                source,
                message,
                createdAt: alarm.createdAt
            },
            meta: {
                request_id: req.tracing?.requestId,
                duration_ms: Date.now() - startTime
            }
        });
    } catch (error) {
        console.error('❌ [atomic/alarm/create]', error.message);
        res.status(500).json({
            success: false,
            error: {
                code: 'ALARM_CREATE_FAILED',
                message: error.message,
                request_id: req.tracing?.requestId
            }
        });
    }
});

export default router;
