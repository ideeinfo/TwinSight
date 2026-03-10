/**
 * 作用域守卫中间件
 * 
 * 校验 Atomic API 调用的作用域参数：
 * - X-Project-Id（必填）
 * - X-Facility-Id（可选，预留）
 * - X-File-Id（可选）
 * 
 * 将解析后的作用域信息挂载到 req.scope 上，供后续路由使用。
 * 
 * 使用方式：
 *   import { scopeGuard } from '../middleware/scope-guard.js';
 *   router.use(scopeGuard);
 */

/**
 * 作用域守卫中间件
 * 确保所有 Atomic API 请求都携带了必要的作用域标识
 */
export const scopeGuard = (req, res, next) => {
    const projectId = req.headers['x-project-id'];
    const facilityId = req.headers['x-facility-id'] || null;
    const fileId = req.headers['x-file-id'] || null;
    const requestId = req.headers['x-request-id'] || null;
    const traceId = req.headers['x-trace-id'] || null;

    // project_id 必填
    if (!projectId) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_PROJECT_ID',
                message: 'X-Project-Id header is required for all Atomic API calls',
                request_id: requestId
            }
        });
    }

    // TODO (Week2): 校验 project_id 存在于 ai_hub.projects 表中
    // TODO (Week2): 如果提供了 file_id，校验 file_id 属于该 project_id

    // 将作用域信息挂载到 req 上供后续路由使用
    req.scope = {
        projectId,
        facilityId,
        fileId: fileId ? parseInt(fileId, 10) : null
    };

    // 将审计追踪信息挂载到 req 上
    req.tracing = {
        requestId,
        traceId
    };

    // 最小可审计日志（Week1 要求）
    console.log(
        `📡 [atomic] ${req.method} ${req.originalUrl}` +
        ` | project=${projectId}` +
        ` | user=${req.user?.id || 'unknown'}` +
        ` | request_id=${requestId || 'none'}` +
        ` | trace_id=${traceId || 'none'}`
    );

    next();
};

export default scopeGuard;
