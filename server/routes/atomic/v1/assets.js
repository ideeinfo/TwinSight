/**
 * Atomic API - 资产查询端点
 * 
 * POST /api/atomic/v1/assets/query
 * 调用现有的 RDS 资产/层级树查询
 */

import { Router } from 'express';
import db from '../../../db/index.js';

const router = Router();

/**
 * POST /query
 * 统一资产查询
 * 
 * Body: {
 *   fileId: number,                      // 模型文件 ID（必填）
 *   aspectType?: 'function' | 'location' | 'power',
 *   code?: string,                       // RDS 编码（模糊匹配）
 *   level?: number,                      // 最大层级
 *   format?: 'flat' | 'tree'             // 返回格式（默认 flat）
 * }
 */
router.post('/query', async (req, res) => {
    const startTime = Date.now();

    try {
        const { fileId, aspectType, code, level, format = 'flat' } = req.body;

        // fileId 必填（也可通过 scope 头获取）
        const resolvedFileId = fileId || req.scope?.fileId;
        if (!resolvedFileId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'fileId is required (in body or X-File-Id header)',
                    request_id: req.tracing?.requestId
                }
            });
        }

        let query = `
      SELECT DISTINCT 
        o.id,
        a.full_code as code,
        a.parent_code,
        a.aspect_type,
        a.hierarchy_level as level,
        o.name,
        o.bim_guid,
        o.mc_code,
        o.ref_code
      FROM rds_aspects a
      JOIN rds_objects o ON a.object_id = o.id
      WHERE o.file_id = $1
    `;
        const params = [resolvedFileId];
        let paramIndex = 2;

        if (aspectType) {
            query += ` AND a.aspect_type = $${paramIndex++}`;
            params.push(aspectType);
        }

        if (code) {
            query += ` AND a.full_code ILIKE $${paramIndex++}`;
            params.push(`%${code}%`);
        }

        if (level) {
            query += ` AND a.hierarchy_level <= $${paramIndex++}`;
            params.push(parseInt(level));
        }

        query += ` ORDER BY a.aspect_type, a.hierarchy_level, a.full_code`;

        const result = await db.query(query, params);

        // 如果请求 tree 格式，构建层级结构
        let data;
        if (format === 'tree') {
            data = buildTree(result.rows);
        } else {
            data = result.rows.map(row => ({
                id: row.id,
                code: row.code,
                parentCode: row.parent_code,
                aspectType: row.aspect_type,
                level: row.level,
                name: row.name,
                bimGuid: row.bim_guid,
                mcCode: row.mc_code,
                refCode: row.ref_code
            }));
        }

        res.json({
            success: true,
            data,
            meta: {
                request_id: req.tracing?.requestId,
                duration_ms: Date.now() - startTime,
                total: result.rowCount,
                format
            }
        });
    } catch (error) {
        console.error('❌ [atomic/assets/query]', error.message);
        res.status(500).json({
            success: false,
            error: {
                code: 'ASSETS_QUERY_FAILED',
                message: error.message,
                request_id: req.tracing?.requestId
            }
        });
    }
});

/**
 * 将扁平数据构建成树形结构
 */
function buildTree(rows) {
    const nodeMap = new Map();
    const roots = [];

    rows.forEach(row => {
        const node = {
            id: row.id,
            code: row.code,
            name: row.name,
            level: row.level,
            aspectType: row.aspect_type,
            bimGuid: row.bim_guid,
            mcCode: row.mc_code,
            refCode: row.ref_code,
            children: []
        };
        nodeMap.set(row.code, node);
    });

    for (const [code, node] of nodeMap.entries()) {
        const row = rows.find(r => r.code === code);
        if (row.parent_code && nodeMap.has(row.parent_code)) {
            nodeMap.get(row.parent_code).children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

export default router;
