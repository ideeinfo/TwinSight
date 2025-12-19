/**
 * 认证状态管理
 * 为未来用户认证系统做准备
 */
import { defineStore } from 'pinia';

export interface User {
    id: number;
    username: string;
    email: string;
    roles: string[];
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    permissions: string[];
}

export const useAuthStore = defineStore('auth', {
    state: (): AuthState => ({
        user: null,
        token: null,
        isAuthenticated: false,
        permissions: [],
    }),

    getters: {
        /**
         * 检查用户是否有指定权限
         */
        hasPermission: (state) => (permission: string): boolean => {
            return state.permissions.includes(permission);
        },

        /**
         * 检查用户是否有指定角色
         */
        hasRole: (state) => (role: string): boolean => {
            return state.user?.roles?.includes(role) ?? false;
        },
    },

    actions: {
        /**
         * 设置认证信息
         */
        setAuth(user: User, token: string, permissions: string[] = []) {
            this.user = user;
            this.token = token;
            this.isAuthenticated = true;
            this.permissions = permissions;
        },

        /**
         * 清除认证信息
         */
        clearAuth() {
            this.user = null;
            this.token = null;
            this.isAuthenticated = false;
            this.permissions = [];
        },

        /**
         * 临时模式：跳过认证（当前默认行为）
         */
        enableGuestMode() {
            this.isAuthenticated = true;
            this.permissions = ['*']; // 临时给予全部权限
        },
    },
});
