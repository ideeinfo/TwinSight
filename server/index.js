/**
 * Twinsight 后端服务
 * Express + PostgreSQL
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import cookieParser from 'cookie-parser';

// 旧版路由（保留兼容）
import apiRoutes from './routes/api.js';
import fileRoutes from './routes/files.js';

import documentRoutes from './routes/documents.js';
import timeseriesRoutes from './routes/timeseries.js';
import viewsRoutes from './routes/views.js';
import influxConfigRoutes from './routes/influx-config.js';
import aiAnalysisRoutes from './routes/ai-analysis.js';
import configRoutes from './routes/config.js';

// 新版 v1 路由
import v1Router from './routes/v1/index.js';

// 新版 v2 路由 (文档管理模块)
import v2Router from './routes/v2/index.js';

// 中间件
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

// 后台服务
import { startSyncService } from './services/document-sync-service.js';

// 配置
import appConfig from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载项目根目录的 .env.local（统一配置管理）
config({ path: path.join(__dirname, '../.env.local') });

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;

// 中间件
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL  // 生产环境前端地址
].filter(Boolean);

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? (origin, callback) => {
            // 允许没有 origin 的请求（如服务器间调用、健康检查）
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(null, true); // 生产环境暂时允许所有来源，可按需调整
            }
        }
        : (origin, callback) => callback(null, true),
    credentials: true
}));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use(cookieParser());

// 静态文件服务 - 使用配置路径（本地开发用 public/，生产环境用 /app/uploads）
// 添加显式 CORS 头确保 Forge Viewer Web Worker 可以正确加载文件
const staticOptions = {
    setHeaders: (res, filePath) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        // 添加 Cross-Origin-Resource-Policy 以允许跨域加载（重要！）
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        // 防止 CDN 修改内容（Railway Edge 可能会压缩或修改文件）
        res.set('Cache-Control', 'public, max-age=86400, no-transform');
        // 为模型文件设置正确的 MIME 类型（防止被当作其他格式处理）
        if (filePath.endsWith('.svf') || filePath.endsWith('.pf') || filePath.endsWith('.bin') || filePath.endsWith('.pack')) {
            res.set('Content-Type', 'application/octet-stream');
        }
    }
};
app.use('/docs', express.static(appConfig.upload.docsDir, staticOptions));
app.use('/models', express.static(appConfig.upload.modelsDir, staticOptions));
app.use('/files', express.static(appConfig.upload.uploadDir, staticOptions));
app.use('/data', express.static(appConfig.upload.dataDir, staticOptions));
app.use('/avatars', express.static(appConfig.upload.avatarsDir, staticOptions));

console.log(`📁 静态文件路径: ${appConfig.upload.dataPath}`);

// 请求日志（已禁用减少输出，影响性能）
// app.use((req, res, next) => {
//     console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
//     next();
// });

// ========== DEBUG: 最简测试路由 ==========
// 如果这都不响应，说明请求根本没进来
app.get('/test-ping', (req, res) => {
    res.send('PONG - Server is reachable!');
});

// ========================================
// 新版 API v1 路由（推荐使用）
// ========================================
app.use('/api/v1', v1Router);

// ========================================
// 新版 API v2 路由（文档管理模块）
// ========================================
app.use('/api/v2', v2Router);

// ========================================
// 旧版 API 路由（保留兼容，逐步废弃）
// ========================================
app.use('/api', apiRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/views', viewsRoutes);
app.use('/api/influx-config', influxConfigRoutes);
app.use('/api/v1/timeseries', timeseriesRoutes); // 旧版时序路由
app.use('/api/ai', aiAnalysisRoutes);
// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 根路径路由已移除，以便在生产环境由静态文件中间件处理（返回前端页面）

// 健康检查端点（用于云服务）- 移到最前优先匹配
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// 生产环境：服务前端静态文件
if (process.env.NODE_ENV === 'production') {
    // 静态文件目录
    app.use(express.static(path.join(__dirname, 'dist')));
    // 静态文件已在上面统一配置，这里不再重复
    // 生产环境使用相同的 DATA_PATH 配置

    // 所有非 API 和非静态文件路由返回 index.html (SPA 支持)
    // 静态文件路径（/models, /docs, /files, /data）需要返回真正的 404，而非 index.html
    // 否则 Forge Viewer 会收到 HTML 内容导致加载失败
    app.get('*', (req, res, next) => {
        const staticPaths = ['/api', '/models', '/docs', '/files', '/data'];
        if (staticPaths.some(prefix => req.path.startsWith(prefix))) {
            return next();
        }

        const indexPath = path.join(__dirname, 'dist', 'index.html');
        // DEBUG: 检查 index.html 是否存在
        import('fs').then(fs => {
            if (!fs.existsSync(indexPath)) {
                console.error(`❌ CRITICAL: index.html not found at ${indexPath}`);
                return res.status(500).send(`Server Error: Frontend build missing. Path: ${indexPath}`);
            }
            res.sendFile(indexPath);
        });
    });
}

// 错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});

import { runDeployInit } from './scripts/post-deploy.js';

// 启动服务器
const server = app.listen(PORT, '0.0.0.0', () => {
    const addr = server.address();
    const bindHost = typeof addr === 'string' ? addr : addr.address;
    const bindPort = typeof addr === 'string' ? '' : addr.port;

    console.log(`
╔════════════════════════════════════════════════╗
║     Twinsight API Server                       ║
╠════════════════════════════════════════════════╣
║  🚀 服务已启动                                 ║
║  📍 绑定地址: ${bindHost}:${bindPort}             ║
║  📦 数据库: PostgreSQL                         ║
╚════════════════════════════════════════════════╝
  `);

    // 异步执行数据库初始化（不阻塞服务器启动）
    runDeployInit().catch(err => {
        console.error('⚠️ 数据库初始化警告:', err.message);
    });

    // 启动文档同步后台服务（每 5 分钟检查一次）
    startSyncService(5 * 60 * 1000);
});

export default app;

