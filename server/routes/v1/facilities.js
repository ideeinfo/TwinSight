import { Router } from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import facilityModel from '../../models/facility.js';
import { PERMISSIONS } from '../../config/auth.js';
import config from '../../config/index.js';

const router = Router();

const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(config.upload.dataDir, 'facilities', 'covers');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `facility_cover_${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`);
    }
});

const uploadCover = multer({
    storage: coverStorage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允许上传图片文件'));
        }
        cb(null, true);
    }
});

router.post('/cover',
    authenticate,
    uploadCover.single('cover'),
    async (req, res, next) => {
        try {
            const hasCreatePermission = req.permissions?.includes('*') || req.permissions?.includes(PERMISSIONS.FACILITY_CREATE);
            const hasUpdatePermission = req.permissions?.includes('*') || req.permissions?.includes(PERMISSIONS.FACILITY_UPDATE);

            if (!hasCreatePermission && !hasUpdatePermission) {
                return res.status(403).json({
                    success: false,
                    error: '无权执行此操作',
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: '未上传文件',
                });
            }

            const coverImagePath = `/data/facilities/covers/${req.file.filename}`;
            res.json({
                success: true,
                data: {
                    coverImagePath,
                },
                message: '设施封面上传成功',
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/',
    authenticate,
    authorize(PERMISSIONS.FACILITY_READ),
    async (req, res, next) => {
        try {
            const facilities = await facilityModel.getAllFacilities();
            res.json({ success: true, data: facilities });
        } catch (error) {
            next(error);
        }
    }
);

router.post('/',
    authenticate,
    authorize(PERMISSIONS.FACILITY_CREATE),
    body('name').notEmpty().trim().withMessage('name 不能为空'),
    body('facilityCode').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('address').optional().trim(),
    body('coverImagePath').optional().trim(),
    body('status').optional().isIn(['active', 'archived']),
    validateRequest,
    async (req, res, next) => {
        try {
            const facility = await facilityModel.createFacility(req.body);
            res.status(201).json({ success: true, data: facility });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/:id',
    authenticate,
    authorize(PERMISSIONS.FACILITY_READ),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const facility = await facilityModel.getFacilityById(req.params.id);
            if (!facility) {
                throw ApiError.notFound('设施不存在');
            }
            res.json({ success: true, data: facility });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/:id/models',
    authenticate,
    authorize(PERMISSIONS.FACILITY_READ),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const facility = await facilityModel.getFacilityById(req.params.id);
            if (!facility) {
                throw ApiError.notFound('设施不存在');
            }

            const models = await facilityModel.getFacilityModels(req.params.id);
            res.json({ success: true, data: models });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/:id/detail',
    authenticate,
    authorize(PERMISSIONS.FACILITY_READ),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const facility = await facilityModel.getFacilityWithModels(req.params.id);
            if (!facility) {
                throw ApiError.notFound('设施不存在');
            }
            res.json({ success: true, data: facility });
        } catch (error) {
            next(error);
        }
    }
);

router.patch('/:id',
    authenticate,
    authorize(PERMISSIONS.FACILITY_UPDATE),
    param('id').isInt().toInt(),
    body('facilityCode').optional().notEmpty().trim(),
    body('name').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('address').optional().trim(),
    body('coverImagePath').optional().trim(),
    body('status').optional().isIn(['active', 'archived']),
    validateRequest,
    async (req, res, next) => {
        try {
            const facility = await facilityModel.updateFacility(req.params.id, req.body);
            if (!facility) {
                throw ApiError.notFound('设施不存在');
            }
            res.json({ success: true, data: facility });
        } catch (error) {
            next(error);
        }
    }
);

router.delete('/:id',
    authenticate,
    authorize(PERMISSIONS.FACILITY_DELETE),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const facility = await facilityModel.deleteFacility(req.params.id);
            if (!facility) {
                throw ApiError.notFound('设施不存在');
            }
            res.json({ success: true, data: facility });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
