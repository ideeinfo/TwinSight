import { query } from '../db/index.js';

/**
 * 文档数据访问层
 */

/**
 * 获取关联对象的文档列表
 * @param {Object} params - 查询参数 { assetCode, spaceCode, specCode }
 * @returns {Promise<Array>}
 */
async function getDocuments(params) {
    const { assetCode, spaceCode, specCode } = params;

    let sql = 'SELECT * FROM documents WHERE ';
    let values = [];

    if (assetCode) {
        sql += 'asset_code = $1';
        values.push(assetCode);
    } else if (spaceCode) {
        sql += 'space_code = $1';
        values.push(spaceCode);
    } else if (specCode) {
        sql += 'spec_code = $1';
        values.push(specCode);
    } else {
        throw new Error('必须提供 assetCode, spaceCode 或 specCode 之一');
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, values);
    return result.rows;
}

/**
 * 根据ID获取文档
 * @param {number} id
 * @returns {Promise<Object>}
 */
async function getDocumentById(id) {
    const result = await query(
        'SELECT * FROM documents WHERE id = $1',
        [id]
    );
    return result.rows[0];
}

/**
 * 创建新文档记录
 * @param {Object} doc - 文档信息
 * @returns {Promise<Object>}
 */
async function createDocument(doc) {
    const {
        title,
        fileName,
        filePath,
        fileSize,
        fileType,
        mimeType,
        assetCode,
        spaceCode,
        specCode
    } = doc;

    const result = await query(
        `INSERT INTO documents (
            title, file_name, file_path, file_size, file_type, mime_type,
            asset_code, space_code, spec_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [title, fileName, filePath, fileSize, fileType, mimeType, assetCode, spaceCode, specCode]
    );

    return result.rows[0];
}

/**
 * 更新文档标题
 * @param {number} id
 * @param {string} title
 * @returns {Promise<Object>}
 */
async function updateDocumentTitle(id, title) {
    const result = await query(
        `UPDATE documents 
         SET title = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [title, id]
    );

    return result.rows[0];
}

/**
 * 删除文档
 * @param {number} id
 * @returns {Promise<Object>}
 */
async function deleteDocument(id) {
    const result = await query(
        'DELETE FROM documents WHERE id = $1 RETURNING *',
        [id]
    );

    return result.rows[0];
}

/**
 * 获取文档统计信息
 * @param {Object} params - { assetCode, spaceCode, specCode }
 * @returns {Promise<Object>}
 */
async function getDocumentStats(params) {
    const { assetCode, spaceCode, specCode } = params;

    let sql = `
        SELECT 
            COUNT(*) as total_count,
            SUM(file_size) as total_size,
            COUNT(DISTINCT file_type) as file_types_count
        FROM documents 
        WHERE `;
    let values = [];

    if (assetCode) {
        sql += 'asset_code = $1';
        values.push(assetCode);
    } else if (spaceCode) {
        sql += 'space_code = $1';
        values.push(spaceCode);
    } else if (specCode) {
        sql += 'spec_code = $1';
        values.push(specCode);
    } else {
        throw new Error('必须提供 assetCode, spaceCode 或 specCode 之一');
    }

    const result = await query(sql, values);
    return result.rows[0];
}

export {
    getDocuments,
    getDocumentById,
    createDocument,
    updateDocumentTitle,
    deleteDocument,
    getDocumentStats
};

export default {
    getDocuments,
    getDocumentById,
    createDocument,
    updateDocumentTitle,
    deleteDocument,
    getDocumentStats
};
