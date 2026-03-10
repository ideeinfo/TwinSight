/**
 * Atomic API v1 路由入口
 * 
 * 所有端点均需要 M2M 服务认证 + 作用域校验。
 * 用户 JWT 通过现有的 authenticate 中间件透传。
 */

import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { serviceAuth } from '../../../middleware/service-auth.js';
import { scopeGuard } from '../../../middleware/scope-guard.js';

// 子路由
import powerRouter from './power.js';
import timeseriesRouter from './timeseries.js';
import assetsRouter from './assets.js';
import knowledgeRouter from './knowledge.js';
import uiRouter from './ui.js';
import alarmRouter from './alarm.js';

const router = Router();

// 全局中间件链：用户认证 -> 服务间认证 -> 作用域校验
router.use(authenticate);
router.use(serviceAuth);
router.use(scopeGuard);

// 挂载子路由
router.use('/power', powerRouter);
router.use('/timeseries', timeseriesRouter);
router.use('/assets', assetsRouter);
router.use('/knowledge', knowledgeRouter);
router.use('/ui', uiRouter);
router.use('/alarm', alarmRouter);

export default router;
