import { query } from '../db/index.js';
import * as n8nService from './n8n-service.js';
import * as aiService from './ai-service.js';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'ai-debug.log');

function logToFile(message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [IOT-TRIGGER] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
        // ignore
    }
}


/**
 * 评估 IoT 触发器
 * @param {Object} data - 传感器数据 (e.g. { temperature: 28, humidity: 60 })
 * @param {Object} context - 上下文 (fileId, spaceCode)
 */
export async function evaluateTriggers(data, context) {
    const { fileId, spaceCode } = context;
    console.log(`🔍 [Trigger] evaluateTriggers called for space ${spaceCode} with data:`, JSON.stringify(data));
    logToFile(`evaluateTriggers called for space ${spaceCode}`, data);

    // 1. 获取所有启用的触发器
    // TODO: 考虑添加缓存以提高性能
    const result = await query('SELECT * FROM iot_triggers WHERE enabled = true');
    const triggers = result.rows;

    console.log(`🔍 [Trigger] Found ${triggers.length} active triggers in DB.`);
    logToFile(`Found ${triggers.length} active triggers in DB.`);

    if (triggers.length === 0) return;

    for (const trigger of triggers) {
        try {
            // 2. 检查监控字段是否存在于数据中
            const field = trigger.condition_field;
            if (data[field] === undefined) continue;

            const value = Number(data[field]);
            const threshold = Number(trigger.condition_value);
            const operator = trigger.condition_operator;

            // 3. 评估条件
            let isMatch = false;
            switch (operator) {
                case 'gt': isMatch = value > threshold; break;
                case 'lt': isMatch = value < threshold; break;
                case 'eq': isMatch = value === threshold; break;
                case 'gte': isMatch = value >= threshold; break;
                case 'lte': isMatch = value <= threshold; break;
            }

            if (isMatch) {
                console.log(`✅ [Trigger] Matched: ${trigger.name} (${field} ${operator} ${threshold}, current: ${value})`);
                await executeTriggerAction(trigger, {
                    ...context,
                    value,
                    threshold,
                    field
                });
            }
        } catch (err) {
            console.error(`❌ [Trigger] Error evaluating trigger ${trigger.name}:`, err);
        }
    }
}

/**
 * 执行触发器动作
 */
async function executeTriggerAction(trigger, context) {
    const { fileId, spaceCode, value, threshold, field } = context;
    const alertData = {
        roomCode: spaceCode,
        roomName: spaceCode, // 暂时使用 code 作为 name，理想情况下应查询 database
        temperature: value, // 假设目前主要是温度报警，通用化需要调整 payload 结构
        threshold: threshold,
        alertType: trigger.condition_operator === 'gt' || trigger.condition_operator === 'gte' ? 'high' : 'low',
        fileId: fileId,
        timestamp: new Date().toISOString()
    };

    if (trigger.analysis_engine === 'n8n') {
        // n8n 引擎
        const webhookPath = trigger.n8n_webhook_path;
        if (webhookPath) {
            console.log(`🚀 [Trigger] Invoking n8n webhook: ${webhookPath}`);
            await n8nService.triggerTemperatureAlert(alertData, webhookPath);
        } else {
            console.warn(`⚠️ [Trigger] n8n engine selected but no webhook path configured for trigger ${trigger.name}`);
        }
    } else {
        // 内置 AI 引擎 (回退到默认逻辑)
        console.log(`🤖 [Trigger] Invoking builtin AI analysis`);
        // aiService.processTemperatureAlert 内部会根据 USE_N8N_WORKFLOW 环境变量决定，
        // 但这里我们已经在触发器层级做了分流。
        // 如果是 builtin，我们需要直接调用 AI 分析或者发送默认通知。
        // 目前 aiService.processTemperatureAlert 耦合了 n8n/direct 逻辑，
        // 我们这里复用它，但它可能会再次尝试调用 n8n 如果 env 没设好。
        // 暂时假设 builtin = direct analysis via ai-service
        await aiService.processTemperatureAlert(alertData);
    }
}

// 移除默认导出，统一使用命名导出
