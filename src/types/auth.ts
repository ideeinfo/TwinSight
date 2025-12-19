/**
 * 认证相关类型定义
 */

export interface User {
    id: number;
    username: string;
    email: string;
    status: 'active' | 'inactive' | 'suspended';
    createdAt: string;
    updatedAt?: string;
}

export interface Role {
    id: number;
    name: string;
    description?: string;
    permissions: Permission[];
}

export interface Permission {
    id: number;
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    user: User;
    token: string;
    refreshToken: string;
    expiresIn: number;
}

export interface TokenPayload {
    userId: number;
    username: string;
    roles: string[];
    iat: number;
    exp: number;
}
