/**
 * Gemini AI 服务
 * 直接调用 Google Gemini API，不依赖 n8n
 */

import { getGeminiApiKey } from './config-service.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * 调用 Gemini API 进行温度异常分析
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

    try {
        const GEMINI_API_KEY = await getGeminiApiKey();

        if (!GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY 未配置，请在系统配置中设置');
            return { success: false, error: 'GEMINI_API_KEY not configured. Please set it in system config.' };
        }

        console.log(`🤖 调用 Gemini API 分析${alertTypeText}异常...`);

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API 调用失败:', response.status, errorText);
            return { success: false, error: `Gemini API error: ${response.status}` };
        }

        const result = await response.json();

        // 提取分析文本
        let analysisText = '';
        if (result.candidates && result.candidates[0]) {
            const content = result.candidates[0].content;
            if (content && content.parts && content.parts[0]) {
                analysisText = content.parts[0].text;
            }
        }

        console.log(`✅ Gemini 分析完成，响应长度: ${analysisText.length} 字符`);

        return {
            success: true,
            analysis: analysisText,
            alert: {
                roomCode,
                roomName,
                temperature,
                threshold,
                alertType,
                alertTypeText
            }
        };
    } catch (error) {
        console.error('❌ Gemini API 调用异常:', error.message);
        return { success: false, error: error.message };
    }
}

export default {
    analyzeTemperatureAlert,
};
