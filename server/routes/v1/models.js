/**
 * 模型文件路由模块 (API v1)
 */
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import modelFileModel from '../../models/model-file.js';
import { PERMISSIONS } from '../../config/auth.js';

const router = Router();

/**
 * @swagger
 * /api/v1/models:
 *   get:
 *     summary: 获取模型文件列表
 *     tags: [Models]
 */
router.get('/',
    authenticate,
    authorize(PERMISSIONS.MODEL_READ),
    query('facilityId').optional().isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { facilityId } = req.query;

            let models;
            if (facilityId) {
                // 预留：按设施筛选
                models = await modelFileModel.getAllModelFiles();
                models = models.filter(m => m.facility_id === facilityId);
            } else {
                models = await modelFileModel.getAllModelFiles();
            }

            res.json({ success: true, data: models });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/models/{id}:
 *   get:
 *     summary: 根据ID获取模型文件
 *     tags: [Models]
 */
router.get('/:id',
    authenticate,
    authorize(PERMISSIONS.MODEL_READ),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const model = await modelFileModel.getModelFileById(req.params.id);
            if (!model) {
                throw ApiError.notFound('模型文件不存在');
            }
            res.json({ success: true, data: model });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/models/{id}:
 *   put:
 *     summary: 更新模型文件信息
 *     tags: [Models]
 */
router.put('/:id',
    authenticate,
    authorize(PERMISSIONS.MODEL_UPLOAD),
    param('id').isInt().toInt(),
    body('title').optional().trim(),
    body('description').optional().trim(),
    body('facilityId').optional().isInt().toInt(),
    body('displayOrder').optional().isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const model = await modelFileModel.updateModelFile(req.params.id, req.body);
            if (!model) {
                throw ApiError.notFound('模型文件不存在');
            }
            res.json({ success: true, data: model });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/models/{id}:
 *   delete:
 *     summary: 删除模型文件
 *     tags: [Models]
 */
router.delete('/:id',
    authenticate,
    authorize(PERMISSIONS.MODEL_DELETE),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const deleted = await modelFileModel.deleteModelFile(req.params.id);
            if (!deleted) {
                throw ApiError.notFound('模型文件不存在');
            }
            res.json({ success: true, message: '删除成功' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/models/{id}/activate:
 *   post:
 *     summary: 激活模型文件
 *     tags: [Models]
 */
router.post('/:id/activate',
    authenticate,
    authorize(PERMISSIONS.MODEL_UPLOAD),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const model = await modelFileModel.activateModelFile(req.params.id);
            if (!model) {
                throw ApiError.notFound('模型文件不存在');
            }
            res.json({ success: true, data: model });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/models/active:
 *   get:
 *     summary: 获取当前激活的模型文件
 *     tags: [Models]
 */
router.get('/active',
    authenticate,
    authorize(PERMISSIONS.MODEL_READ),
    async (req, res, next) => {
        try {
            const models = await modelFileModel.getAllModelFiles();
            const activeModel = models.find(m => m.is_active);

            if (!activeModel) {
                throw ApiError.notFound('没有激活的模型文件');
            }

            res.json({ success: true, data: activeModel });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/models/{id}/assets:
 *   get:
 *     summary: 获取模型文件关联的资产
 *     tags: [Models]
 */
router.get('/:id/assets',
    authenticate,
    authorize(PERMISSIONS.MODEL_READ),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            // 引入资产模型
            const assetModel = (await import('../../models/asset.js')).default;
            const assets = await assetModel.getAssetsByFileId(req.params.id);
            res.json({ success: true, data: assets });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/models/{id}/spaces:
 *   get:
 *     summary: 获取模型文件关联的空间
 *     tags: [Models]
 */
router.get('/:id/spaces',
    authenticate,
    authorize(PERMISSIONS.MODEL_READ),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            // 引入空间模型
            const spaceModel = (await import('../../models/space.js')).default;
            const spaces = await spaceModel.getSpacesByFileId(req.params.id);
            res.json({ success: true, data: spaces });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
