/**
 * IoT 触发器配置 API
 * 管理 IoT 报警触发规则，支持 n8n 工作流集成
 */

import express from 'express';
import pool from '../db/index.js';
import { getConfig } from '../services/config-service.js';

const router = express.Router();

/**
 * GET /api/iot-triggers
 * 获取所有触发器
 */
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM iot_triggers 
            ORDER BY type, name
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('❌ 获取触发器列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/iot-triggers/enabled
 * 获取所有启用的触发器（用于运行时检查）
 */
router.get('/enabled', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM iot_triggers 
            WHERE enabled = true
            ORDER BY type, condition_operator, condition_value
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('❌ 获取启用触发器失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/iot-triggers/:id
 * 获取单个触发器
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM iot_triggers WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: '触发器不存在' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('❌ 获取触发器失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/iot-triggers
 * 创建触发器
 */
router.post('/', async (req, res) => {
    try {
        const {
            name, type, enabled = true,
            conditionField, conditionOperator, conditionValue,
            analysisEngine = 'builtin', n8nWorkflowId, n8nWebhookPath,
            severity = 'warning', autoOpenChat = true
        } = req.body;

        if (!name || !type || !conditionField || !conditionOperator || conditionValue === undefined) {
            return res.status(400).json({ success: false, error: '缺少必要参数' });
        }

        const result = await pool.query(`
            INSERT INTO iot_triggers 
            (name, type, enabled, condition_field, condition_operator, condition_value,
             analysis_engine, n8n_workflow_id, n8n_webhook_path, severity, auto_open_chat)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [name, type, enabled, conditionField, conditionOperator, conditionValue,
            analysisEngine, n8nWorkflowId || null, n8nWebhookPath || null, severity, autoOpenChat]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('❌ 创建触发器失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/iot-triggers/:id
 * 更新触发器
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, type, enabled,
            conditionField, conditionOperator, conditionValue,
            analysisEngine, n8nWorkflowId, n8nWebhookPath,
            severity, autoOpenChat
        } = req.body;

        const result = await pool.query(`
            UPDATE iot_triggers SET
                name = COALESCE($1, name),
                type = COALESCE($2, type),
                enabled = COALESCE($3, enabled),
                condition_field = COALESCE($4, condition_field),
                condition_operator = COALESCE($5, condition_operator),
                condition_value = COALESCE($6, condition_value),
                analysis_engine = COALESCE($7, analysis_engine),
                n8n_workflow_id = $8,
                n8n_webhook_path = $9,
                severity = COALESCE($10, severity),
                auto_open_chat = COALESCE($11, auto_open_chat),
                updated_at = NOW()
            WHERE id = $12
            RETURNING *
        `, [name, type, enabled, conditionField, conditionOperator, conditionValue,
            analysisEngine, n8nWorkflowId, n8nWebhookPath, severity, autoOpenChat, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: '触发器不存在' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('❌ 更新触发器失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/iot-triggers/:id
 * 删除触发器
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM iot_triggers WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: '触发器不存在' });
        }

        res.json({ success: true, message: '触发器已删除' });
    } catch (error) {
        console.error('❌ 删除触发器失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/iot-triggers/n8n/workflows
 * 从 n8n 获取可用工作流列表
 */
router.get('/n8n/workflows', async (req, res) => {
    try {
        const n8nBaseUrl = await getConfig('N8N_WEBHOOK_URL', '');
        const n8nApiKey = await getConfig('N8N_API_KEY', '');

        if (!n8nBaseUrl) {
            return res.status(400).json({ success: false, error: '未配置 n8n 服务器地址' });
        }

        if (!n8nApiKey) {
            return res.status(400).json({ success: false, error: '未配置 n8n API Key' });
        }

        // 调用 n8n API 获取工作流列表
        const apiUrl = `${n8nBaseUrl.replace(/\/$/, '')}/api/v1/workflows?active=true`;
        console.log(`📡 获取 n8n 工作流列表: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'X-N8N-API-KEY': n8nApiKey,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ n8n API 调用失败:', response.status, errorText);
            return res.status(response.status).json({
                success: false,
                error: `n8n API 错误: ${response.status}`
            });
        }

        const result = await response.json();
        const workflows = result.data || [];

        // 过滤出包含 Webhook 触发器的工作流，并提取 webhook 路径
        const webhookWorkflows = workflows
            .filter(w => w.nodes?.some(n => n.type === 'n8n-nodes-base.webhook'))
            .map(w => {
                // 提取 webhook 路径
                const webhookNode = w.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
                const webhookPath = webhookNode?.parameters?.path || '';
                return {
                    id: w.id,
                    name: w.name,
                    active: w.active,
                    webhookPath: webhookPath ? `/webhook/${webhookPath}` : null
                };
            });

        console.log(`✅ 获取到 ${webhookWorkflows.length} 个包含 Webhook 的工作流`);
        res.json({ success: true, data: webhookWorkflows });
    } catch (error) {
        console.error('❌ 获取 n8n 工作流失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 触发器类型注册表
 */
export const TRIGGER_TYPES = {
    temperature: {
        name: '温度监控',
        fields: ['temperature'],
        operators: ['gt', 'lt', 'gte', 'lte'],
        unit: '°C'
    },
    humidity: {
        name: '湿度监控',
        fields: ['humidity'],
        operators: ['gt', 'lt', 'gte', 'lte'],
        unit: '%'
    },
    energy: {
        name: '能耗监控',
        fields: ['power', 'current', 'voltage'],
        operators: ['gt', 'lt', 'gte', 'lte'],
        unit: 'kW'
    }
};

/**
 * GET /api/iot-triggers/types
 * 获取支持的触发器类型
 */
router.get('/types', (req, res) => {
    res.json({ success: true, data: TRIGGER_TYPES });
});

export default router;
