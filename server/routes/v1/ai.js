/**
 * AI 服务 API 路由 (v1)
 * 提供知识库管理和 AI 分析接口
 */

import express from 'express';
import openwebuiService from '../../services/openwebui-service.js';
import pg from 'pg';
import config from '../../config/index.js';

const { Pool } = pg;
const pool = new Pool(config.database);
const router = express.Router();

/**
 * 健康检查
 * GET /api/v1/ai/health
 */
router.get('/health', async (req, res) => {
    try {
        const openwebuiHealthy = await openwebuiService.checkHealth();

        res.json({
            success: true,
            data: {
                openwebui: openwebuiHealthy ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString(),
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取所有知识库
 * GET /api/v1/ai/knowledge-bases
 */
router.get('/knowledge-bases', async (req, res) => {
    try {
        const kbs = await openwebuiService.listKnowledgeBases();
        res.json({ success: true, data: kbs });
    } catch (error) {
        console.error('获取知识库列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建知识库
 * POST /api/v1/ai/knowledge-bases
 * body: { name, description, fileId }
 */
router.post('/knowledge-bases', async (req, res) => {
    try {
        const { name, description, fileId } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: '知识库名称不能为空' });
        }

        // 在 Open WebUI 中创建知识库
        const kb = await openwebuiService.createKnowledgeBase(name, description || '');

        // 如果提供了 fileId，保存映射关系
        if (fileId) {
            await pool.query(`
                INSERT INTO knowledge_bases (file_id, openwebui_kb_id, kb_name)
                VALUES ($1, $2, $3)
                ON CONFLICT (file_id) DO UPDATE SET
                    openwebui_kb_id = EXCLUDED.openwebui_kb_id,
                    kb_name = EXCLUDED.kb_name,
                    updated_at = CURRENT_TIMESTAMP
            `, [fileId, kb.id, name]);
        }

        res.json({ success: true, data: kb });
    } catch (error) {
        console.error('创建知识库失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 手动同步文档到知识库
 * POST /api/v1/ai/sync-kb
 * body: { kbId, documentIds } 或 { fileId }
 */
router.post('/sync-kb', async (req, res) => {
    try {
        const { kbId, documentIds, fileId } = req.body;

        let targetKbId = kbId;
        let docs = [];

        // 如果提供了 fileId，查找或创建对应的知识库
        if (fileId && !kbId) {
            const kbResult = await pool.query(
                'SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1',
                [fileId]
            );

            if (kbResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: '未找到该文件对应的知识库，请先创建知识库'
                });
            }

            targetKbId = kbResult.rows[0].openwebui_kb_id;

            // 获取该文件关联的所有文档
            const docsResult = await pool.query(`
                SELECT d.id, d.file_name, d.file_path
                FROM documents d
                JOIN assets a ON d.asset_code = a.asset_code AND a.file_id = $1
                UNION
                SELECT d.id, d.file_name, d.file_path
                FROM documents d
                JOIN spaces s ON d.space_code = s.space_code AND s.file_id = $1
                UNION
                SELECT d.id, d.file_name, d.file_path
                FROM documents d
                JOIN asset_specs sp ON d.spec_code = sp.spec_code AND sp.file_id = $1
            `, [fileId]);

            docs = docsResult.rows.map(d => ({
                id: d.id,
                path: `./public${d.file_path}`,
            }));
        } else if (documentIds && documentIds.length > 0) {
            // 根据文档 ID 获取文档信息
            const docsResult = await pool.query(
                'SELECT id, file_path FROM documents WHERE id = ANY($1)',
                [documentIds]
            );

            docs = docsResult.rows.map(d => ({
                id: d.id,
                path: `./public${d.file_path}`,
            }));
        }

        if (!targetKbId) {
            return res.status(400).json({ success: false, error: '请提供 kbId 或 fileId' });
        }

        if (docs.length === 0) {
            return res.json({ success: true, message: '没有需要同步的文档', data: { synced: 0 } });
        }

        // 执行同步
        const result = await openwebuiService.syncDocumentsToKB(targetKbId, docs);

        // 更新同步状态到数据库
        for (const r of result.results) {
            if (r.status === 'synced') {
                await pool.query(`
                    INSERT INTO kb_documents (kb_id, document_id, openwebui_doc_id, sync_status, synced_at)
                    SELECT kb.id, $1, $2, 'synced', CURRENT_TIMESTAMP
                    FROM knowledge_bases kb WHERE kb.openwebui_kb_id = $3
                    ON CONFLICT (document_id) DO UPDATE SET
                        sync_status = 'synced',
                        openwebui_doc_id = EXCLUDED.openwebui_doc_id,
                        synced_at = CURRENT_TIMESTAMP
                `, [r.id, r.openwebui_doc_id, targetKbId]);
            } else if (r.status === 'failed') {
                await pool.query(`
                    INSERT INTO kb_documents (kb_id, document_id, sync_status, sync_error)
                    SELECT kb.id, $1, 'failed', $2
                    FROM knowledge_bases kb WHERE kb.openwebui_kb_id = $3
                    ON CONFLICT (document_id) DO UPDATE SET
                        sync_status = 'failed',
                        sync_error = EXCLUDED.sync_error
                `, [r.id, r.error, targetKbId]);
            }
        }

        res.json({
            success: true,
            data: {
                total: docs.length,
                synced: result.success,
                failed: result.failed,
                results: result.results,
            }
        });
    } catch (error) {
        console.error('同步知识库失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 使用 RAG 进行查询
 * POST /api/v1/ai/query
 * body: { prompt, kbId, fileId, allowWebSearch }
 */
router.post('/query', async (req, res) => {
    try {
        const { prompt, kbId, fileId, allowWebSearch } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, error: '请提供查询内容' });
        }

        let targetKbId = kbId;

        // 如果提供了 fileId，查找对应的知识库
        if (fileId && !kbId) {
            const kbResult = await pool.query(
                'SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1',
                [fileId]
            );

            if (kbResult.rows.length > 0) {
                targetKbId = kbResult.rows[0].openwebui_kb_id;
            }
        }

        const result = await openwebuiService.chatWithRAG({
            prompt,
            kbId: targetKbId,
            allowWebSearch: allowWebSearch ?? true,
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('RAG 查询失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取 AI 分析上下文
 * GET /api/v1/ai/context
 * 根据房间编码获取关联设备、文档和知识库信息
 * Query: roomCode, fileId
 */
router.get('/context', async (req, res) => {
    try {
        const { roomCode, fileId } = req.query;

        if (!roomCode) {
            return res.status(400).json({ success: false, error: '缺少 roomCode 参数' });
        }

        // 1. 获取房间信息
        const spaceResult = await pool.query(
            `SELECT * FROM spaces WHERE space_code = $1 ${fileId ? 'AND file_id = $2' : ''} LIMIT 1`,
            fileId ? [roomCode, fileId] : [roomCode]
        );

        if (spaceResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: '未找到该房间' });
        }

        const space = spaceResult.rows[0];
        const targetFileId = space.file_id;

        // 2. 获取房间内的设备列表（room 字段包含房间名称和编码，如"泵房 BF02US01"）
        const assetsResult = await pool.query(`
            SELECT a.asset_code, a.name, a.spec_code, 
                   s.spec_name, s.category, s.family, s.type, s.classification_code, s.classification_desc
            FROM assets a
            LEFT JOIN asset_specs s ON a.spec_code = s.spec_code AND a.file_id = s.file_id
            WHERE a.room ILIKE $1 AND a.file_id = $2
            ORDER BY a.asset_code
            LIMIT 50
        `, [`%${roomCode}%`, targetFileId]);

        // 3. 获取相关文档
        // 3.1 房间直接关联的文档
        const spaceDocsResult = await pool.query(`
                SELECT d.id, d.title, d.file_name, d.file_path, d.file_type, 'space' as source_type
                FROM documents d
                JOIN spaces s ON d.space_code = s.space_code
                WHERE d.space_code = $1 AND s.file_id = $2
                  AND d.file_type IN ('pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'md', 'txt')
            `, [roomCode, targetFileId]);

        // 3.2 房间内资产关联的文档
        const assetCodes = assetsResult.rows.map(a => a.asset_code);
        let assetDocsResult = { rows: [] };
        if (assetCodes.length > 0) {
            assetDocsResult = await pool.query(`
                SELECT id, title, file_name, file_path, file_type, 'asset' as source_type
                FROM documents
                WHERE asset_code = ANY($1)
                  AND file_type IN ('pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'md', 'txt')
            `, [assetCodes]);
        }

        // 3.3 设备规格关联的文档
        const specCodes = [...new Set(assetsResult.rows.map(a => a.spec_code).filter(Boolean))];
        let specDocsResult = { rows: [] };
        if (specCodes.length > 0) {
            specDocsResult = await pool.query(`
                SELECT id, title, file_name, file_path, file_type, 'spec' as source_type
                FROM documents
                WHERE spec_code = ANY($1)
                  AND file_type IN ('pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'md', 'txt')
            `, [specCodes]);
        }

        // 合并文档并去重
        const allDocs = [...spaceDocsResult.rows, ...assetDocsResult.rows, ...specDocsResult.rows];
        const uniqueDocs = allDocs.filter((doc, index, self) =>
            index === self.findIndex(d => d.id === doc.id)
        );

        // 4. 获取知识库 ID
        const kbResult = await pool.query(
            'SELECT openwebui_kb_id, kb_name FROM knowledge_bases WHERE file_id = $1',
            [targetFileId]
        );

        const knowledgeBase = kbResult.rows.length > 0 ? {
            id: kbResult.rows[0].openwebui_kb_id,
            name: kbResult.rows[0].kb_name
        } : null;

        res.json({
            success: true,
            data: {
                space: {
                    code: space.space_code,
                    name: space.name,
                    classification: space.classification_code,
                    classificationDesc: space.classification_desc
                },
                assets: assetsResult.rows.map(a => ({
                    code: a.asset_code,
                    name: a.name,
                    specCode: a.spec_code,
                    specName: a.spec_name,
                    category: a.category,
                    family: a.family,
                    type: a.type
                })),
                documents: uniqueDocs.map(d => ({
                    id: d.id,
                    title: d.title || d.file_name,
                    fileName: d.file_name,
                    fileType: d.file_type,
                    sourceType: d.source_type
                })),
                knowledgeBase,
                fileId: targetFileId
            }
        });
    } catch (error) {
        console.error('获取 AI 上下文失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 格式化 AI 回复中的来源链接
 * POST /api/v1/ai/format-sources
 * 将来源文档名转换为系统内可点击的预览 URL
 * Body: { sources: [{ name, ... }], fileId }
 */
router.post('/format-sources', async (req, res) => {
    try {
        const { sources, fileId } = req.body;

        if (!sources || !Array.isArray(sources)) {
            return res.status(400).json({ success: false, error: '缺少 sources 数组' });
        }

        const formattedSources = [];

        for (const source of sources) {
            const sourceName = source.name || source.title || source;

            // 尝试在 documents 表中匹配文件名
            const docResult = await pool.query(`
                SELECT id, title, file_name, file_path
                FROM documents
                WHERE (file_name ILIKE $1 OR title ILIKE $1)
                ${fileId ? 'AND (space_code IN (SELECT space_code FROM spaces WHERE file_id = $2) OR asset_code IN (SELECT asset_code FROM assets WHERE file_id = $2))' : ''}
                LIMIT 1
            `, fileId ? [`%${sourceName}%`, fileId] : [`%${sourceName}%`]);

            if (docResult.rows.length > 0) {
                const doc = docResult.rows[0];
                formattedSources.push({
                    name: sourceName,
                    title: doc.title || doc.file_name,
                    url: `/api/documents/${doc.id}/preview`,
                    documentId: doc.id,
                    isInternal: true
                });
            } else {
                // 外部来源或未找到匹配
                formattedSources.push({
                    name: sourceName,
                    url: source.url || null,
                    isInternal: false
                });
            }
        }

        res.json({
            success: true,
            data: { formattedSources }
        });
    } catch (error) {
        console.error('格式化来源失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

