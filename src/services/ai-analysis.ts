/**
 * AI 分析服务
 * 调用后端 API 触发 n8n 工作流进行智能分析
 */

import { useAuthStore } from '../stores/auth';

import { API_BASE_URL } from '../utils/apiBase';

const API_BASE = API_BASE_URL;

// Helper to get auth headers
const getHeaders = (contentType?: string) => {
    const authStore = useAuthStore();
    const headers: Record<string, string> = {};
    if (authStore.token) {
        headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    return headers;
};

/**
 * 触发温度报警分析
 * @param alertData 报警数据
 * @returns 分析结果
 */
export async function triggerTemperatureAlert(alertData: {
    roomCode: string;
    roomName: string;
    temperature: number;
    threshold?: number;
    alertType?: 'high' | 'low'; // 报警类型：high=高温, low=低温
    fileId?: number;
}): Promise<{
    success: boolean;
    analysis?: string;
    sources?: Array<{
        name: string;
        fileName?: string;
        url?: string;
        downloadUrl?: string;
        fileType?: string;
        matchedBy?: string;
        isInternal?: boolean;
        documentId?: number;
    }>;
    error?: string;
}> {
    try {
        const response = await fetch(`${API_BASE}/api/ai/temperature-alert`, {
            method: 'POST',
            headers: getHeaders('application/json'),
            body: JSON.stringify({
                roomCode: alertData.roomCode,
                roomName: alertData.roomName,
                temperature: alertData.temperature,
                // 根据报警类型设置默认阈值：高温28°C，低温0°C
                threshold: alertData.threshold || (alertData.alertType === 'low' ? 0 : 28),
                alertType: alertData.alertType || 'high',
                fileId: alertData.fileId,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        console.log('📥 后端返回数据:', result);

        // 解析 Gemini 返回的分析文本
        let analysisText = '';
        if (result.data?.analysis) {
            const analysis = result.data.analysis;
            if (typeof analysis === 'string') {
                analysisText = analysis;
            } else if (analysis.candidates?.[0]?.content?.parts?.[0]?.text) {
                analysisText = analysis.candidates[0].content.parts[0].text;
            }
        }

        console.log(`📊 解析的分析文本长度: ${analysisText.length} 字符`);

        return {
            success: result.success,
            analysis: analysisText,
            sources: result.data?.sources || [],
            error: result.error,
        };
    } catch (error: any) {
        console.error('❌ AI 分析请求失败:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * 请求手动 AI 分析
 * @param type 分析类型：'asset' | 'room'
 * @param target 目标对象
 * @param question 可选问题
 * @param fileId 文件ID
 */
export async function requestAnalysis(
    type: 'asset' | 'room',
    target: any,
    question?: string,
    fileId?: number
): Promise<{
    success: boolean;
    analysis?: string;
    error?: string;
}> {
    try {
        const response = await fetch(`${API_BASE}/api/ai/analyze`, {
            method: 'POST',
            headers: getHeaders('application/json'),
            body: JSON.stringify({
                type,
                target,
                question,
                fileId,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        // 解析分析文本
        let analysisText = '';
        if (result.data?.analysis) {
            const analysis = result.data.analysis;
            if (typeof analysis === 'string') {
                analysisText = analysis;
            } else if (analysis.candidates?.[0]?.content?.parts?.[0]?.text) {
                analysisText = analysis.candidates[0].content.parts[0].text;
            }
        }

        return {
            success: result.success,
            analysis: analysisText,
            error: result.error,
        };
    } catch (error: any) {
        console.error('❌ 手动分析请求失败:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * 检查 AI 服务状态
 */
export async function checkAIHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/api/ai/health`, { headers: getHeaders() });
        const result = await response.json();
        return result.success && result.data?.n8n === 'connected';
    } catch {
        return false;
    }
}

export default {
    triggerTemperatureAlert,
    requestAnalysis,
    checkAIHealth,
};
