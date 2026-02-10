/**
 * 认证 API 服务
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

export interface LoginResponse {
    success: boolean;
    data?: {
        user: {
            id: number;
            email: string;
            name: string;
            avatarUrl?: string;
            roles: string[];
            permissions?: string[];
        };
        accessToken: string;
        expiresIn: string;
    };
    message?: string;
    error?: string;
}

export interface RegisterResponse {
    success: boolean;
    data?: {
        id: number;
        email: string;
        name: string;
        roles: string[];
    };
    message?: string;
    error?: string;
}

/**
 * 用户登录
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
    try {
        const response = await axios.post(`${API_BASE}/api/v1/auth/login`, {
            email,
            password
        }, {
            withCredentials: true
        });
        return response.data;
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || '登录失败，请检查网络连接'
        };
    }
}

/**
 * 用户注册
 */
export async function register(email: string, password: string, name: string): Promise<RegisterResponse> {
    try {
        const response = await axios.post(`${API_BASE}/api/v1/auth/register`, {
            email,
            password,
            name
        });
        return response.data;
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || '注册失败，请检查网络连接'
        };
    }
}

/**
 * 刷新令牌
 */
export async function refreshToken(): Promise<LoginResponse> {
    try {
        const response = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {}, {
            withCredentials: true
        });
        return response.data;
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || '令牌刷新失败'
        };
    }
}

/**
 * 登出
 */
export async function logout(): Promise<{ success: boolean }> {
    try {
        await axios.post(`${API_BASE}/api/v1/auth/logout`, {}, {
            withCredentials: true
        });
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

export async function getCurrentUser(token: string): Promise<LoginResponse> {
    try {
        const response = await axios.get(`${API_BASE}/api/v1/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || '获取用户信息失败'
        };
    }
}

/**
 * 更新用户信息
 */
export async function updateProfile(data: { name?: string }): Promise<{ success: boolean; error?: string }> {
    const token = localStorage.getItem('accessToken');
    try {
        await axios.put(`${API_BASE}/api/v1/auth/me`, data, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || '更新失败'
        };
    }
}

/**
 * 上传头像
 */
export async function uploadAvatar(blob: Blob): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.png');

    try {
        const response = await axios.post(`${API_BASE}/api/v1/auth/avatar`, formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
        return { success: true, avatarUrl: response.data.data?.avatarUrl };
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || '上传失败'
        };
    }
}

/**
 * 修改密码
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const token = localStorage.getItem('accessToken');
    try {
        await axios.post(`${API_BASE}/api/v1/auth/change-password`, {
            currentPassword,
            newPassword
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            withCredentials: true
        });
        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data?.error || '修改密码失败'
        };
    }
}
