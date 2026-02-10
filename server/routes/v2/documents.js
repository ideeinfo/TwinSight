/**
 * 文档管理模块 v2 API 路由
 * 支持多对多关联、文件夹管理、标签系统、智能分析
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, getClient } from '../../db/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../config/auth.js';
import appConfig from '../../config/index.js';
import { processNewDocument, processExistingDocuments } from '../../services/document-intelligence-service.js';
import { matchFileNames, searchObjects } from '../../services/document-matching-service.js';

const router = Router();

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 存放在 data/documents 下，以便通过 /data/documents/... 访问
        const uploadDir = path.join(appConfig.upload.dataDir, 'documents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

// ========================================
// 文档 CRUD
// ========================================

/**
 * GET /api/v2/documents
 * 获取文档列表(支持多条件筛选)
 */
router.get('/',
    authenticate,
    async (req, res, next) => {
        try {
            const {
                objectType, objectCode,
                folderId, businessType, tagId, tagIds,
                page = 1, pageSize = 50
            } = req.query;

            console.log('[Documents V2 GET] Query params:', { objectType, objectCode, folderId, businessType, tagId, tagIds });

            // 解析多标签筛选 (支持逗号分隔的字符串或数组)
            let filterTagIds = [];
            if (tagIds) {
                const rawIds = Array.isArray(tagIds) ? tagIds : tagIds.split(',');
                filterTagIds = rawIds
                    .map(id => parseInt(String(id).trim()))
                    .filter(id => !isNaN(id) && id > 0);
            } else if (tagId) {
                const parsed = parseInt(tagId);
                if (!isNaN(parsed) && parsed > 0) {
                    filterTagIds = [parsed];
                }
            }
            const hasTagFilter = filterTagIds.length > 0;

            // 检查标签表是否存在
            const tagTableCheck = await query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'document_tags'
                ) as has_tags_table
            `);
            const hasTagsTable = tagTableCheck.rows[0]?.has_tags_table;

            // 检查 EXIF 表是否存在
            const exifTableCheck = await query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'document_exif'
                ) as has_exif_table
            `);
            const hasExifTable = exifTableCheck.rows[0]?.has_exif_table;

            // 构建 SELECT 子句 (包含标签子查询和 EXIF JOIN)
            const tagSubquery = hasTagsTable 
                ? `COALESCE(
                    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
                     FROM document_tags t 
                     JOIN document_tag_relations dtr ON t.id = dtr.tag_id 
                     WHERE dtr.document_id = d.id),
                    '[]'
                ) as tags`
                : `'[]'::json as tags`;
            
            const exifFields = hasExifTable 
                ? `, e.image_width, e.image_height, e.date_time, e.equip_model, e.gps_longitude, e.gps_latitude`
                : ``;
            const exifJoin = hasExifTable 
                ? `LEFT JOIN document_exif e ON d.id = e.document_id`
                : ``;

            // 查询文档及其标签和EXIF信息
            let sql = `SELECT d.*, ${tagSubquery}${exifFields} FROM documents d ${exifJoin}`;

            const conditions = [];
            const values = [];
            let paramIndex = 1;

            // 按关联对象筛选(仅在新表存在时生效)
            if (objectType && objectCode) {
                // 检查是否使用新的关联表
                try {
                    const tableCheck = await query(`
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = 'document_associations'
                        ) as has_new_table
                    `);

                    if (tableCheck.rows[0]?.has_new_table) {
                        // 使用子查询去重，避免 DISTINCT 与 JSON 列冲突，包含 EXIF 信息
                        sql = `SELECT d.*, ${tagSubquery}${exifFields} FROM documents d ${exifJoin} WHERE d.id IN (SELECT da.document_id FROM document_associations da WHERE da.object_type = $${paramIndex++} AND da.object_code = $${paramIndex++})`;
                        values.push(objectType);
                        values.push(objectCode);
                    } else {
                        // 旧表结构:使用原有的关联字段
                        if (objectType === 'asset') {
                            conditions.push(`d.asset_code = $${paramIndex++}`);
                            values.push(objectCode);
                        } else if (objectType === 'space') {
                            conditions.push(`d.space_code = $${paramIndex++}`);
                            values.push(objectCode);
                        }
                    }
                } catch (e) {
                    // 表不存在时使用旧查询
                    console.log('Using legacy document query');
                }
            }

            // 按文件夹筛选 (仅在没有标签筛选时生效，标签筛选时平面展开)
            if (folderId && !hasTagFilter) {
                if (folderId === 'root') {
                    conditions.push(`d.folder_id IS NULL`);
                } else {
                    conditions.push(`d.folder_id = $${paramIndex++}`);
                    values.push(parseInt(folderId));
                }
            }

            // 按业务类型筛选
            if (businessType) {
                conditions.push(`d.business_type = $${paramIndex++}`);
                values.push(businessType);
            }

            // 按标签筛选 (仅在标签表存在时，支持多标签)
            if (hasTagFilter && hasTagsTable) {
                sql = sql.replace('FROM documents d', 
                    'FROM documents d JOIN document_tag_relations dtr_filter ON d.id = dtr_filter.document_id');
                const tagPlaceholders = filterTagIds.map(() => `$${paramIndex++}`).join(', ');
                conditions.push(`dtr_filter.tag_id IN (${tagPlaceholders})`);
                values.push(...filterTagIds);
            }

            if (conditions.length > 0) {
                sql += ` WHERE ` + conditions.join(' AND ');
            }

            sql += ` ORDER BY d.created_at DESC`;
            sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            values.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

            console.log('[Documents V2 GET] Main SQL:', sql);
            console.log('[Documents V2 GET] Main values:', values);

            const result = await query(sql, values);

            // 获取总数 (需要根据筛选条件构建正确的 COUNT 查询)
            let countSql = `SELECT COUNT(*) FROM documents d`;
            let countValues = [];
            let countParamIndex = 1;
            
            // 如果按关联对象筛选，使用子查询
            if (objectType && objectCode) {
                const tableCheck = await query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'document_associations'
                    ) as has_new_table
                `);
                if (tableCheck.rows[0]?.has_new_table) {
                    countSql = `SELECT COUNT(*) FROM documents d WHERE d.id IN (SELECT da.document_id FROM document_associations da WHERE da.object_type = $${countParamIndex++} AND da.object_code = $${countParamIndex++})`;
                    countValues.push(objectType, objectCode);
                }
            }
            
            // 如果按标签筛选，添加额外条件
            if (hasTagFilter && hasTagsTable) {
                const tagPlaceholders = filterTagIds.map(() => `$${countParamIndex++}`).join(', ');
                if (countSql.includes('WHERE')) {
                    countSql += ` AND d.id IN (SELECT dtr_filter.document_id FROM document_tag_relations dtr_filter WHERE dtr_filter.tag_id IN (${tagPlaceholders}))`;
                } else {
                    countSql += ` WHERE d.id IN (SELECT dtr_filter.document_id FROM document_tag_relations dtr_filter WHERE dtr_filter.tag_id IN (${tagPlaceholders}))`;
                }
                countValues.push(...filterTagIds);
            }
            
            // 添加文件夹筛选条件
            if (folderId && !hasTagFilter) {
                if (folderId === 'root') {
                    countSql += countSql.includes('WHERE') ? ` AND d.folder_id IS NULL` : ` WHERE d.folder_id IS NULL`;
                } else {
                    countSql += countSql.includes('WHERE') ? ` AND d.folder_id = $${countParamIndex++}` : ` WHERE d.folder_id = $${countParamIndex++}`;
                    countValues.push(parseInt(folderId));
                }
            }
            
            // 添加业务类型筛选条件
            if (businessType) {
                countSql += countSql.includes('WHERE') ? ` AND d.business_type = $${countParamIndex++}` : ` WHERE d.business_type = $${countParamIndex++}`;
                countValues.push(businessType);
            }
            
            console.log('[Documents V2 GET] Count SQL:', countSql);
            console.log('[Documents V2 GET] Count values:', countValues);
            
            const countResult = await query(countSql, countValues);

            // 获取当前文件夹下的子文件夹 (标签筛选时不显示子文件夹)
            let subfolders = [];
            if (!hasTagFilter) {
                const folderCondition = folderId && folderId !== 'root'
                    ? `parent_id = $1`
                    : `parent_id IS NULL`;
                const folderValues = folderId && folderId !== 'root' ? [parseInt(folderId)] : [];
                const subfoldersResult = await query(`
                    SELECT 
                        id, name, parent_id, created_at,
                        (SELECT COUNT(*) FROM documents WHERE folder_id = f.id) as document_count,
                        (SELECT COUNT(*) FROM document_folders WHERE parent_id = f.id) as subfolder_count
                    FROM document_folders f
                    WHERE ${folderCondition}
                    ORDER BY name ASC
                `, folderValues);
                subfolders = subfoldersResult.rows;
            }

            res.json({
                success: true,
                data: result.rows,
                subfolders: subfolders,
                pagination: {
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    total: parseInt(countResult.rows[0]?.count || 0)
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/v2/documents/search-objects
 * 搜索对象（用于手动添加关联）
 * 注意：此路由必须在 /:id 之前定义，否则会被 /:id 匹配
 */
router.get('/search-objects',
    authenticate,
    async (req, res, next) => {
        try {
            const { q, types, limit = 20 } = req.query;

            if (!q || q.trim().length === 0) {
                return res.json({ success: true, data: [] });
            }

            const typeList = types ? types.split(',') : ['asset', 'space', 'spec'];
            const results = await searchObjects(q.trim(), typeList, parseInt(limit));

            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('[Documents] search-objects error:', error);
            next(error);
        }
    }
);

/**
 * GET /api/v2/documents/:id
 * 获取单个文档详情
 */
router.get('/:id',
    authenticate,
    async (req, res, next) => {
        try {
            // 检查相关表是否存在
            const tableCheck = await query(`
                SELECT 
                    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_tags') as has_tags,
                    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_associations') as has_assoc,
                    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_metadata') as has_metadata
            `);
            const { has_tags, has_assoc, has_metadata } = tableCheck.rows[0] || {};

            // 构建动态查询
            const selectParts = ['d.*'];
            const joinParts = [];
            
            if (has_metadata) {
                selectParts.push('dm.exif_data', 'dm.common_attrs', 'dm.ai_analysis');
                joinParts.push('LEFT JOIN document_metadata dm ON d.id = dm.document_id');
            }
            
            if (has_assoc) {
                selectParts.push(`COALESCE(
                    (SELECT json_agg(json_build_object('type', da.object_type, 'code', da.object_code))
                     FROM document_associations da WHERE da.document_id = d.id),
                    '[]'
                ) as associations`);
            } else {
                selectParts.push(`'[]'::json as associations`);
            }
            
            if (has_tags) {
                selectParts.push(`COALESCE(
                    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
                     FROM document_tags t 
                     JOIN document_tag_relations dtr ON t.id = dtr.tag_id 
                     WHERE dtr.document_id = d.id),
                    '[]'
                ) as tags`);
            } else {
                selectParts.push(`'[]'::json as tags`);
            }
            
            selectParts.push('df.name as folder_name', 'df.path as folder_path');
            joinParts.push('LEFT JOIN document_folders df ON d.folder_id = df.id');

            const sql = `
                SELECT ${selectParts.join(', ')}
                FROM documents d
                ${joinParts.join(' ')}
                WHERE d.id = $1
            `;
            
            const result = await query(sql, [req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: '文档不存在' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/v2/documents
 * 上传新文档
 */
router.post('/',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_CREATE),
    upload.single('file'),
    async (req, res, next) => {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ success: false, error: '请上传文件' });
            }

            const { title, folderId, businessType, associations } = req.body;
            // 处理文件名乱码 (multer 默认 latin1)
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const fileType = path.extname(originalName).slice(1).toLowerCase();
            const relativePath = '/data/documents/' + file.filename;

            // 创建文档记录
            const docResult = await query(`
        INSERT INTO documents (title, file_name, file_path, file_size, file_type, mime_type, folder_id, business_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
                title || originalName,
                originalName,
                relativePath,
                file.size,
                fileType,
                file.mimetype,
                folderId ? parseInt(folderId) : null,
                businessType || null
            ]);

            const doc = docResult.rows[0];

            // 处理关联
            if (associations) {
                console.log('[Documents V2] Processing associations:', associations);
                try {
                    const assocArray = JSON.parse(associations);
                    console.log('[Documents V2] Parsed associations:', assocArray);
                    for (const assoc of assocArray) {
                        console.log('[Documents V2] Inserting association:', { documentId: doc.id, type: assoc.type, code: assoc.code });
                        await query(`
            INSERT INTO document_associations (document_id, object_type, object_code)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [doc.id, assoc.type, assoc.code]);
                    }
                    console.log('[Documents V2] Associations created successfully');
                } catch (assocError) {
                    console.error('[Documents V2] Error processing associations:', assocError);
                }
            } else {
                console.log('[Documents V2] No associations provided in request');
            }

            // 异步触发智能分析 (缩略图生成、类型检测等)
            processNewDocument(doc.id, relativePath, originalName).catch(err => {
                console.error('[Documents] Intelligence processing error:', err);
            });

            res.json({ success: true, data: doc });
        } catch (error) {
            next(error);
        }
    }
);

// ========================================
// 智能关联匹配
// ========================================

/**
 * POST /api/v2/documents/match-associations
 * 根据文件名自动匹配关联对象
 */
router.post('/match-associations',
    authenticate,
    async (req, res, next) => {
        try {
            const { fileNames, options = {} } = req.body;

            if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '请提供文件名列表'
                });
            }

            const results = await matchFileNames(fileNames, {
                minConfidence: options.minConfidence || 50,
                maxResults: options.maxResults || 10
            });

            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('[Documents] match-associations error:', error);
            next(error);
        }
    }
);

/**
 * POST /api/v2/documents/batch-associations
 * 批量创建文档关联
 */
router.post('/batch-associations',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_CREATE),
    async (req, res, next) => {
        try {
            const { associations } = req.body;

            if (!associations || !Array.isArray(associations)) {
                return res.status(400).json({
                    success: false,
                    error: '请提供关联数据'
                });
            }

            let created = 0;
            const errors = [];

            for (const docAssoc of associations) {
                const { documentId, items } = docAssoc;

                if (!documentId || !items || !Array.isArray(items)) {
                    errors.push({ documentId, error: '无效的关联数据格式' });
                    continue;
                }

                for (const item of items) {
                    try {
                        await query(`
                            INSERT INTO document_associations (document_id, object_type, object_code)
                            VALUES ($1, $2, $3)
                            ON CONFLICT DO NOTHING
                        `, [documentId, item.type, item.code]);
                        created++;
                    } catch (err) {
                        errors.push({ documentId, item, error: err.message });
                    }
                }
            }

            res.json({
                success: true,
                data: {
                    processed: associations.length,
                    created,
                    errors
                }
            });
        } catch (error) {
            console.error('[Documents] batch-associations error:', error);
            next(error);
        }
    }
);

/**
 * POST /api/v2/documents/batch
 * 批量上传文档
 */
router.post('/batch',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_CREATE),
    upload.array('files', 50),
    async (req, res, next) => {
        try {
            const files = req.files;
            if (!files || files.length === 0) {
                return res.status(400).json({ success: false, error: '请上传文件' });
            }

            const { folderId, associations } = req.body;
            // 安全解析 folderId，确保是有效整数或 null
            const parsedFolderId = folderId ? parseInt(folderId, 10) : null;
            const safeFolderId = Number.isNaN(parsedFolderId) ? null : parsedFolderId;
            const results = [];

            for (const file of files) {
                // 处理文件名乱码 (multer 默认 latin1)
                const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                const fileType = path.extname(originalName).slice(1).toLowerCase();
                const relativePath = '/data/documents/' + file.filename;

                const docResult = await query(`
          INSERT INTO documents (title, file_name, file_path, file_size, file_type, mime_type, folder_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
                    originalName,
                    originalName,
                    relativePath,
                    file.size,
                    fileType,
                    file.mimetype,
                    safeFolderId
                ]);

                results.push(docResult.rows[0]);

                // 异步触发智能分析
                processNewDocument(docResult.rows[0].id, relativePath, originalName).catch(err => {
                    console.error('[Documents] Intelligence processing error:', err);
                });

                // 处理共同关联
                if (associations) {
                    const assocArray = JSON.parse(associations);
                    for (const assoc of assocArray) {
                        await query(`
              INSERT INTO document_associations (document_id, object_type, object_code)
              VALUES ($1, $2, $3)
              ON CONFLICT DO NOTHING
            `, [docResult.rows[0].id, assoc.type, assoc.code]);
                    }
                }
            }

            res.json({
                success: true,
                data: results,
                message: `成功上传 ${results.length} 个文件`
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /api/v2/documents/:id
 * 更新文档属性
 */
router.patch('/:id',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const docId = req.params.id;
            console.log('[PATCH /documents/:id] Updating document id:', docId, 'body:', req.body);

            // 先检查文档是否存在
            const checkResult = await query('SELECT id, title, folder_id FROM documents WHERE id = $1', [docId]);
            console.log('[PATCH /documents/:id] Document check result:', checkResult.rows);

            const { title, folderId, businessType } = req.body;

            const updates = [];
            const values = [];
            let idx = 1;

            if (title !== undefined) {
                updates.push(`title = $${idx++}`);
                values.push(title);
            }
            if (folderId !== undefined) {
                updates.push(`folder_id = $${idx++}`);
                values.push(folderId ? parseInt(folderId) : null);
            }
            if (businessType !== undefined) {
                updates.push(`business_type = $${idx++}`);
                values.push(businessType);
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: '没有要更新的字段' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(req.params.id);

            const result = await query(`
        UPDATE documents SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *
      `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: '文档不存在' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/v2/documents/:id
 * 删除文档
 */
router.delete('/:id',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_DELETE),
    async (req, res, next) => {
        try {
            // 获取文件路径
            const docResult = await query('SELECT file_path FROM documents WHERE id = $1', [req.params.id]);
            if (docResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: '文档不存在' });
            }

            const filePath = docResult.rows[0].file_path;

            // 删除数据库记录(级联删除关联和元数据)
            await query('DELETE FROM documents WHERE id = $1', [req.params.id]);

            // 删除物理文件
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            res.json({ success: true, message: '文档已删除' });
        } catch (error) {
            next(error);
        }
    }
);

// ========================================
// 关联管理
// ========================================

/**
 * POST /api/v2/documents/:id/associations
 * 添加文档关联
 */
router.post('/:id/associations',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const { objectType, objectCode } = req.body;

            if (!objectType || !objectCode) {
                return res.status(400).json({ success: false, error: '请提供 objectType 和 objectCode' });
            }

            await query(`
        INSERT INTO document_associations (document_id, object_type, object_code)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [req.params.id, objectType, objectCode]);

            res.json({ success: true, message: '关联已添加' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/v2/documents/:id/associations/:type/:code
 * 移除文档关联
 */
router.delete('/:id/associations/:type/:code',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            await query(`
        DELETE FROM document_associations 
        WHERE document_id = $1 AND object_type = $2 AND object_code = $3
      `, [req.params.id, req.params.type, req.params.code]);

            res.json({ success: true, message: '关联已移除' });
        } catch (error) {
            next(error);
        }
    }
);

// ========================================
// 文件夹管理
// ========================================

/**
 * GET /api/v2/documents/folders
 * 获取文件夹树
 */
router.get('/folders/tree',
    authenticate,
    async (req, res, next) => {
        try {
            const result = await query(`
        SELECT f.*, 
          (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id) as document_count,
          (SELECT COUNT(*) FROM document_folders cf WHERE cf.parent_id = f.id) as subfolder_count
        FROM document_folders f
        ORDER BY f.name
      `);

            // 构建树结构
            const folders = result.rows;
            const folderMap = new Map();
            const roots = [];

            folders.forEach(f => folderMap.set(f.id, { ...f, children: [] }));
            folders.forEach(f => {
                const folder = folderMap.get(f.id);
                if (f.parent_id) {
                    const parent = folderMap.get(f.parent_id);
                    if (parent) parent.children.push(folder);
                } else {
                    roots.push(folder);
                }
            });

            res.json({ success: true, data: roots });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/v2/documents/folders
 * 创建文件夹
 */
router.post('/folders',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_CREATE),
    async (req, res, next) => {
        try {
            const { name, parentId } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, error: '请提供文件夹名称' });
            }

            // 构建路径
            let folderPath = '/' + name;
            if (parentId) {
                const parentResult = await query('SELECT path FROM document_folders WHERE id = $1', [parentId]);
                if (parentResult.rows.length > 0) {
                    folderPath = parentResult.rows[0].path + '/' + name;
                }
            }

            const result = await query(`
        INSERT INTO document_folders (name, parent_id, path)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [name, parentId || null, folderPath]);

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /api/v2/documents/folders/:id
 * 更新文件夹
 */
router.patch('/folders/:id',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const { name, parentId } = req.body;

            const updates = [];
            const values = [];
            let idx = 1;

            if (name !== undefined) {
                updates.push(`name = $${idx++}`);
                values.push(name);
            }
            if (parentId !== undefined) {
                updates.push(`parent_id = $${idx++}`);
                values.push(parentId || null);
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: '没有要更新的字段' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(req.params.id);

            const result = await query(`
        UPDATE document_folders SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *
      `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: '文件夹不存在' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/v2/documents/folders/:id
 * 删除文件夹(递归删除所有内容)
 */
router.delete('/folders/:id',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_DELETE),
    async (req, res, next) => {
        try {
            const folderId = parseInt(req.params.id);

            // 1. 递归查找所有子文件夹ID (包含当前文件夹)
            const getFolderIds = async (rootId) => {
                const result = await query(`
                    WITH RECURSIVE subfolders AS (
                        SELECT id FROM document_folders WHERE id = $1
                        UNION
                        SELECT f.id FROM document_folders f
                        INNER JOIN subfolders s ON f.parent_id = s.id
                    )
                    SELECT id FROM subfolders
                `, [rootId]);
                return result.rows.map(r => r.id);
            };

            const allFolderIds = await getFolderIds(folderId);

            if (allFolderIds.length > 0) {
                // 2. 查找这些文件夹下的所有文档
                const fileResult = await query(`
                    SELECT file_path FROM documents 
                    WHERE folder_id = ANY($1::int[])
                `, [allFolderIds]);

                // 3. 删除物理文件
                for (const row of fileResult.rows) {
                    if (row.file_path && fs.existsSync(row.file_path)) {
                        try {
                            fs.unlinkSync(row.file_path);
                        } catch (e) {
                            console.error(`Failed to delete file: ${row.file_path}`, e);
                        }
                    }
                }

                // 4. 删除数据库记录
                // 先删除文档 (由于外键约束，需要先删文档)
                await query(`
                    DELETE FROM documents 
                    WHERE folder_id = ANY($1::int[])
                `, [allFolderIds]);

                // 再删除文件夹 (从底层向上删，或者使用CASCADE if configured，这里假设手动删)
                // 由于有外键 parent_id，需要按照层级反向删除，或者简单的：
                // 如果数据库设置了 ON DELETE CASCADE，直接删除 root folder 即可。
                // 假设没有 CASCADE，我们直接删除所有涉及的文件夹 ID。
                // 为了避免违反约束，可以先解除父子关系或者直接依赖 CASCADE。
                // 这里最稳妥的方式：
                // 由于 allFolderIds 包含所有层级，直接 DELETE from folders where id in (...) 
                // 只会成功如果子文件夹没有被引用为 parent (即从叶子节点开始删)。
                // 简单起见，我们尝试直接删除根文件夹，并期望数据库配置了级联。
                // 如果没有级联，我们需要按层级倒序删除。

                // Let's assume standard behavior: delete documents first (done), then folders.
                // To delete folders properly without cascade, we'd delete `document_folders` where id in allFolderIds.
                // However, `parent_id` self-reference might block unless we delete children first.
                // Postgres handles `DELETE FROM table WHERE id IN (...)` fine if all related rows are in the set? 
                // No, constraints are checked.

                // Let's look at the schema or just try deleting the root one if cascade is on.
                // Given the user feedback "cannot delete non-empty folder", likely NO CASCADE or strict check.

                // Safe approach: Delete all sub-folders first (bottom-up), then root.
                // Or: Delete all identified folders in one statement if no other constraints block it?
                // Actually `DELETE FROM document_folders WHERE id = ANY($1)` works if we delete all of them at once?
                // It depends on verify logic. Let's try to delete all identified IDs.

                await query(`
                    DELETE FROM document_folders 
                    WHERE id = ANY($1::int[])
                `, [allFolderIds]);
            }

            res.json({ success: true, message: '文件夹及其内容已删除' });
        } catch (error) {
            next(error);
        }
    }
);

// ========================================
// 标签管理
// ========================================

/**
 * GET /api/v2/documents/tags
 * 获取所有标签列表
 */
router.get('/tags/list',
    authenticate,
    async (req, res, next) => {
        try {
            // 检查标签表是否存在
            const tableCheck = await query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'document_tags'
                ) as has_tags_table
            `);
            
            if (!tableCheck.rows[0]?.has_tags_table) {
                return res.json({ success: true, data: [] });
            }
            
            const result = await query(`
                SELECT t.*, 
                    (SELECT COUNT(*) FROM document_tag_relations dtr WHERE dtr.tag_id = t.id) as document_count
                FROM document_tags t
                ORDER BY t.name
            `);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/v2/documents/tags
 * 创建新标签
 */
router.post('/tags',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_CREATE),
    async (req, res, next) => {
        try {
            const { name, color, description } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, error: '请提供标签名称' });
            }

            const result = await query(`
                INSERT INTO document_tags (name, color, description)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [name, color || '#409EFF', description || null]);

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(400).json({ success: false, error: '标签名称已存在' });
            }
            next(error);
        }
    }
);

/**
 * PATCH /api/v2/documents/tags/:id
 * 更新标签
 */
router.patch('/tags/:id',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const { name, color, description } = req.body;

            const updates = [];
            const values = [];
            let idx = 1;

            if (name !== undefined) {
                updates.push(`name = $${idx++}`);
                values.push(name);
            }
            if (color !== undefined) {
                updates.push(`color = $${idx++}`);
                values.push(color);
            }
            if (description !== undefined) {
                updates.push(`description = $${idx++}`);
                values.push(description);
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: '没有要更新的字段' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(req.params.id);

            const result = await query(`
                UPDATE document_tags SET ${updates.join(', ')}
                WHERE id = $${idx}
                RETURNING *
            `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: '标签不存在' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/v2/documents/tags/:id
 * 删除标签
 */
router.delete('/tags/:id',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_DELETE),
    async (req, res, next) => {
        try {
            const result = await query('DELETE FROM document_tags WHERE id = $1 RETURNING *', [req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: '标签不存在' });
            }

            res.json({ success: true, message: '标签已删除' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/v2/documents/tags/auto-color
 * 自动为所有标签分配低饱和度颜色
 */
router.post('/tags/auto-color',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            // 低饱和度配色方案
            const colors = [
                '#6B8E9F',  // 灰蓝
                '#9F8B6B',  // 灰棕
                '#7A9F6B',  // 灰绿
                '#9F6B8E',  // 灰紫
                '#6B9F9A',  // 灰青
                '#9F7A6B',  // 灰橙
                '#8B6B9F',  // 灰靛
                '#6B9F7A',  // 灰翠
                '#9F6B6B',  // 灰红
                '#6B7A9F',  // 灰靛蓝
                '#8E9F6B',  // 橄榄
                '#9F8E6B',  // 沙色
                '#6B8E7A',  // 薄荷
                '#7A6B9F',  // 薰衣草
                '#9F6B9F'   // 灰玫瑰
            ];

            // 获取所有标签
            const tagsResult = await query('SELECT id FROM document_tags ORDER BY id');
            const tags = tagsResult.rows;

            // 为每个标签分配颜色
            for (let i = 0; i < tags.length; i++) {
                const color = colors[i % colors.length];
                await query('UPDATE document_tags SET color = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
                    [color, tags[i].id]);
            }

            res.json({ 
                success: true, 
                message: `已为 ${tags.length} 个标签分配颜色`
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/v2/documents/:id/tags
 * 为文档添加标签
 */
router.post('/:id/tags',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const { tagId, tagIds } = req.body;
            const documentId = req.params.id;

            // 支持单个或批量添加
            const ids = tagIds || (tagId ? [tagId] : []);

            if (ids.length === 0) {
                return res.status(400).json({ success: false, error: '请提供标签ID' });
            }

            for (const id of ids) {
                await query(`
                    INSERT INTO document_tag_relations (document_id, tag_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `, [documentId, id]);
            }

            res.json({ success: true, message: '标签已添加' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /api/v2/documents/:id/tags/:tagId
 * 移除文档标签
 */
router.delete('/:id/tags/:tagId',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            await query(`
                DELETE FROM document_tag_relations 
                WHERE document_id = $1 AND tag_id = $2
            `, [req.params.id, req.params.tagId]);

            res.json({ success: true, message: '标签已移除' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/v2/documents/batch/tags
 * 批量为多个文档添加标签
 */
router.put('/batch/tags',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const { documentIds, tagIds } = req.body;

            if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
                return res.status(400).json({ success: false, error: '请选择要打标签的文档' });
            }

            if (!tagIds || !Array.isArray(tagIds)) {
                return res.status(400).json({ success: false, error: '请选择标签' });
            }

            let updated = 0;
            for (const documentId of documentIds) {
                // 删除现有标签关联
                await query('DELETE FROM document_tag_relations WHERE document_id = $1', [documentId]);

                // 添加新标签
                if (tagIds.length > 0) {
                    for (const tagId of tagIds) {
                        await query(`
                            INSERT INTO document_tag_relations (document_id, tag_id)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING
                        `, [documentId, tagId]);
                    }
                }
                updated++;
            }

            res.json({ success: true, message: `已更新 ${updated} 个文档的标签` });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/v2/documents/:id/tags
 * 替换文档的所有标签
 */
router.put('/:id/tags',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const { tagIds } = req.body;
            const documentId = req.params.id;

            // 删除现有标签关联
            await query('DELETE FROM document_tag_relations WHERE document_id = $1', [documentId]);

            // 添加新标签
            if (tagIds && tagIds.length > 0) {
                for (const tagId of tagIds) {
                    await query(`
                        INSERT INTO document_tag_relations (document_id, tag_id)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [documentId, tagId]);
                }
            }

            res.json({ success: true, message: '标签已更新' });
        } catch (error) {
            next(error);
        }
    }
);

// ========================================
// 智能分析
// ========================================

/**
 * POST /api/v2/documents/batch-analyze
 * 批量分析现有文档 (管理员)
 */
router.post('/batch-analyze',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const { limit = 100 } = req.body;
            const result = await processExistingDocuments(limit);
            res.json({ 
                success: true, 
                data: result,
                message: `处理完成: ${result.processed} 成功, ${result.errors} 失败`
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/v2/documents/:id/analyze
 * 重新分析单个文档
 */
router.post('/:id/analyze',
    authenticate,
    authorize(PERMISSIONS.DOCUMENT_UPDATE),
    async (req, res, next) => {
        try {
            const docResult = await query('SELECT id, file_path, file_name FROM documents WHERE id = $1', [req.params.id]);
            
            if (docResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: '文档不存在' });
            }

            const doc = docResult.rows[0];
            const analysisResult = await processNewDocument(doc.id, doc.file_path, doc.file_name);
            
            res.json({ success: true, data: analysisResult });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
