/**
 * 认证路由
 * 登录、注册、OAuth、令牌刷新
 */
import { Router } from 'express';
import authService from '../../services/auth-service.js';
import * as userModel from '../../models/user.js';
import { authenticate } from '../../middleware/auth.js';
import config from '../../config/index.js';

const router = Router();

/**
 * 用户注册
 * POST /api/v1/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: '请提供邮箱、密码和姓名',
            });
        }

        const result = await authService.register({ email, password, name });

        res.status(201).json({
            success: true,
            data: result,
            message: '注册成功',
        });
    } catch (error) {
        console.error('注册失败:', error.message);
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 用户登录
 * POST /api/v1/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: '请提供邮箱和密码',
            });
        }

        const result = await authService.login({ email, password });

        // 设置刷新令牌到 HttpOnly Cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: config.server.env === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
        });

        res.json({
            success: true,
            data: {
                user: result.user,
                accessToken: result.accessToken,
                expiresIn: result.expiresIn,
            },
            message: '登录成功',
        });
    } catch (error) {
        console.error('登录失败:', error.message);
        res.status(401).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 刷新令牌
 * POST /api/v1/auth/refresh
 */
router.post('/refresh', async (req, res) => {
    try {
        // 从 Cookie 或请求体获取刷新令牌
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: '请提供刷新令牌',
            });
        }

        const result = await authService.refreshAccessToken(refreshToken);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('令牌刷新失败:', error.message);
        res.status(401).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 登出
 * POST /api/v1/auth/logout
 */
router.post('/logout', authenticate, async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
        await authService.logout(req.user.sub, refreshToken);

        // 清除 Cookie
        res.clearCookie('refreshToken');

        res.json({
            success: true,
            message: '已登出',
        });
    } catch (error) {
        console.error('登出失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 获取当前用户信息
 * GET /api/v1/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                id: req.user.sub,
                email: req.user.email,
                name: req.user.name,
                roles: req.user.roles,
                permissions: req.user.permissions,
            },
        });
    } catch (error) {
        console.error('获取用户信息失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 更新当前用户信息
 * PUT /api/v1/auth/me
 */
router.put('/me', authenticate, async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.sub;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: '请提供姓名',
            });
        }

        await userModel.updateUser(userId, { name });

        res.json({
            success: true,
            message: '用户信息已更新',
        });
    } catch (error) {
        console.error('更新用户信息失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 修改密码
 * POST /api/v1/auth/change-password
 */
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                error: '请提供新密码',
            });
        }

        await authService.changePassword(req.user.sub, { currentPassword, newPassword });

        // 清除刷新令牌 Cookie
        res.clearCookie('refreshToken');

        res.json({
            success: true,
            message: '密码修改成功，请重新登录',
        });
    } catch (error) {
        console.error('修改密码失败:', error.message);
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

// ========================================
// OAuth 路由（预留）
// ========================================

/**
 * Google OAuth 入口
 * GET /api/v1/auth/oauth/google
 */
router.get('/oauth/google', (req, res) => {
    // TODO: 实现 Google OAuth
    res.status(501).json({
        success: false,
        error: 'Google OAuth 尚未实现',
    });
});

/**
 * Google OAuth 回调
 * GET /api/v1/auth/oauth/google/callback
 */
router.get('/oauth/google/callback', (req, res) => {
    // TODO: 实现 Google OAuth 回调
    res.status(501).json({
        success: false,
        error: 'Google OAuth 尚未实现',
    });
});

/**
 * 微信 OAuth 入口
 * GET /api/v1/auth/oauth/wechat
 */
router.get('/oauth/wechat', (req, res) => {
    res.status(501).json({
        success: false,
        error: '微信 OAuth 尚未实现',
    });
});

/**
 * 微信 OAuth 回调
 * GET /api/v1/auth/oauth/wechat/callback
 */
router.get('/oauth/wechat/callback', (req, res) => {
    res.status(501).json({
        success: false,
        error: '微信 OAuth 尚未实现',
    });
});

export default router;
