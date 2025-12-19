/**
 * 空间路由模块 (API v1)
 */
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import spaceModel from '../../models/space.js';
import { PERMISSIONS } from '../../config/auth.js';

const router = Router();

/**
 * @swagger
 * /api/v1/spaces:
 *   get:
 *     summary: 获取空间列表
 *     tags: [Spaces]
 */
router.get('/',
    authenticate,
    authorize(PERMISSIONS.SPACE_READ),
    query('fileId').optional().isInt().toInt(),
    query('floor').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { fileId, floor } = req.query;

            let spaces;
            if (fileId) {
                spaces = await spaceModel.getSpacesByFileId(fileId);
            } else {
                spaces = await spaceModel.getAllSpaces();
            }

            // 按楼层筛选
            if (floor) {
                spaces = spaces.filter(s => s.floor === floor);
            }

            res.json({ success: true, data: spaces });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/spaces/{code}:
 *   get:
 *     summary: 根据编码获取空间
 *     tags: [Spaces]
 */
router.get('/:code',
    authenticate,
    authorize(PERMISSIONS.SPACE_READ),
    param('code').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const space = await spaceModel.getSpaceByCode(req.params.code);
            if (!space) {
                throw ApiError.notFound('空间不存在');
            }
            res.json({ success: true, data: space });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/spaces:
 *   post:
 *     summary: 创建空间
 *     tags: [Spaces]
 */
router.post('/',
    authenticate,
    authorize(PERMISSIONS.SPACE_CREATE),
    body('spaceCode').notEmpty().trim().withMessage('空间编码不能为空'),
    body('name').optional().trim(),
    body('floor').optional().trim(),
    body('area').optional().isFloat().toFloat(),
    body('dbId').optional().isInt().toInt(),
    body('fileId').optional().isInt().toInt(),
    body('classificationCode').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const space = await spaceModel.createSpace(req.body);
            res.status(201).json({ success: true, data: space });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/spaces/{code}:
 *   put:
 *     summary: 更新空间
 *     tags: [Spaces]
 */
router.put('/:code',
    authenticate,
    authorize(PERMISSIONS.SPACE_UPDATE),
    param('code').notEmpty().trim(),
    body('name').optional().trim(),
    body('floor').optional().trim(),
    body('area').optional().isFloat().toFloat(),
    body('classificationCode').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const space = await spaceModel.updateSpace(req.params.code, req.body);
            if (!space) {
                throw ApiError.notFound('空间不存在');
            }
            res.json({ success: true, data: space });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/spaces/{code}:
 *   delete:
 *     summary: 删除空间
 *     tags: [Spaces]
 */
router.delete('/:code',
    authenticate,
    authorize(PERMISSIONS.SPACE_DELETE),
    param('code').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const deleted = await spaceModel.deleteSpace(req.params.code);
            if (!deleted) {
                throw ApiError.notFound('空间不存在');
            }
            res.json({ success: true, message: '删除成功' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/spaces/batch:
 *   post:
 *     summary: 批量导入空间
 *     tags: [Spaces]
 */
router.post('/batch',
    authenticate,
    authorize(PERMISSIONS.SPACE_CREATE),
    body('spaces').isArray().withMessage('spaces 必须是数组'),
    body('spaces.*.spaceCode').notEmpty().withMessage('空间编码不能为空'),
    validateRequest,
    async (req, res, next) => {
        try {
            const { spaces } = req.body;
            const result = await spaceModel.batchUpsertSpacesWithFile(spaces);
            res.json({
                success: true,
                data: {
                    total: spaces.length,
                    ...result,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/spaces/floors:
 *   get:
 *     summary: 获取所有楼层列表
 *     tags: [Spaces]
 */
router.get('/floors',
    authenticate,
    authorize(PERMISSIONS.SPACE_READ),
    query('fileId').optional().isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { fileId } = req.query;

            let spaces;
            if (fileId) {
                spaces = await spaceModel.getSpacesByFileId(fileId);
            } else {
                spaces = await spaceModel.getAllSpaces();
            }

            // 提取唯一楼层
            const floors = [...new Set(spaces.map(s => s.floor).filter(Boolean))].sort();

            res.json({ success: true, data: floors });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
