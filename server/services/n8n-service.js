/**
 * n8n Webhook 服务
 * 用于在发生事件（如温度报警）时触发 n8n 工作流
 */

// n8n Webhook URL（需要在 n8n 中创建 Webhook 节点后获取）
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';

/**
 * 触发温度报警工作流
 * @param {Object} alertData - 报警数据
 * @param {string} alertData.roomCode - 房间编码
 * @param {string} alertData.roomName - 房间名称
 * @param {number} alertData.temperature - 当前温度
 * @param {number} alertData.threshold - 阈值温度
 * @param {string} alertData.timestamp - 报警时间
 * @param {number} alertData.fileId - 关联的模型文件ID
 */
export async function triggerTemperatureAlert(alertData) {
    const webhookPath = process.env.N8N_TEMPERATURE_ALERT_WEBHOOK || '/webhook/temperature-alert';

    try {
        const response = await fetch(`${N8N_BASE_URL}${webhookPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventType: 'temperature_alert',
                data: {
                    roomCode: alertData.roomCode,
                    roomName: alertData.roomName,
                    temperature: alertData.temperature,
                    threshold: alertData.threshold,
                    timestamp: alertData.timestamp || new Date().toISOString(),
                    fileId: alertData.fileId,
                    severity: alertData.temperature >= alertData.threshold + 5 ? 'critical' : 'warning',
                },
                metadata: {
                    source: 'tandem-demo',
                    version: '1.0',
                }
            }),
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
    const webhookPath = process.env.N8N_MANUAL_ANALYSIS_WEBHOOK || '/webhook/manual-analysis';

    try {
        const response = await fetch(`${N8N_BASE_URL}${webhookPath}`, {
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
                },
                metadata: {
                    source: 'tandem-demo',
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
        const response = await fetch(`${N8N_BASE_URL}/healthz`, {
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
