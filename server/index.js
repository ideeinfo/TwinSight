/**
 * Tandem Demo 后端服务
 * Express + PostgreSQL
 */
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import apiRoutes from './routes/api.js';
import fileRoutes from './routes/files.js';

// 加载环境变量
config();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// 中间件
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// API 路由
app.use('/api', apiRoutes);
app.use('/api/files', fileRoutes);

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
});

export default app;
