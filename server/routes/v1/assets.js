/**
 * 资产路由模块 (API v1)
 */
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import assetModel from '../../models/asset.js';
import assetSpecModel from '../../models/asset-spec.js';
import { PERMISSIONS } from '../../config/auth.js';

const router = Router();

/**
 * @swagger
 * /api/v1/assets:
 *   get:
 *     summary: 获取资产列表
 *     tags: [Assets]
 *     parameters:
 *       - in: query
 *         name: fileId
 *         schema:
 *           type: integer
 *         description: 按文件ID筛选
 *       - in: query
 *         name: specCode
 *         schema:
 *           type: string
 *         description: 按规格编码筛选
 */
router.get('/',
    authenticate,
    authorize(PERMISSIONS.ASSET_READ),
    query('fileId').optional().isInt().toInt(),
    query('specCode').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { fileId, specCode } = req.query;

            let assets;
            if (fileId) {
                assets = await assetModel.getAssetsByFileId(fileId);
            } else if (specCode) {
                assets = await assetModel.getAssetsBySpecCode(specCode);
            } else {
                assets = await assetModel.getAllAssets();
            }

            res.json({ success: true, data: assets });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/assets/{code}:
 *   get:
 *     summary: 根据编码获取资产
 *     tags: [Assets]
 */
router.get('/:code',
    authenticate,
    authorize(PERMISSIONS.ASSET_READ),
    param('code').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const asset = await assetModel.getAssetByCode(req.params.code);
            if (!asset) {
                throw ApiError.notFound('资产不存在');
            }
            res.json({ success: true, data: asset });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/assets:
 *   post:
 *     summary: 创建资产
 *     tags: [Assets]
 */
router.post('/',
    authenticate,
    authorize(PERMISSIONS.ASSET_CREATE),
    body('assetCode').notEmpty().trim().withMessage('资产编码不能为空'),
    body('name').optional().trim(),
    body('specCode').optional().trim(),
    body('floor').optional().trim(),
    body('room').optional().trim(),
    body('dbId').optional().isInt().toInt(),
    body('fileId').optional().isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const asset = await assetModel.createAsset(req.body);
            res.status(201).json({ success: true, data: asset });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/assets/{code}:
 *   put:
 *     summary: 更新资产
 *     tags: [Assets]
 */
router.put('/:code',
    authenticate,
    authorize(PERMISSIONS.ASSET_UPDATE),
    param('code').notEmpty().trim(),
    body('name').optional().trim(),
    body('specCode').optional().trim(),
    body('floor').optional().trim(),
    body('room').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const asset = await assetModel.updateAsset(req.params.code, req.body);
            if (!asset) {
                throw ApiError.notFound('资产不存在');
            }
            res.json({ success: true, data: asset });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/assets/{code}:
 *   delete:
 *     summary: 删除资产
 *     tags: [Assets]
 */
router.delete('/:code',
    authenticate,
    authorize(PERMISSIONS.ASSET_DELETE),
    param('code').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const deleted = await assetModel.deleteAsset(req.params.code);
            if (!deleted) {
                throw ApiError.notFound('资产不存在');
            }
            res.json({ success: true, message: '删除成功' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/assets/batch:
 *   post:
 *     summary: 批量导入资产
 *     tags: [Assets]
 */
router.post('/batch',
    authenticate,
    authorize(PERMISSIONS.ASSET_CREATE),
    body('assets').isArray().withMessage('assets 必须是数组'),
    body('assets.*.assetCode').notEmpty().withMessage('资产编码不能为空'),
    validateRequest,
    async (req, res, next) => {
        try {
            const { assets } = req.body;
            const result = await assetModel.batchUpsertAssetsWithFile(assets);
            res.json({
                success: true,
                data: {
                    total: assets.length,
                    ...result,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// ========== 资产规格路由 ==========

/**
 * @swagger
 * /api/v1/assets/specs:
 *   get:
 *     summary: 获取资产规格列表
 *     tags: [AssetSpecs]
 */
router.get('/specs',
    authenticate,
    authorize(PERMISSIONS.ASSET_READ),
    query('fileId').optional().isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { fileId } = req.query;

            let specs;
            if (fileId) {
                specs = await assetSpecModel.getAssetSpecsByFileId(fileId);
            } else {
                specs = await assetSpecModel.getAllAssetSpecs();
            }

            res.json({ success: true, data: specs });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/assets/specs/{code}:
 *   get:
 *     summary: 根据编码获取资产规格
 *     tags: [AssetSpecs]
 */
router.get('/specs/:code',
    authenticate,
    authorize(PERMISSIONS.ASSET_READ),
    param('code').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const spec = await assetSpecModel.getAssetSpecByCode(req.params.code);
            if (!spec) {
                throw ApiError.notFound('资产规格不存在');
            }
            res.json({ success: true, data: spec });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
