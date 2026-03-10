/**
 * Atomic API 版本路由入口
 */

import { Router } from 'express';
import v1Router from './v1/index.js';

const router = Router();

// v1 版本
router.use('/v1', v1Router);

export default router;
