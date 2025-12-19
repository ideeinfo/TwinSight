/**
 * 限流中间件
 * 防止 API 滥用
 */

// 简单的内存限流实现
const requestCounts = new Map();
const WINDOW_MS = 60 * 1000; // 1 分钟
const MAX_REQUESTS = 100; // 每分钟最大请求数

/**
 * 清理过期记录
 */
const cleanup = () => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.startTime > WINDOW_MS) {
            requestCounts.delete(key);
        }
    }
};

// 定期清理
setInterval(cleanup, WINDOW_MS);

/**
 * 限流中间件
 * @param {object} options - 配置选项
 * @param {number} options.windowMs - 时间窗口（毫秒）
 * @param {number} options.max - 最大请求数
 * @param {string} options.message - 超限时的错误消息
 */
export const rateLimit = (options = {}) => {
    const windowMs = options.windowMs || WINDOW_MS;
    const max = options.max || MAX_REQUESTS;
    const message = options.message || '请求过于频繁，请稍后再试';

    return (req, res, next) => {
        // 生成客户端标识（IP + 用户ID）
        const clientId = req.user?.id
            ? `user:${req.user.id}`
            : `ip:${req.ip || req.connection.remoteAddress}`;

        const now = Date.now();
        const clientData = requestCounts.get(clientId);

        if (!clientData || now - clientData.startTime > windowMs) {
            // 新的时间窗口
            requestCounts.set(clientId, {
                startTime: now,
                count: 1,
            });
            return next();
        }

        // 检查是否超限
        if (clientData.count >= max) {
            return res.status(429).json({
                success: false,
                error: message,
                retryAfter: Math.ceil((clientData.startTime + windowMs - now) / 1000),
            });
        }

        // 增加计数
        clientData.count++;
        next();
    };
};

/**
 * 针对敏感操作的严格限流
 */
export const strictRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 分钟
    max: 10, // 最多 10 次
    message: '操作过于频繁，请 1 分钟后再试',
});

/**
 * 针对登录的限流
 */
export const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 5, // 最多 5 次
    message: '登录尝试过多，请 15 分钟后再试',
});

export default {
    rateLimit,
    strictRateLimit,
    loginRateLimit,
};
