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
import { query } from '../../db/index.js';
import { deleteKnowledgeBase, getKnowledgeBase, syncDocumentsToKB } from '../../services/openwebui-service.js';
import {
    ensureFacilityKnowledgeBase,
    getFacilityKnowledgeBase,
    listKnowledgeBaseDocuments,
    resolveKnowledgeBase,
} from '../../services/knowledge-base-service.js';

const router = Router();

function canManageFacilityKnowledgeBase(req) {
    const permissions = req.permissions || [];
    return permissions.includes('*')
        || permissions.includes(PERMISSIONS.MODEL_UPLOAD)
        || permissions.includes(PERMISSIONS.FACILITY_UPDATE)
        || permissions.includes(PERMISSIONS.FACILITY_MANAGE);
}

function ensureKbPermission(req, res) {
    if (canManageFacilityKnowledgeBase(req)) {
        return true;
    }

    res.status(403).json({
        success: false,
        error: '无权管理 Facility 知识库',
    });
    return false;
}

async function getFacilityKbSummary(facilityId) {
    const facility = await facilityModel.getFacilityById(facilityId);
    if (!facility) {
        throw ApiError.notFound('设施不存在');
    }

    const kb = await resolveKnowledgeBase({ facilityId });
    const totalDocuments = facility.document_count ?? 0;

    if (!kb) {
        return {
            facilityId,
            exists: false,
            totalDocuments,
            pendingDocuments: totalDocuments,
            stats: {
                synced: 0,
                failed: 0,
                duplicate: 0,
                pending: totalDocuments,
                total: totalDocuments,
            },
        };
    }

    const statsResult = await query(`
        SELECT sync_status, COUNT(*)::int AS count
        FROM kb_documents
        WHERE kb_id = $1
        GROUP BY sync_status
    `, [kb.id]);

    const statsMap = statsResult.rows.reduce((acc, row) => {
        acc[row.sync_status] = row.count;
        return acc;
    }, {});

    const pendingDocuments = (await listKnowledgeBaseDocuments({
        kbId: kb.id,
        facilityId,
        onlyUnsynced: true,
    })).length;

    return {
        facilityId,
        exists: true,
        id: kb.id,
        kbName: kb.kb_name,
        openwebuiKbId: kb.openwebui_kb_id,
        scopeType: kb.scope_type,
        status: kb.status,
        sourceFileId: kb.source_file_id,
        totalDocuments,
        pendingDocuments,
        stats: {
            synced: statsMap.synced || 0,
            failed: statsMap.failed || 0,
            duplicate: statsMap.duplicate || 0,
            pending: pendingDocuments,
            total: totalDocuments,
        },
    };
}

async function deleteFacilityKnowledgeBaseRecord(kb) {
    let kbExists = true;
    try {
        await getKnowledgeBase(kb.openwebui_kb_id);
    } catch (checkError) {
        const errorMsg = checkError.message || '';
        const isNotFound = errorMsg.includes('404')
            || errorMsg.toLowerCase().includes('could not find')
            || errorMsg.toLowerCase().includes('not found');

        if (isNotFound) {
            kbExists = false;
        } else {
            throw checkError;
        }
    }

    if (kbExists) {
        await deleteKnowledgeBase(kb.openwebui_kb_id);
    }

    await query('DELETE FROM kb_documents WHERE kb_id = $1', [kb.id]);
    await query('DELETE FROM kb_documents WHERE openwebui_kb_id = $1', [kb.openwebui_kb_id]);
    await query('DELETE FROM knowledge_bases WHERE id = $1', [kb.id]);
}

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

router.get('/:id/knowledge-base',
    authenticate,
    authorize(PERMISSIONS.FACILITY_READ),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const summary = await getFacilityKbSummary(req.params.id);
            res.json({ success: true, data: summary });
        } catch (error) {
            next(error);
        }
    }
);

router.post('/:id/knowledge-base',
    authenticate,
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            if (!ensureKbPermission(req, res)) return;

            const facility = await facilityModel.getFacilityById(req.params.id);
            if (!facility) {
                throw ApiError.notFound('设施不存在');
            }

            const { force } = req.query;
            const existingKb = await getFacilityKnowledgeBase(req.params.id);

            if (existingKb?.openwebui_kb_id && force !== 'true') {
                return res.json({
                    success: false,
                    code: 'KB_EXISTS',
                    error: '该设施已关联知识库',
                    data: {
                        kbId: existingKb.openwebui_kb_id,
                        kbName: existingKb.kb_name,
                        message: '删除现有知识库将丢失所有已上传的文件，是否继续？'
                    }
                });
            }

            if (existingKb?.openwebui_kb_id && force === 'true') {
                await deleteFacilityKnowledgeBaseRecord(existingKb);
            }

            const models = await facilityModel.getFacilityModels(req.params.id);
            const sourceFileId = facility.default_model_id || models[0]?.id || null;
            const kb = await ensureFacilityKnowledgeBase(req.params.id, {
                sourceFileId,
                preferredName: facility.name,
                description: `知识库关联 Facility: ${facility.name}`,
            });

            res.json({
                success: true,
                data: kb,
                message: force === 'true' ? 'Facility 知识库已重建' : 'Facility 知识库创建成功',
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post('/:id/knowledge-base/sync',
    authenticate,
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            if (!ensureKbPermission(req, res)) return;

            const facility = await facilityModel.getFacilityById(req.params.id);
            if (!facility) {
                throw ApiError.notFound('设施不存在');
            }

            const kb = await resolveKnowledgeBase({ facilityId: req.params.id });
            if (!kb?.openwebui_kb_id) {
                return res.status(400).json({
                    success: false,
                    error: '该设施尚未创建知识库，请先创建知识库',
                });
            }

            const documents = await listKnowledgeBaseDocuments({
                kbId: kb.id,
                facilityId: req.params.id,
                onlyUnsynced: true,
            });

            if (documents.length === 0) {
                return res.json({
                    success: true,
                    data: { total: 0, synced: 0, failed: 0, skipped: 0 },
                    message: '没有需要同步的文档',
                });
            }

            const syncResult = await syncDocumentsToKB(kb.openwebui_kb_id, documents);
            res.json({
                success: true,
                data: {
                    total: documents.length,
                    synced: syncResult.success,
                    failed: syncResult.failed,
                    skipped: syncResult.skipped || 0,
                },
                message: `成功同步 ${syncResult.success} 个文档${syncResult.failed > 0 ? `，${syncResult.failed} 个失败` : ''}${(syncResult.skipped || 0) > 0 ? `，${syncResult.skipped} 个跳过` : ''}`,
            });
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
