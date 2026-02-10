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
    avatarUrl?: string;
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
         * Admin 角色拥有所有权限
         */
        hasPermission: (state) => (permission: string): boolean => {
            // Admin 角色拥有所有权限
            if (state.user?.roles?.includes('admin')) {
                return true;
            }
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
         * 检查认证状态（恢复会话）
         */
        async checkAuth() {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                this.clearAuth();
                return;
            }

            // 导入服务 (避免循环依赖，动态导入或移到底部)
            // 这里假设可以直接导入，因为 store 和 service 依赖关系简单
            const { getCurrentUser } = await import('../services/auth');

            const result = await getCurrentUser(token);
            if (result.success && result.data) {
                // GET /me 返回的数据结构与 Login 不同，直接返回用户信息
                const userData = result.data as any;

                const userObj: User = {
                    id: userData.id,
                    username: userData.name, // 映射 API 的 name 到 store 的 username
                    email: userData.email,
                    roles: userData.roles,
                    avatarUrl: userData.avatarUrl
                };

                this.setAuth(userObj, token, userData.permissions);
            } else {
                this.clearAuth();
            }
        },

        /**
         * 设置认证信息
         */
        setAuth(user: User, token: string, permissions: string[] = []) {
            this.user = user;
            this.token = token;
            this.isAuthenticated = true;
            this.permissions = permissions;

            // 持久化 Token
            localStorage.setItem('accessToken', token);
        },

        /**
         * 清除认证信息
         */
        clearAuth() {
            this.user = null;
            this.token = null;
            this.isAuthenticated = false;
            this.permissions = [];

            // 清除 Token
            localStorage.removeItem('accessToken');
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
