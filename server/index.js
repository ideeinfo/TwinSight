/**
 * Tandem Demo 后端服务
 * Express + PostgreSQL
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

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

// 中间件
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

// 后台服务
import { startSyncService } from './services/document-sync-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
config();

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
        : allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// 静态文件服务 - 用于访问上传的文档
// 使用绝对路径：server/../public/docs = project_root/public/docs
app.use('/docs', express.static(path.join(__dirname, '../public/docs')));

// 请求日志（已禁用减少输出）
// app.use((req, res, next) => {
//     console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
//     next();
// });
app.use((req, res, next) => next());

// ========================================
// 新版 API v1 路由（推荐使用）
// ========================================
app.use('/api/v1', v1Router);

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

// 根路径
app.get('/', (req, res) => {
    res.json({
        name: 'Tandem Demo API',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            classifications: 'GET /api/classifications',
            assetSpecs: 'GET /api/asset-specs',
            assets: 'GET /api/assets',
            spaces: 'GET /api/spaces',
            files: 'GET /api/files',
            importModelData: 'POST /api/import/model-data'
        }
    });
});

// 生产环境：服务前端静态文件
if (process.env.NODE_ENV === 'production') {
    // 静态文件目录
    app.use(express.static(path.join(__dirname, 'dist')));
    app.use('/models', express.static(path.join(__dirname, 'public/models')));
    app.use('/files', express.static(path.join(__dirname, 'public/files')));

    // 所有非 API 路由返回 index.html (SPA 支持)
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        }
    });
}

// 健康检查端点（用于云服务）
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║     Tandem Demo API Server                     ║
╠════════════════════════════════════════════════╣
║  🚀 服务已启动                                 ║
║  📍 地址: http://localhost:${PORT}                ║
║  📦 数据库: PostgreSQL                         ║
╚════════════════════════════════════════════════╝
  `);

    // 启动文档同步后台服务（每 5 分钟检查一次）
    startSyncService(5 * 60 * 1000);
});

export default app;
