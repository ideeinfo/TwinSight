/**
 * 视图数据模型
 * 管理模型视图状态的CRUD操作
 */
import { query } from '../db/index.js';

/**
 * 获取文件的所有视图
 * @param {number} fileId - 文件ID
 * @param {string} sortBy - 排序字段 (name, created_at)
 * @param {string} sortOrder - 排序方向 (asc, desc)
 * @returns {Promise<Array>}
 */
async function getViewsByFileId(fileId, sortBy = 'name', sortOrder = 'asc') {
    const validSortFields = ['name', 'created_at', 'updated_at'];
    const validOrders = ['asc', 'desc'];

    const field = validSortFields.includes(sortBy) ? sortBy : 'name';
    const order = validOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'ASC';

    const sql = `
        SELECT id, file_id, name, thumbnail, is_default, created_at, updated_at
        FROM views 
        WHERE file_id = $1 
        ORDER BY ${field} ${order}
    `;

    const result = await query(sql, [fileId]);
    return result.rows;
}

/**
 * 搜索视图
 * @param {number} fileId - 文件ID
 * @param {string} searchTerm - 搜索关键词
 * @returns {Promise<Array>}
 */
async function searchViews(fileId, searchTerm) {
    const sql = `
        SELECT id, file_id, name, thumbnail, is_default, created_at, updated_at
        FROM views 
        WHERE file_id = $1 AND name ILIKE $2
        ORDER BY name ASC
    `;

    const result = await query(sql, [fileId, `%${searchTerm}%`]);
    return result.rows;
}

/**
 * 根据ID获取视图（包含完整状态数据）
 * @param {number} id - 视图ID
 * @returns {Promise<Object>}
 */
async function getViewById(id) {
    const sql = `SELECT * FROM views WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0];
}

/**
 * 创建新视图
 * @param {Object} view - 视图数据
 * @returns {Promise<Object>}
 */
async function createView(view) {
    const {
        fileId,
        name,
        thumbnail,
        viewer_state,
        viewerState,
        other_settings,
        otherSettings
    } = view;

    const finalViewerState = viewer_state || viewerState;
    const finalOtherSettings = other_settings || otherSettings;

    const sql = `
        INSERT INTO views (
            file_id, name, thumbnail, viewer_state, other_settings
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;

    const result = await query(sql, [
        fileId,
        name,
        thumbnail,
        JSON.stringify(finalViewerState),
        JSON.stringify(finalOtherSettings)
    ]);

    return result.rows[0];
}

/**
 * 更新视图
 * @param {number} id - 视图ID
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<Object>}
 */
async function updateView(id, updates) {
    // 仅允许更新核心字段
    const allowedFields = ['name', 'thumbnail', 'viewer_state', 'other_settings'];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
        // 转换驼峰命名为下划线命名
        let dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();

        // 兼容性处理
        if (dbField === 'viewerstate') dbField = 'viewer_state';
        if (dbField === 'othersettings') dbField = 'other_settings';

        if (allowedFields.includes(dbField)) {
            setClauses.push(`${dbField} = $${paramIndex}`);
            // JSON字段需要序列化
            if (['viewer_state', 'other_settings'].includes(dbField)) {
                values.push(JSON.stringify(value));
            } else {
                values.push(value);
            }
            paramIndex++;
        }
    }

    if (setClauses.length === 0) {
        throw new Error('没有有效的更新字段');
    }

    values.push(id);

    const sql = `
        UPDATE views 
        SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0];
}

/**
 * 删除视图
 * @param {number} id - 视图ID
 * @returns {Promise<Object>}
 */
async function deleteView(id) {
    const sql = `DELETE FROM views WHERE id = $1 RETURNING *`;
    const result = await query(sql, [id]);
    return result.rows[0];
}

/**
 * 检查视图名称是否存在
 * @param {number} fileId - 文件ID
 * @param {string} name - 视图名称
 * @param {number} excludeId - 排除的视图ID（用于更新时检查）
 * @returns {Promise<boolean>}
 */
async function isNameExists(fileId, name, excludeId = null) {
    let sql = `SELECT COUNT(*) as count FROM views WHERE file_id = $1 AND name = $2`;
    const values = [fileId, name];

    if (excludeId) {
        sql += ` AND id != $3`;
        values.push(excludeId);
    }

    const result = await query(sql, values);
    return parseInt(result.rows[0].count) > 0;
}

/**
 * 获取文件的默认视图
 * @param {number} fileId - 文件ID
 * @returns {Promise<Object>}
 */
async function getDefaultView(fileId) {
    const sql = `SELECT * FROM views WHERE file_id = $1 AND is_default = TRUE`;
    const result = await query(sql, [fileId]);
    return result.rows[0];
}

/**
 * 设置视图为默认视图
 * @param {number} id - 视图ID
 * @param {boolean} isDefault - 是否设为默认
 * @returns {Promise<Object>}
 */
async function setDefaultView(id, isDefault = true) {
    // 先获取视图信息
    const view = await getViewById(id);
    if (!view) return null;

    if (isDefault) {
        // 先取消该文件的其他默认视图
        await query(
            `UPDATE views SET is_default = FALSE WHERE file_id = $1 AND is_default = TRUE`,
            [view.file_id]
        );
    }

    // 设置当前视图的默认状态
    const sql = `
        UPDATE views 
        SET is_default = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
    `;
    const result = await query(sql, [isDefault, id]);
    return result.rows[0];
}

export {
    getViewsByFileId,
    searchViews,
    getViewById,
    createView,
    updateView,
    deleteView,
    isNameExists,
    getDefaultView,
    setDefaultView
};

export default {
    getViewsByFileId,
    searchViews,
    getViewById,
    createView,
    updateView,
    deleteView,
    isNameExists,
    getDefaultView,
    setDefaultView
};

