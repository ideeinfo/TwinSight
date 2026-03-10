/**
 * M2M 服务间认证中间件
 * 
 * 校验 AI Hub -> TwinSight 的服务间调用令牌 (X-Service-Token)。
 * 同时支持用户 JWT 透传（通过现有的 authenticate 中间件处理）。
 * 
 * 使用方式：
 *   import { serviceAuth } from '../middleware/service-auth.js';
 *   router.use(serviceAuth);
 */

import config from '../config/index.js';

// 从环境变量获取允许的服务令牌列表（逗号分隔支持多个）
const ALLOWED_SERVICE_TOKENS = (process.env.SERVICE_TOKENS || process.env.SERVICE_TOKEN || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

/**
 * 服务间认证中间件
 * 校验请求头中的 X-Service-Token
 * 
 * 开发模式下如果未配置 SERVICE_TOKEN 则打印警告并放行
 */
export const serviceAuth = (req, res, next) => {
    const serviceToken = req.headers['x-service-token'];

    // 开发模式下，如果没有配置任何服务令牌，则打印警告并放行
    if (ALLOWED_SERVICE_TOKENS.length === 0) {
        if (config.server.env === 'development') {
            console.warn('⚠️  [service-auth] SERVICE_TOKEN 未配置，开发模式下放行。请在 .env 中设置 SERVICE_TOKEN。');
            return next();
        }
        // 生产环境下必须配置
        return res.status(500).json({
            success: false,
            error: {
                code: 'SERVICE_AUTH_NOT_CONFIGURED',
                message: 'Service authentication is not configured on the server',
                request_id: req.headers['x-request-id'] || null
            }
        });
    }

    // 缺少 X-Service-Token
    if (!serviceToken) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'MISSING_SERVICE_TOKEN',
                message: 'X-Service-Token header is required for service-to-service calls',
                request_id: req.headers['x-request-id'] || null
            }
        });
    }

    // X-Service-Token 不在白名单中
    if (!ALLOWED_SERVICE_TOKENS.includes(serviceToken)) {
        return res.status(403).json({
            success: false,
            error: {
                code: 'INVALID_SERVICE_TOKEN',
                message: 'The provided service token is not authorized',
                request_id: req.headers['x-request-id'] || null
            }
        });
    }

    // 在 req 上标记为服务间调用
    req.isServiceCall = true;
    next();
};

export default serviceAuth;
