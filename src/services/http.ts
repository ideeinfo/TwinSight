/**
 * HTTP 请求服务封装
 * 统一处理请求拦截、错误处理、认证等
 */
import type { ApiResponse } from '@/types/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * HTTP 请求选项
 */
interface RequestOptions extends RequestInit {
    params?: Record<string, any>;
    timeout?: number;
}

/**
 * 获取认证 Token（预留）
 */
function getAuthToken(): string | null {
    // 未来从 auth store 或 localStorage 获取
    return localStorage.getItem('auth_token');
}

/**
 * 构建请求 URL（包含查询参数）
 */
function buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, API_BASE);

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    return url.toString();
}

/**
 * 统一错误处理
 */
function handleError(error: any): never {
    if (error.name === 'AbortError') {
        throw new Error('请求超时');
    }
    throw error;
}

/**
 * 发送 HTTP 请求
 */
async function request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<ApiResponse<T>> {
    const { params, timeout = 30000, ...fetchOptions } = options;

    // 构建请求头
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
    };

    // 添加认证头（如果有 token）
    const token = getAuthToken();
    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // 创建超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(buildUrl(endpoint, params), {
            ...fetchOptions,
            headers,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 处理非 OK 响应
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        return handleError(error);
    }
}

/**
 * GET 请求
 */
export async function get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    options?: RequestOptions
): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { ...options, method: 'GET', params });
}

/**
 * POST 请求
 */
export async function post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
    });
}

/**
 * PUT 请求
 */
export async function put<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
        ...options,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
    });
}

/**
 * PATCH 请求
 */
export async function patch<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
        ...options,
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
    });
}

/**
 * DELETE 请求
 */
export async function del<T = any>(
    endpoint: string,
    options?: RequestOptions
): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
}

/**
 * 上传文件
 */
export async function uploadFile<T = any>(
    endpoint: string,
    file: File,
    fieldName = 'file',
    extraData?: Record<string, any>
): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(fieldName, file);

    if (extraData) {
        Object.entries(extraData).forEach(([key, value]) => {
            formData.append(key, String(value));
        });
    }

    const token = getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(buildUrl(endpoint), {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `上传失败: ${response.status}`);
    }

    return await response.json();
}

export default {
    get,
    post,
    put,
    patch,
    delete: del,
    uploadFile,
};
