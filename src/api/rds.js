/**
 * RDS (Reference Designation System) API 模块
 * 
 * 提供 IEC 81346-12 工程数据管理相关接口封装
 */

// API 基础 URL
const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

// 简单的请求封装
const request = {
    async get(url) {
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('RDS API GET 请求失败:', error);
            return { success: false, error: error.message };
        }
    },
    async post(url, body, options = {}) {
        try {
            const isFormData = body instanceof FormData;
            const response = await fetch(`${API_BASE}${url}`, {
                method: 'POST',
                headers: isFormData ? {} : {
                    'Content-Type': 'application/json'
                },
                body: isFormData ? body : JSON.stringify(body)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('RDS API POST 请求失败:', error);
            return { success: false, error: error.message };
        }
    }
};

/**
 * RDS API URL 前缀
 */
const RDS_BASE = '/api/rds'

/**
 * 方面类型枚举
 */
export const AspectType = {
    FUNCTION: 'function',   // 工艺功能 (=)
    LOCATION: 'location',   // 位置 (++)
    POWER: 'power'          // 电源 (===)
}

/**
 * 方面类型中文标签
 */
export const AspectTypeLabels = {
    [AspectType.FUNCTION]: '工艺功能',
    [AspectType.LOCATION]: '位置',
    [AspectType.POWER]: '电源'
}

/**
 * 方面类型前缀符号
 */
export const AspectTypePrefixes = {
    [AspectType.FUNCTION]: '=',
    [AspectType.LOCATION]: '++',
    [AspectType.POWER]: '==='
}

// ==================== 方面树查询 ====================

/**
 * 获取指定文件的方面树数据
 * 
 * @param {number} fileId - 模型文件 ID
 * @param {object} options - 查询选项
 * @param {string} options.aspectType - 方面类型 (function/location/power)
 * @param {number} options.level - 最大层级 (可选)
 * @returns {Promise<{success: boolean, data: Array, total: number}>}
 */
export async function getAspectTree(fileId, options = {}) {
    const params = new URLSearchParams()
    if (options.aspectType) params.append('aspectType', options.aspectType)
    if (options.level) params.append('level', options.level)

    const queryString = params.toString()
    const url = `${RDS_BASE}/tree/${fileId}${queryString ? '?' + queryString : ''}`

    return request.get(url)
}

/**
 * 获取层级化的方面树结构
 * 
 * @param {number} fileId - 模型文件 ID
 * @param {string} aspectType - 方面类型 (可选)
 * @returns {Promise<{success: boolean, data: Array, total: number}>}
 */
export async function getAspectHierarchy(fileId, aspectType) {
    const params = aspectType ? `?aspectType=${aspectType}` : ''
    return request.get(`${RDS_BASE}/tree/${fileId}/hierarchy${params}`)
}

// ==================== 编码解析 ====================

/**
 * 解析单个 IEC 编码
 * 
 * @param {string} code - IEC 编码，如 "=TA001.BJ01.PP01"
 * @returns {Promise<{fullCode: string, prefix: string, aspectType: string, hierarchyLevel: number, parentCode: string, segments: string[]}>}
 */
export async function parseCode(code) {
    return request.post(`${RDS_BASE}/parse/code`, { code })
}

/**
 * 展开编码的完整层级链
 * 
 * @param {string} code - IEC 编码
 * @returns {Promise<Array>} - 层级链中所有节点
 */
export async function parseHierarchy(code) {
    return request.post(`${RDS_BASE}/parse/hierarchy`, { code })
}

// ==================== 拓扑追溯 ====================

/**
 * 追溯方向枚举
 */
export const TraceDirection = {
    UPSTREAM: 'upstream',     // 向上游（电源方向）
    DOWNSTREAM: 'downstream'  // 向下游（负载方向）
}

/**
 * 关系类型枚举
 */
export const RelationType = {
    FEEDS_POWER_TO: 'FEEDS_POWER_TO',  // 供电
    PART_OF: 'PART_OF',                 // 构成
    LOCATED_IN: 'LOCATED_IN',           // 位于
    CONTROLS: 'CONTROLS'                // 控制
}

/**
 * 拓扑追溯
 * 
 * @param {string} objectId - 起始对象 ID
 * @param {string} direction - 追溯方向 (upstream/downstream)
 * @param {string} relationType - 关系类型
 * @returns {Promise<{nodes: Array, total: number}>}
 */
export async function traceTopology(objectId, direction = TraceDirection.UPSTREAM, relationType = RelationType.FEEDS_POWER_TO) {
    return request.post(`${RDS_BASE}/topology/trace`, {
        object_id: objectId,
        direction,
        relation_type: relationType
    })
}

// ==================== BIM 联动 ====================

/**
 * 通过 BIM GUID 查找 RDS 对象
 * 
 * @param {number} fileId - 模型文件 ID
 * @param {string} guid - BIM 模型 GUID
 * @returns {Promise<{objectId: string, refCode: string, objectType: string, name: string, aspects: Array}>}
 */
export async function lookupByBimGuid(fileId, guid) {
    return request.get(`${RDS_BASE}/bim/${fileId}/lookup/${encodeURIComponent(guid)}`)
}

/**
 * 获取指定方面编码下的所有 BIM GUID
 * 
 * @param {number} fileId - 模型文件 ID
 * @param {string} code - 方面编码
 * @param {boolean} includeChildren - 是否包含子节点
 * @returns {Promise<{guids: string[], total: number}>}
 */
export async function getBimGuidsByCode(fileId, code, includeChildren = true) {
    const params = new URLSearchParams()
    params.append('code', code)
    params.append('includeChildren', includeChildren)

    return request.get(`${RDS_BASE}/bim/${fileId}/guids?${params.toString()}`)
}

// ==================== 健康检查 ====================

/**
 * 检查 RDS 服务状态
 * 
 * @returns {Promise<{nodeServer: string, logicEngine: object}>}
 */
export async function checkHealth() {
    return request.get(`${RDS_BASE}/health`)
}

// ==================== 数据导入 ====================

/**
 * 上传 Excel 文件并解析
 * 
 * @param {File} file - Excel 文件
 * @returns {Promise<{totalRows: number, parsedObjects: Array, errors: string[]}>}
 */
export async function importExcel(file) {
    const formData = new FormData()
    formData.append('file', file)

    return request.post(`${RDS_BASE}/parse/excel`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
}


/**
 * 上传 Excel 文件并导入到数据库
 * 
 * @param {number} fileId - 模型文件 ID
 * @param {File} file - Excel 文件
 * @param {boolean} clearExisting - 是否清除旧数据 (默认 true)
 * @returns {Promise<{success: boolean, objects_created: number, aspects_created: number}>}
 */
export async function importExcelToDb(fileId, file, clearExisting = true) {
    const formData = new FormData()
    formData.append('file', file)

    // 前端直接 POST /api/rds/import/:fileId
    // 后端会转发给 Logic Engine
    const url = `${RDS_BASE}/import/${fileId}?clearExisting=${clearExisting}`

    return request.post(url, formData)
}

// ==================== 电源网络图 ====================

/**
 * 获取电源网络图数据 (G6 格式)
 * 
 * @param {number} fileId - 模型文件 ID
 * @param {object} options - 查询选项
 * @param {string} options.nodeType - 节点类型过滤 (source/bus/feeder/device)
 * @param {number} options.maxLevel - 最大层级深度
 * @returns {Promise<{success: boolean, nodes: Array, edges: Array, stats: object}>}
 */
export async function getPowerGraph(fileId, options = {}) {
    const params = new URLSearchParams()
    if (options.nodeType) params.append('nodeType', options.nodeType)
    if (options.maxLevel) params.append('maxLevel', options.maxLevel)

    const queryString = params.toString()
    const url = `${RDS_BASE}/power-graph/${fileId}${queryString ? '?' + queryString : ''}`

    return request.get(url)
}

/**
 * 追溯电源路径
 * 
 * @param {number} fileId - 模型文件 ID
 * @param {string} nodeCode - 节点编码 (full_code)
 * @param {object} options - 追溯选项
 * @param {string} options.direction - 'upstream' 或 'downstream'
 * @param {number} options.maxDepth - 最大追溯深度
 * @returns {Promise<{success: boolean, path: Array, nodes: Array, edges: Array}>}
 */
export async function tracePowerPath(fileId, nodeCode, options = {}) {
    const params = new URLSearchParams()
    if (options.direction) params.append('direction', options.direction)
    if (options.maxDepth) params.append('maxDepth', options.maxDepth)

    const queryString = params.toString()
    const encodedCode = encodeURIComponent(nodeCode)
    const url = `${RDS_BASE}/power-trace/${fileId}/${encodedCode}${queryString ? '?' + queryString : ''}`

    return request.get(url)
}


export default {
    AspectType,
    AspectTypeLabels,
    AspectTypePrefixes,
    TraceDirection,
    RelationType,
    getAspectTree,
    getAspectHierarchy,
    parseCode,
    parseHierarchy,
    traceTopology,
    lookupByBimGuid,
    getBimGuidsByCode,
    checkHealth,
    importExcel,
    importExcelToDb,
    // 新增电源图 API
    getPowerGraph,
    tracePowerPath
}


