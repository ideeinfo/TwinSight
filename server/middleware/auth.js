/**
 * 认证中间件
 * JWT 验证和权限检查
 */
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { hasPermission, ROLES } from '../config/auth.js';

/**
 * 验证 JWT Token
 */
// 1. 优先检查 API Key（支持内部服务或特定路由）
const apiKey = req.headers['x-api-key'] || req.query.api_key;
if (apiKey && apiKey === config.server.apiKey) {
    req.user = {
        id: -1,
        username: 'system',
        roles: [ROLES.ADMIN],
    };
    req.permissions = ['*'];
    return next();
}

// 开发模式下如果没有提供 Token，则给与访客权限（临时）
if (config.server.env === 'development' && !req.headers.authorization) {
    req.user = {
        id: 0,
        username: 'guest',
        roles: [ROLES.ADMIN], // 开发模式给管理员权限
    };
    req.permissions = ['*'];
    return next();
}

const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
        success: false,
        error: '未提供认证令牌',
    });
}

const token = authHeader.replace('Bearer ', '');

try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;

    // 获取用户权限（未来从数据库获取）
    req.permissions = decoded.permissions || [];

    next();
} catch (error) {
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: '认证令牌已过期',
        });
    }
    return res.status(401).json({
        success: false,
        error: '无效的认证令牌',
    });
}
};

/**
 * 权限检查中间件
 * @param {string} permission - 所需权限
 */
export const authorize = (permission) => {
    return (req, res, next) => {


        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: '未认证',
            });
        }

        // 检查是否有通配符权限
        if (req.permissions.includes('*')) {
            return next();
        }

        // 检查具体权限
        if (!req.permissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                error: '无权执行此操作',
            });
        }

        next();
    };
};

/**
 * 可选认证中间件
 * 如果提供了 token 则验证，否则继续
 */
export const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        req.permissions = [];
        return next();
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = decoded;
        req.permissions = decoded.permissions || [];
    } catch (error) {
        req.user = null;
        req.permissions = [];
    }

    next();
};

export default {
    authenticate,
    authorize,
    optionalAuth,
};
