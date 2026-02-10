/**
 * API v1 路由聚合
 */
import { Router } from 'express';
import assetsRouter from './assets.js';
import spacesRouter from './spaces.js';
import modelsRouter from './models.js';
import timeseriesRouter from './timeseries.js';
import documentsRouter from './documents.js';
import aiRouter from './ai.js';
import authRouter from './auth.js';
import usersRouter from './users.js';
import systemConfigRouter from './system-config.js';
// import facilitiesRouter from './facilities.js'; // 预留
// import propertiesRouter from './properties.js'; // 预留

import { query } from '../../db/index.js';

const router = Router();

// 健康检查 (包含数据库连接测试)
router.get('/health', async (req, res) => {
    try {
        // 测试数据库连接
        await query('SELECT 1');

        res.json({
            success: true,
            message: 'API v1 is running',
            database: 'connected',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('健康检查失败 (Database Error):', error.message);
        res.status(503).json({
            success: false,
            message: 'Service Unavailable: Database connection failed',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// 挂载路由模块
router.use('/assets', assetsRouter);
router.use('/spaces', spacesRouter);
router.use('/models', modelsRouter);
router.use('/timeseries', timeseriesRouter);
router.use('/documents', documentsRouter);
router.use('/ai', aiRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/system-config', systemConfigRouter);
// router.use('/facilities', facilitiesRouter); // 预留
// router.use('/properties', propertiesRouter); // 预留

export default router;

