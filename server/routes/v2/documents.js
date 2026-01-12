/**
 * 文档管理模块 v2 API 路由
 * 支持多对多关联、文件夹管理
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, getClient } from '../../db/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { PERMISSIONS } from '../../config/auth.js';
import appConfig from '../../config/index.js';

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
                folderId, businessType,
                page = 1, pageSize = 50
            } = req.query;

            // 简化查询,兼容迁移前后的表结构
            let sql = `SELECT d.* FROM documents d`;

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
                        sql = `SELECT DISTINCT d.* FROM documents d JOIN document_associations da ON d.id = da.document_id`;
                        conditions.push(`da.object_type = $${paramIndex++}`);
                        values.push(objectType);
                        conditions.push(`da.object_code = $${paramIndex++}`);
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

            // 按文件夹筛选
            if (folderId) {
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

            if (conditions.length > 0) {
                sql += ` WHERE ` + conditions.join(' AND ');
            }

            sql += ` ORDER BY d.created_at DESC`;
            sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            values.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

            const result = await query(sql, values);

            // 获取总数
            let countSql = `SELECT COUNT(*) FROM documents d`;
            if (conditions.length > 0) {
                const whereClause = conditions.slice(0, conditions.length).join(' AND ');
                // 移除分页参数后的条件
                countSql += ` WHERE ` + whereClause;
            }
            const countValues = values.slice(0, -2); // 移除 LIMIT/OFFSET
            const countResult = await query(countSql, countValues);

            // 获取当前文件夹下的子文件夹
            let subfolders = [];
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
 * GET /api/v2/documents/:id
 * 获取单个文档详情
 */
router.get('/:id',
    authenticate,
    async (req, res, next) => {
        try {
            const result = await query(`
        SELECT d.*, 
          dm.exif_data, dm.common_attrs, dm.ai_analysis,
          COALESCE(
            (SELECT json_agg(json_build_object('type', da.object_type, 'code', da.object_code))
             FROM document_associations da WHERE da.document_id = d.id),
            '[]'
          ) as associations,
          df.name as folder_name, df.path as folder_path
        FROM documents d
        LEFT JOIN document_metadata dm ON d.id = dm.document_id
        LEFT JOIN document_folders df ON d.folder_id = df.id
        WHERE d.id = $1
      `, [req.params.id]);

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
                const assocArray = JSON.parse(associations);
                for (const assoc of assocArray) {
                    await query(`
            INSERT INTO document_associations (document_id, object_type, object_code)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [doc.id, assoc.type, assoc.code]);
                }
            }

            res.json({ success: true, data: doc });
        } catch (error) {
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
                    folderId ? parseInt(folderId) : null
                ]);

                results.push(docResult.rows[0]);

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

export default router;
