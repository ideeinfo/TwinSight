/**
 * 文档管理路由模块 (API v1)
 */
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import { PERMISSIONS } from '../../config/auth.js';
import { query as dbQuery } from '../../config/database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import config from '../../config/index.js';

const router = Router();

// 配置文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = config.upload.documentsDir;
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'));
        }
    },
});

/**
 * @swagger
 * /api/v1/documents:
 *   get:
 *     summary: 获取文档列表
 *     tags: [Documents]
 */
router.get('/',
    authenticate,
    query('assetCode').optional().trim(),
    query('spaceCode').optional().trim(),
    query('category').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { assetCode, spaceCode, category } = req.query;

            let sql = `
        SELECT d.*, 
               a.asset_code, a.name as asset_name,
               s.space_code, s.name as space_name
        FROM documents d
        LEFT JOIN assets a ON d.asset_id = a.id
        LEFT JOIN spaces s ON d.space_id = s.id
        WHERE 1=1
      `;
            const params = [];

            if (assetCode) {
                params.push(assetCode);
                sql += ` AND a.asset_code = $${params.length}`;
            }

            if (spaceCode) {
                params.push(spaceCode);
                sql += ` AND s.space_code = $${params.length}`;
            }

            if (category) {
                params.push(category);
                sql += ` AND d.category = $${params.length}`;
            }

            sql += ' ORDER BY d.created_at DESC';

            const result = await dbQuery(sql, params);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   get:
 *     summary: 根据ID获取文档
 *     tags: [Documents]
 */
router.get('/:id',
    authenticate,
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const result = await dbQuery(
                `SELECT d.*, 
                a.asset_code, a.name as asset_name,
                s.space_code, s.name as space_name
         FROM documents d
         LEFT JOIN assets a ON d.asset_id = a.id
         LEFT JOIN spaces s ON d.space_id = s.id
         WHERE d.id = $1`,
                [req.params.id]
            );

            if (result.rows.length === 0) {
                throw ApiError.notFound('文档不存在');
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents:
 *   post:
 *     summary: 上传文档
 *     tags: [Documents]
 */
router.post('/',
    authenticate,
    upload.single('file'),
    body('title').optional().trim(),
    body('description').optional().trim(),
    body('category').optional().trim(),
    body('assetId').optional().isInt().toInt(),
    body('spaceId').optional().isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw ApiError.badRequest('请上传文件');
            }

            const { title, description, category, assetId, spaceId } = req.body;
            const fileName = req.file.filename;
            const originalName = req.file.originalname;
            const filePath = `/documents/${fileName}`;
            const fileSize = req.file.size;
            const mimeType = req.file.mimetype;

            const result = await dbQuery(
                `INSERT INTO documents (title, description, category, file_name, original_name, file_path, file_size, mime_type, asset_id, space_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
                [
                    title || originalName,
                    description,
                    category,
                    fileName,
                    originalName,
                    filePath,
                    fileSize,
                    mimeType,
                    assetId || null,
                    spaceId || null,
                ]
            );

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   put:
 *     summary: 更新文档信息
 *     tags: [Documents]
 */
router.put('/:id',
    authenticate,
    param('id').isInt().toInt(),
    body('title').optional().trim(),
    body('description').optional().trim(),
    body('category').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { title, description, category } = req.body;

            const result = await dbQuery(
                `UPDATE documents
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             category = COALESCE($3, category),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
                [title, description, category, req.params.id]
            );

            if (result.rows.length === 0) {
                throw ApiError.notFound('文档不存在');
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   delete:
 *     summary: 删除文档
 *     tags: [Documents]
 */
router.delete('/:id',
    authenticate,
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            // 先获取文档信息
            const docResult = await dbQuery('SELECT * FROM documents WHERE id = $1', [req.params.id]);

            if (docResult.rows.length === 0) {
                throw ApiError.notFound('文档不存在');
            }

            const doc = docResult.rows[0];

            // 删除数据库记录
            await dbQuery('DELETE FROM documents WHERE id = $1', [req.params.id]);

            // 删除文件
            const filePath = path.join(config.upload.documentsDir, doc.file_name);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            res.json({ success: true, message: '删除成功' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/asset/{assetCode}:
 *   get:
 *     summary: 获取资产关联的文档
 *     tags: [Documents]
 */
router.get('/asset/:assetCode',
    authenticate,
    param('assetCode').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const result = await dbQuery(
                `SELECT d.*
         FROM documents d
         INNER JOIN assets a ON d.asset_id = a.id
         WHERE a.asset_code = $1
         ORDER BY d.created_at DESC`,
                [req.params.assetCode]
            );

            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/space/{spaceCode}:
 *   get:
 *     summary: 获取空间关联的文档
 *     tags: [Documents]
 */
router.get('/space/:spaceCode',
    authenticate,
    param('spaceCode').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const result = await dbQuery(
                `SELECT d.*
         FROM documents d
         INNER JOIN spaces s ON d.space_id = s.id
         WHERE s.space_code = $1
         ORDER BY d.created_at DESC`,
                [req.params.spaceCode]
            );

            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
