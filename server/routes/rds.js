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
import multer from 'multer';
import FormData from 'form-data';
import db from '../db/index.js';

// 配置 multer (使用内存存储，因为我们要直接转发到 logic engine)
const storage = multer.memoryStorage();
const upload = multer({ storage });

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
                o.id,
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
        // 方案 B: 查询所有节点，在内存中构建树（避免 SQL 递归性能问题）
        const query = `
            SELECT 
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
            ${aspectType ? 'AND a.aspect_type = $2' : ''}
            ORDER BY a.hierarchy_level, a.full_code
        `;

        const params = aspectType ? [fileId, aspectType] : [fileId];
        const result = await db.query(query, params);
        const allNodes = result.rows;

        // 构建树形结构
        const nodeMap = new Map();
        const rootNodes = [];

        // 1. 构建哈希映射 (Code -> [Node list])
        // Fix: Store array of nodes for each code to handle duplicates (e.g., multiple objects claiming '===DY1.')
        allNodes.forEach(row => {
            const node = {
                id: row.id,
                label: row.name, // Keep for backward compat if any
                name: row.name, // Required by formatNode
                code: row.code,
                full_code: row.code,
                parent_code: row.parent_code,
                level: row.hierarchy_level,
                aspect_type: row.aspect_type, // Required by formatNode
                bim_guid: row.bim_guid,
                mc_code: row.mc_code, // Required
                ref_code: row.ref_code, // Required
                children: [],
                is_duplicate: false
            };

            if (!nodeMap.has(row.code)) {
                nodeMap.set(row.code, []);
            }
            nodeMap.get(row.code).push(node);
        });

        // 2. 组装树结构
        // Iterate through every node in the map arrays
        for (const [code, nodes] of nodeMap.entries()) {
            nodes.forEach(node => {
                const parentCode = node.parent_code;

                if (parentCode && nodeMap.has(parentCode)) {
                    const potentialParents = nodeMap.get(parentCode);

                    // Add to ALL matching parents
                    potentialParents.forEach((parent, index) => {
                        if (index === 0) {
                            // First parent: standard add
                            parent.children.push(node);
                        } else {
                            // Secondary parents: Clone node to avoid ID collision in UI
                            const clone = { ...node, id: `${node.id}_dup_${index}` };
                            parent.children.push(clone);
                        }
                    });
                } else {
                    // No parent found in map -> Root node
                    rootNodes.push(node);
                }
            });
        }

        // 3. 格式化输出
        const formatNode = (node) => ({
            id: node.id,
            code: node.code,
            name: node.name,
            level: node.level,
            aspectType: node.aspect_type,
            bimGuid: node.bim_guid,
            mcCode: node.mc_code, // BIM 关联编码
            refCode: node.ref_code, // 兼容性：系统内部编码
            children: node.children.map(formatNode)
        });

        const treeData = rootNodes.map(formatNode);

        res.json({
            success: true,
            data: treeData,
            total: allNodes.length
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
        const params = [fileId, code];

        if (includeChildren === 'true') {
            // 使用 LIKE 查询替代递归 CTE (利用 RDS 编码的层级特性)
            // 注意：需要转义 code 中的特殊字符（如下划线），但 RDS 编码通常比较规范
            query = `
                SELECT DISTINCT o.bim_guid, o.ref_code
                FROM rds_objects o
                JOIN rds_aspects a ON a.object_id = o.id
                WHERE o.file_id = $1 
                    AND (a.full_code = $2 OR a.full_code LIKE $2 || '.%')
            `;
        } else {
            // 仅当前节点
            query = `
                SELECT DISTINCT o.bim_guid, o.ref_code
                FROM rds_objects o
                JOIN rds_aspects a ON a.object_id = o.id
                WHERE o.file_id = $1 
                    AND a.full_code = $2
            `;
        }

        const result = await db.query(query, params);

        // 分离 GUID 和 RefCodes
        const guids = result.rows
            .map(r => r.bim_guid)
            .filter(g => g); // 过滤 null/empty

        const refCodes = result.rows
            .map(r => r.ref_code)
            .filter(c => c); // 过滤 null/empty

        res.json({
            success: true,
            guids: guids,
            refCodes: [...new Set(refCodes)], // 去重
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

// ==================== 数据导入接口 ====================

/**
 * POST /api/rds/import/:fileId
 * 上传 Excel 并导入到数据库（代理到 Logic Engine）
 */
router.post('/import/:fileId', upload.single('file'), async (req, res) => {
    const { fileId } = req.params;
    // 注意：multer 解析完后参数在 req.query 或 req.body
    const { clearExisting, createRelations } = req.query;

    if (!req.file) {
        return res.status(400).json({ success: false, error: '未找到上传文件' });
    }

    try {
        console.log(`[RDS] 正在转发文件导入请求: fileId=${fileId}, clear=${clearExisting}`);

        // 构造 FormData
        const formData = new FormData();
        // 将内存中的 buffer 作为文件流
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        // 构造 Logic Engine URL
        // 注意 Logic Engine 期望的参数名是 clear_existing 和 create_relations
        const targetUrl = `${LOGIC_ENGINE_URL}/api/import/excel/${fileId}?clear_existing=${clearExisting || true}&create_relations=${createRelations !== 'false'}`;

        // 发送给 Logic Engine
        const response = await axios.post(targetUrl, formData, {
            headers: {
                ...formData.getHeaders()
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        res.json({
            success: true,
            ...response.data
        });
    } catch (error) {
        console.error('导入转发失败:', error.message);
        if (error.response) {
            console.error('Logic Engine Error:', error.response.data);
        }
        res.status(500).json({
            success: false,
            error: error.response?.data?.detail || error.message
        });
    }
});

/**
 * DELETE /api/rds/import/:fileId
 * 清除指定文件的 RDS 数据
 */
router.delete('/import/:fileId', async (req, res) => {
    const { fileId } = req.params;

    try {
        const response = await axios.delete(
            `${LOGIC_ENGINE_URL}/api/import/${fileId}`,
            { timeout: 30000 }
        );
        res.json({
            success: true,
            ...response.data
        });
    } catch (error) {
        console.error('清除数据失败:', error);
        res.status(500).json({
            success: false,
            error: error.response?.data?.detail || error.message
        });
    }
});

/**
 * GET /api/rds/import/:fileId/stats
 * 获取指定文件的 RDS 数据统计
 */
router.get('/import/:fileId/stats', async (req, res) => {
    const { fileId } = req.params;

    try {
        const response = await axios.get(
            `${LOGIC_ENGINE_URL}/api/import/${fileId}/stats`,
            { timeout: 10000 }
        );
        res.json({
            success: true,
            ...response.data
        });
    } catch (error) {
        console.error('获取统计失败:', error);
        res.status(500).json({
            success: false,
            error: error.response?.data?.detail || error.message
        });
    }
});


// ==================== 电源网络图接口 ====================

/**
 * GET /api/rds/power-graph/:fileId
 * 获取电源网络图数据 (AntV G6 格式)
 * 
 * Query params:
 * - nodeType: 过滤节点类型 (source/bus/feeder/device)
 * - maxLevel: 最大层级深度
 * 
 * Returns: { nodes: [...], edges: [...] }
 */
router.get('/power-graph/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const { nodeType, maxLevel } = req.query;

    try {
        // 查询节点
        let nodeQuery = `
            SELECT 
                pn.id,
                pn.full_code as code,
                pn.short_code,
                pn.parent_code,
                pn.label,
                pn.level,
                pn.node_type as type,
                pn.object_id,
                o.bim_guid,
                o.ref_code as mc_code
            FROM rds_power_nodes pn
            LEFT JOIN rds_objects o ON pn.object_id = o.id
            WHERE pn.file_id = $1
        `;
        const nodeParams = [fileId];
        let paramIndex = 2;

        if (nodeType) {
            nodeQuery += ` AND pn.node_type = $${paramIndex}`;
            nodeParams.push(nodeType);
            paramIndex++;
        }

        if (maxLevel) {
            nodeQuery += ` AND pn.level <= $${paramIndex}`;
            nodeParams.push(parseInt(maxLevel));
            paramIndex++;
        }

        nodeQuery += ' ORDER BY pn.level, pn.full_code';

        const nodeResult = await db.query(nodeQuery, nodeParams);

        // 查询边
        const edgeQuery = `
            SELECT 
                pe.id,
                pe.source_node_id as source,
                pe.target_node_id as target,
                pe.relation_type as type,
                pe.properties
            FROM rds_power_edges pe
            WHERE pe.file_id = $1
            ORDER BY pe.relation_type
        `;
        const edgeResult = await db.query(edgeQuery, [fileId]);

        // 格式化为 G6 格式
        const nodes = nodeResult.rows.map(row => ({
            id: row.id,
            label: row.label || row.short_code,
            code: row.code,
            shortCode: row.short_code,
            parentCode: row.parent_code,
            level: row.level,
            nodeType: row.type,
            objectId: row.object_id,
            bimGuid: row.bim_guid,
            mcCode: row.mc_code,
            // G6 特有属性
            style: {
                fill: getNodeColor(row.type),
            }
        }));

        const edges = edgeResult.rows.map(row => ({
            id: row.id,
            source: row.source,
            target: row.target,
            type: row.type,
            properties: row.properties
        }));

        res.json({
            success: true,
            nodes,
            edges,
            stats: {
                totalNodes: nodes.length,
                totalEdges: edges.length
            }
        });

    } catch (error) {
        console.error('获取电源图失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 辅助函数：根据节点类型返回颜色
function getNodeColor(nodeType) {
    switch (nodeType) {
        case 'source': return '#ff6b6b';  // 红色 - 电源
        case 'bus': return '#ffa94d';      // 橙色 - 母线
        case 'feeder': return '#69db7c';   // 绿色 - 馈线柜
        case 'device': return '#74c0fc';   // 蓝色 - 设备
        default: return '#adb5bd';         // 灰色 - 未知
    }
}


/**
 * GET /api/rds/power-trace/:fileId/:nodeCode
 * 追溯电源路径 (上游或下游)
 * 
 * Query params:
 * - direction: 'upstream' (追溯供电来源) 或 'downstream' (追溯供电目标)
 * - maxDepth: 最大追溯深度 (默认 10)
 * 
 * Returns: { path: [...nodeIds], nodes: [...], edges: [...] }
 */
router.get('/power-trace/:fileId/:nodeCode', async (req, res) => {
    const { fileId, nodeCode } = req.params;
    const { direction = 'upstream', maxDepth = 10 } = req.query;

    try {
        // 先找到起始节点
        const startNodeResult = await db.query(`
            SELECT id, full_code, label FROM rds_power_nodes
            WHERE file_id = $1 AND full_code = $2
        `, [fileId, decodeURIComponent(nodeCode)]);

        if (startNodeResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: `未找到节点: ${nodeCode}`
            });
        }

        const startNodeId = startNodeResult.rows[0].id;

        // 使用递归 CTE 追溯路径
        // 注意：设备节点通过 'power_supply' 边连接，层级节点通过 'hierarchy' 边连接
        const traceQuery = direction === 'upstream' ? `
            WITH RECURSIVE trace AS (
                -- 起始节点 (包括 hierarchy 和 power_supply 边)
                SELECT 
                    target_node_id as node_id,
                    source_node_id as next_node_id,
                    1 as depth,
                    ARRAY[target_node_id] as path
                FROM rds_power_edges
                WHERE target_node_id = $1 AND relation_type IN ('hierarchy', 'power_supply')

                UNION ALL

                -- 递归向上
                SELECT 
                    e.target_node_id,
                    e.source_node_id,
                    t.depth + 1,
                    t.path || e.source_node_id
                FROM rds_power_edges e
                JOIN trace t ON e.target_node_id = t.next_node_id
                WHERE t.depth < $2 AND relation_type IN ('hierarchy', 'power_supply')
                    AND NOT (e.source_node_id = ANY(t.path))  -- 防止环
            )
            SELECT DISTINCT node_id, next_node_id, depth, path FROM trace
            ORDER BY depth
        ` : `
            WITH RECURSIVE trace AS (
                -- 起始节点
                SELECT 
                    source_node_id as node_id,
                    target_node_id as next_node_id,
                    1 as depth,
                    ARRAY[source_node_id] as path
                FROM rds_power_edges
                WHERE source_node_id = $1 AND relation_type = 'hierarchy'

                UNION ALL

                -- 递归向下
                SELECT 
                    e.source_node_id,
                    e.target_node_id,
                    t.depth + 1,
                    t.path || e.target_node_id
                FROM rds_power_edges e
                JOIN trace t ON e.source_node_id = t.next_node_id
                WHERE t.depth < $2 AND relation_type = 'hierarchy'
                    AND NOT (e.target_node_id = ANY(t.path))  -- 防止环
            )
            SELECT DISTINCT node_id, next_node_id, depth, path FROM trace
            ORDER BY depth
        `;

        const traceResult = await db.query(traceQuery, [startNodeId, parseInt(maxDepth)]);

        // 收集所有涉及的节点ID
        const nodeIds = new Set([startNodeId]);
        traceResult.rows.forEach(row => {
            if (row.node_id) nodeIds.add(row.node_id);
            if (row.next_node_id) nodeIds.add(row.next_node_id);
        });

        // 查询这些节点的详细信息
        const nodeIdsArray = Array.from(nodeIds);
        const nodesResult = await db.query(`
            SELECT 
                pn.id, pn.full_code as code, pn.label, pn.level, pn.node_type as type,
                o.bim_guid
            FROM rds_power_nodes pn
            LEFT JOIN rds_objects o ON pn.object_id = o.id
            WHERE pn.id = ANY($1)
        `, [nodeIdsArray]);

        // 查询这些节点之间的边
        const edgesResult = await db.query(`
            SELECT id, source_node_id as source, target_node_id as target, relation_type as type
            FROM rds_power_edges
            WHERE source_node_id = ANY($1) AND target_node_id = ANY($1)
        `, [nodeIdsArray]);

        res.json({
            success: true,
            startNode: startNodeResult.rows[0],
            direction,
            path: nodeIdsArray,
            nodes: nodesResult.rows,
            edges: edgesResult.rows
        });

    } catch (error) {
        console.error('电源路径追溯失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


export default router;

