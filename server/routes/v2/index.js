/**
 * API v2 路由索引
 * 文档管理模块
 */
import { Router } from 'express';
import documentsRouter from './documents.js';

const router = Router();

// 文档管理
router.use('/documents', documentsRouter);

export default router;
