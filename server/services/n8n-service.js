/**
 * n8n Webhook 服务
 * 用于在发生事件（如温度报警）时触发 n8n 工作流
 */

// n8n Webhook URL（需要在 n8n 中创建 Webhook 节点后获取）
import { server } from '../config/index.js';
import { getConfig, getApiBaseUrl } from './config-service.js';

/**
 * 计算告警严重程度
 */
function calculateSeverity(alertData) {
    const temp = alertData.temperature;
    const threshold = alertData.threshold;
    const alertType = alertData.alertType || 'high';

    if (alertType === 'high') {
        // 高温告警：超过阈值5度为严重
        return temp >= threshold + 5 ? 'critical' : 'warning';
    } else {
        // 低温告警：低于阈值5度为严重
        return temp <= threshold - 5 ? 'critical' : 'warning';
    }
}

/**
 * 触发温度报警工作流
 * @param {Object} alertData - 报警数据
 * @param {string} alertData.roomCode - 房间编码
 * @param {string} alertData.roomName - 房间名称
 * @param {number} alertData.temperature - 当前温度
 * @param {number} alertData.threshold - 阈值温度
 * @param {string} alertData.timestamp - 报警时间
 * @param {number} alertData.fileId - 关联的模型文件ID
 * @param {string} [webhookPath] - 可选：自定义 Webhook 路径 (覆盖默认)
 */
export async function triggerTemperatureAlert(alertData, webhookPath = '/webhook/temperature-alert') {
    const n8nBaseUrl = await getConfig('N8N_WEBHOOK_URL', '');
    // const webhookPath = '/webhook/temperature-alert'; // Used default parameter instead

    try {
        const payload = {
            eventType: 'temperature_alert',
            roomCode: alertData.roomCode,
            roomName: alertData.roomName,
            temperature: alertData.temperature,
            threshold: alertData.threshold,
            alertType: alertData.alertType || 'high',
            timestamp: alertData.timestamp || new Date().toISOString(),
            fileId: alertData.fileId,
            severity: calculateSeverity(alertData),
            apiBaseUrl: await getApiBaseUrl(),
            metadata: {
                source: 'twinsight',
                version: '1.0',
            }
        };


        const response = await fetch(`${n8nBaseUrl}${webhookPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error('❌ n8n Webhook 调用失败:', response.status, await response.text());
            return { success: false, error: `HTTP ${response.status}` };
        }

        const result = await response.json().catch(() => ({}));
        console.log('✅ 温度报警已触发 n8n 工作流:', alertData.roomCode);
        return { success: true, result };
    } catch (error) {
        console.error('❌ n8n Webhook 调用异常:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 触发手动分析请求工作流
 * @param {Object} analysisRequest - 分析请求
 * @param {string} analysisRequest.type - 分析类型: 'asset' | 'room'
 * @param {Object} analysisRequest.target - 目标对象(资产或房间)
 * @param {string} analysisRequest.question - 用户问题(可选)
 * @param {number} analysisRequest.fileId - 关联的模型文件ID
 */
export async function triggerManualAnalysis(analysisRequest) {
    const n8nBaseUrl = await getConfig('N8N_WEBHOOK_URL', '');
    const webhookPath = '/webhook/manual-analysis';

    try {
        const response = await fetch(`${n8nBaseUrl}${webhookPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventType: 'manual_analysis',
                data: {
                    type: analysisRequest.type,
                    target: analysisRequest.target,
                    question: analysisRequest.question || '',
                    fileId: analysisRequest.fileId,
                    timestamp: new Date().toISOString(),
                    apiBaseUrl: server.baseUrl,

                },
                metadata: {
                    source: 'twinsight',
                    version: '1.0',
                }
            }),
        });

        if (!response.ok) {
            console.error('❌ n8n 分析请求失败:', response.status, await response.text());
            return { success: false, error: `HTTP ${response.status}` };
        }

        const result = await response.json().catch(() => ({}));
        console.log('✅ 手动分析请求已触发 n8n 工作流');
        return { success: true, result };
    } catch (error) {
        console.error('❌ n8n 分析请求异常:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 检查 n8n 服务是否可用
 */
export async function checkN8nHealth() {
    try {
        const n8nBaseUrl = await getConfig('N8N_WEBHOOK_URL', '');
        const response = await fetch(`${n8nBaseUrl}/healthz`, {
            method: 'GET',
            timeout: 5000,
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

export default {
    triggerTemperatureAlert,
    triggerManualAnalysis,
    checkN8nHealth,
};
