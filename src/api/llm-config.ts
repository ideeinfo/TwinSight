/**
 * LLM 配置 API 模块
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
const API_V1 = `${API_BASE_URL}/api/v1`;

/** 获取请求头 */
function getHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
        'Content-Type': 'application/json'
    };
    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

/** LLM 提供商信息 */
export interface LLMProvider {
    id: string;
    name: string;
    baseUrl: string;
}

/** LLM 配置信息 */
export interface LLMConfig {
    provider: string;
    hasApiKey: boolean;
    apiKeyMasked: string;
    baseUrl: string;
    model: string;
}

/** LLM 模型信息 */
export interface LLMModel {
    id: string;
    name: string;
    owned_by: string;
}

/**
 * 获取预置的 LLM 提供商列表
 */
export async function getLLMProviders(): Promise<LLMProvider[]> {
    const response = await fetch(`${API_V1}/system-config/llm/providers`, {
        headers: getHeaders()
    });
    if (!response.ok) throw new Error('获取提供商列表失败');
    const data = await response.json();
    return data.data;
}

/**
 * 获取当前 LLM 配置
 */
export async function getLLMConfig(): Promise<LLMConfig> {
    const response = await fetch(`${API_V1}/system-config/llm`, {
        headers: getHeaders()
    });
    if (!response.ok) throw new Error('获取配置失败');
    const data = await response.json();
    return data.data;
}

/**
 * 更新 LLM 配置
 */
export async function updateLLMConfig(config: Partial<{
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
}>): Promise<void> {
    const response = await fetch(`${API_V1}/system-config/llm`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('更新配置失败');
}

/**
 * 获取模型列表
 */
export async function fetchLLMModels(
    provider: string,
    apiKey: string,
    baseUrl: string
): Promise<LLMModel[]> {
    const response = await fetch(`${API_V1}/system-config/llm/models`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ provider, apiKey, baseUrl })
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '获取模型列表失败');
    }
    const data = await response.json();
    return data.data;
}

/**
 * 测试 LLM 连接
 */
export async function testLLMConnection(
    provider: string,
    apiKey: string,
    baseUrl: string,
    model: string
): Promise<{ success: boolean; message: string; response?: string }> {
    const response = await fetch(`${API_V1}/system-config/llm/test`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ provider, apiKey, baseUrl, model })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || '连接测试失败');
    }
    return data;
}
