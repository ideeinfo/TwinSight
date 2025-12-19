/**
 * 统一错误处理中间件
 */
import config from '../config/index.js';

/**
 * 自定义 API 错误类
 */
export class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'ApiError';
    }

    static badRequest(message, details = null) {
        return new ApiError(400, message, details);
    }

    static unauthorized(message = '未授权') {
        return new ApiError(401, message);
    }

    static forbidden(message = '禁止访问') {
        return new ApiError(403, message);
    }

    static notFound(message = '资源不存在') {
        return new ApiError(404, message);
    }

    static conflict(message = '资源冲突') {
        return new ApiError(409, message);
    }

    static internal(message = '服务器内部错误') {
        return new ApiError(500, message);
    }
}

/**
 * 404 处理中间件
 */
export const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        error: `路径 ${req.originalUrl} 不存在`,
    });
};

/**
 * 全局错误处理中间件
 */
export const errorHandler = (err, req, res, next) => {
    // 打印错误日志
    console.error('❌ 错误:', err);

    // 已知的 API 错误
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
            details: err.details,
        });
    }

    // 数据库唯一约束错误
    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            error: '数据已存在',
            details: err.detail,
        });
    }

    // 数据库外键约束错误
    if (err.code === '23503') {
        return res.status(400).json({
            success: false,
            error: '关联数据不存在',
            details: err.detail,
        });
    }

    // JSON 解析错误
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: 'JSON 格式错误',
        });
    }

    // 开发模式返回详细错误信息
    if (config.server.env === 'development') {
        return res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack,
        });
    }

    // 生产模式隐藏错误详情
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
    });
};

export default {
    ApiError,
    notFoundHandler,
    errorHandler,
};
