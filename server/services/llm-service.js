/**
 * 通用 LLM 服务
 * 使用 OpenAI 兼容格式调用配置的 LLM 提供商
 */

import { getConfig } from './config-service.js';

/**
 * 获取 LLM 配置
 */
async function getLLMConfig() {
    const provider = await getConfig('LLM_PROVIDER', 'gemini');
    const apiKey = await getConfig('LLM_API_KEY', '');
    const baseUrl = await getConfig('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/');
    const model = await getConfig('LLM_MODEL', 'gemini-2.0-flash');

    return { provider, apiKey, baseUrl, model };
}

/**
 * 调用 LLM 进行对话
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userMessage - 用户消息
 * @param {Object} options - 可选配置
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export async function chat(systemPrompt, userMessage, options = {}) {
    try {
        const config = await getLLMConfig();

        if (!config.apiKey) {
            console.error('❌ LLM_API_KEY 未配置，请在系统配置中设置');
            return { success: false, error: 'LLM API Key 未配置，请在 AI 设置中配置' };
        }

        const chatUrl = config.baseUrl.replace(/\/$/, '') + '/chat/completions';

        console.log(`🤖 调用 LLM API: ${config.provider}, 模型: ${config.model}`);

        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: userMessage });

        const response = await fetch(chatUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 2048
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ LLM API 调用失败:', response.status, errorText);
            return { success: false, error: `LLM API error: ${response.status}` };
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || '';

        console.log(`✅ LLM 响应完成，长度: ${content.length} 字符`);

        return { success: true, content };
    } catch (error) {
        console.error('❌ LLM API 调用异常:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 调用 LLM 进行温度异常分析
 * @param {Object} alertData - 报警数据
 */
export async function analyzeTemperatureAlert(alertData) {
    const { roomCode, roomName, temperature, threshold, alertType = 'high' } = alertData;

    const isHighTemp = alertType === 'high';
    const alertTypeText = isHighTemp ? '高温' : '低温';

    // 构建 Prompt
    const prompt = `你是一个建筑设备运维专家。系统检测到以下${alertTypeText}异常：

【报警信息】
- 位置: ${roomName} (${roomCode})
- 当前温度: ${temperature}°C
- ${isHighTemp ? '高温阈值' : '低温阈值'}: ${threshold}°C
- 报警类型: ${alertTypeText}
- 时间: ${new Date().toISOString()}

请针对${alertTypeText}异常提供专业分析报告，格式如下：

## 原因分析
[列出3-5个可能导致${alertTypeText}异常的原因，${isHighTemp ? '例如：冷却系统故障、过载运行、散热不良等' : '例如：供暖系统故障、保温层损坏、门窗密封不良等'}]

## 处置方案
[分步骤列出针对${alertTypeText}的建议处置措施]

## 预防建议
[列出预防此类${alertTypeText}问题的措施]

注意：直接给出专业建议，不要追问更多信息。用中文回答。`;

    const result = await chat('', prompt);

    if (!result.success) {
        return result;
    }

    return {
        success: true,
        analysis: result.content,
        alert: {
            roomCode,
            roomName,
            temperature,
            threshold,
            alertType,
            alertTypeText
        }
    };
}

export default {
    chat,
    analyzeTemperatureAlert,
};
