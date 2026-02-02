/**
 * RDS (Reference Designation System) 路由
 * 
 * IEC 81346-12 工程数据管理接口
 * 
 * 功能:
 * - 方面树数据查询
 * - 编码解析代理
 * - 拓扑追溯代理
 * - BIM 模型联动
 */

import express from 'express';
import axios from 'axios';
import db from '../db/index.js';

const router = express.Router();

// Python Logic Engine 服务地址
const LOGIC_ENGINE_URL = process.env.LOGIC_ENGINE_URL || 'http://localhost:8000';

// ==================== 方面树查询接口 ====================

/**
 * GET /api/rds/tree/:fileId
 * 获取指定文件的方面树数据
 * 
 * Query params:
 * - aspectType: 方面类型 (function/location/power)
 * - level: 最大层级 (可选，默认返回全部)
 */
router.get('/tree/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const { aspectType, level } = req.query;

    try {
        let query = `
            SELECT DISTINCT 
                a.full_code as code,
                a.parent_code,
                a.aspect_type,
                a.hierarchy_level as level,
                o.name,
                o.bim_guid,
                EXISTS(
                    SELECT 1 FROM rds_aspects a2 
                    WHERE a2.parent_code = a.full_code 
                    AND a2.object_id IN (
                        SELECT id FROM rds_objects WHERE file_id = $1
                    )
                ) as has_children
            FROM rds_aspects a
            JOIN rds_objects o ON a.object_id = o.id
            WHERE o.file_id = $1
        `;

        const params = [fileId];
        let paramIndex = 2;

        if (aspectType) {
            query += ` AND a.aspect_type = $${paramIndex++}`;
            params.push(aspectType);
        }

        if (level) {
            query += ` AND a.hierarchy_level <= $${paramIndex++}`;
            params.push(parseInt(level));
        }

        query += ` ORDER BY a.aspect_type, a.hierarchy_level, a.full_code`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('获取方面树失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/rds/tree/:fileId/hierarchy
 * 获取层级化的方面树结构（已构建父子关系）
 */
router.get('/tree/:fileId/hierarchy', async (req, res) => {
    const { fileId } = req.params;
    const { aspectType } = req.query;

    try {
        // 使用递归 CTE 构建层级树
        const query = `
            WITH RECURSIVE tree AS (
                -- 根节点（没有父节点的节点）
                SELECT 
                    a.full_code as code,
                    a.parent_code,
                    a.aspect_type,
                    a.hierarchy_level as level,
                    o.name,
                    o.bim_guid,
                    ARRAY[a.full_code] as path
                FROM rds_aspects a
                JOIN rds_objects o ON a.object_id = o.id
                WHERE o.file_id = $1 
                    AND a.parent_code IS NULL
                    ${aspectType ? 'AND a.aspect_type = $2' : ''}
                
                UNION ALL
                
                -- 递归查找子节点
                SELECT 
                    a.full_code as code,
                    a.parent_code,
                    a.aspect_type,
                    a.hierarchy_level as level,
                    o.name,
                    o.bim_guid,
                    t.path || a.full_code
                FROM rds_aspects a
                JOIN rds_objects o ON a.object_id = o.id
                JOIN tree t ON a.parent_code = t.code
                WHERE o.file_id = $1
            )
            SELECT * FROM tree ORDER BY path;
        `;

        const params = aspectType ? [fileId, aspectType] : [fileId];
        const result = await db.query(query, params);

        // 构建树形结构
        const buildTree = (nodes, parentCode = null) => {
            return nodes
                .filter(n => n.parent_code === parentCode)
                .map(node => ({
                    code: node.code,
                    name: node.name,
                    level: node.level,
                    aspectType: node.aspect_type,
                    bimGuid: node.bim_guid,
                    children: buildTree(nodes, node.code)
                }));
        };

        const tree = buildTree(result.rows);

        res.json({
            success: true,
            data: tree,
            total: result.rowCount
        });
    } catch (error) {
        console.error('获取层级树失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== 编码解析代理 ====================

/**
 * POST /api/rds/parse/code
 * 代理调用 Logic Engine 解析单个编码
 */
router.post('/parse/code', async (req, res) => {
    try {
        const response = await axios.post(`${LOGIC_ENGINE_URL}/api/parse/code`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('编码解析失败:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.detail || error.message
        });
    }
});

/**
 * POST /api/rds/parse/hierarchy
 * 代理调用 Logic Engine 展开层级
 */
router.post('/parse/hierarchy', async (req, res) => {
    try {
        const response = await axios.post(`${LOGIC_ENGINE_URL}/api/parse/hierarchy`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('层级展开失败:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.detail || error.message
        });
    }
});

// ==================== 拓扑追溯代理 ====================

/**
 * POST /api/rds/topology/trace
 * 代理调用 Logic Engine 进行拓扑追溯
 */
router.post('/topology/trace', async (req, res) => {
    try {
        const response = await axios.post(`${LOGIC_ENGINE_URL}/api/topology/trace`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('拓扑追溯失败:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.detail || error.message
        });
    }
});

// ==================== BIM 联动接口 ====================

/**
 * GET /api/rds/bim/:fileId/lookup/:guid
 * 通过 BIM GUID 反向查找 RDS 对象及其方面编码
 */
router.get('/bim/:fileId/lookup/:guid', async (req, res) => {
    const { fileId, guid } = req.params;

    try {
        const query = `
            SELECT 
                o.id as object_id,
                o.ref_code,
                o.object_type,
                o.name,
                json_agg(json_build_object(
                    'aspectType', a.aspect_type,
                    'fullCode', a.full_code,
                    'level', a.hierarchy_level
                )) as aspects
            FROM rds_objects o
            LEFT JOIN rds_aspects a ON a.object_id = o.id
            WHERE o.file_id = $1 AND o.bim_guid = $2
            GROUP BY o.id, o.ref_code, o.object_type, o.name
        `;

        const result = await db.query(query, [fileId, guid]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: '未找到对应的 RDS 对象'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('BIM GUID 查找失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/rds/bim/:fileId/guids
 * 获取指定方面编码下的所有 BIM GUID
 * 用于模型高亮和隔离
 */
router.get('/bim/:fileId/guids', async (req, res) => {
    const { fileId } = req.params;
    const { code, aspectType, includeChildren } = req.query;

    try {
        let query;

        if (includeChildren === 'true') {
            // 包含子节点的查询
            query = `
                WITH RECURSIVE subtree AS (
                    SELECT full_code FROM rds_aspects 
                    WHERE full_code = $2 
                    AND object_id IN (SELECT id FROM rds_objects WHERE file_id = $1)
                    
                    UNION ALL
                    
                    SELECT a.full_code 
                    FROM rds_aspects a
                    JOIN subtree s ON a.parent_code = s.full_code
                    WHERE a.object_id IN (SELECT id FROM rds_objects WHERE file_id = $1)
                )
                SELECT DISTINCT o.bim_guid
                FROM rds_objects o
                JOIN rds_aspects a ON a.object_id = o.id
                WHERE o.file_id = $1 
                    AND a.full_code IN (SELECT full_code FROM subtree)
                    AND o.bim_guid IS NOT NULL
            `;
        } else {
            // 仅当前节点
            query = `
                SELECT DISTINCT o.bim_guid
                FROM rds_objects o
                JOIN rds_aspects a ON a.object_id = o.id
                WHERE o.file_id = $1 
                    AND a.full_code = $2
                    AND o.bim_guid IS NOT NULL
            `;
        }

        const result = await db.query(query, [fileId, code]);

        res.json({
            success: true,
            guids: result.rows.map(r => r.bim_guid),
            total: result.rowCount
        });
    } catch (error) {
        console.error('获取 BIM GUIDs 失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== Logic Engine 健康检查 ====================

/**
 * GET /api/rds/health
 * 检查 Logic Engine 服务状态
 */
router.get('/health', async (req, res) => {
    try {
        const response = await axios.get(`${LOGIC_ENGINE_URL}/health`, { timeout: 5000 });
        res.json({
            success: true,
            nodeServer: 'ok',
            logicEngine: response.data
        });
    } catch (error) {
        res.json({
            success: false,
            nodeServer: 'ok',
            logicEngine: 'unreachable',
            error: error.message
        });
    }
});

export default router;
