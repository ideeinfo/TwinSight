import { query } from '../db/index.js';

/**
 * 文档数据访问层
 */

async function resolveDocumentFacilityId(params = {}) {
    const { facilityId, assetCode, spaceCode, specCode, viewId } = params;

    if (facilityId !== undefined && facilityId !== null && facilityId !== '') {
        const parsedId = Number.parseInt(facilityId, 10);
        if (!Number.isInteger(parsedId) || parsedId <= 0) {
            throw new Error('facilityId 必须是正整数');
        }

        const facilityResult = await query(
            'SELECT id FROM facilities WHERE id = $1',
            [parsedId]
        );
        if (facilityResult.rows.length === 0) {
            throw new Error('指定的 facility 不存在');
        }

        return parsedId;
    }

    const lookups = [
        {
            enabled: !!assetCode,
            sql: `
                SELECT mf.facility_id
                FROM assets a
                JOIN model_files mf ON mf.id = a.file_id
                WHERE a.asset_code = $1
                  AND mf.facility_id IS NOT NULL
                ORDER BY mf.is_active DESC, a.updated_at DESC NULLS LAST, a.id DESC
                LIMIT 1
            `,
            value: assetCode,
        },
        {
            enabled: !!spaceCode,
            sql: `
                SELECT mf.facility_id
                FROM spaces s
                JOIN model_files mf ON mf.id = s.file_id
                WHERE s.space_code = $1
                  AND mf.facility_id IS NOT NULL
                ORDER BY mf.is_active DESC, s.updated_at DESC NULLS LAST, s.id DESC
                LIMIT 1
            `,
            value: spaceCode,
        },
        {
            enabled: !!specCode,
            sql: `
                SELECT mf.facility_id
                FROM asset_specs s
                JOIN model_files mf ON mf.id = s.file_id
                WHERE s.spec_code = $1
                  AND mf.facility_id IS NOT NULL
                ORDER BY mf.is_active DESC, s.updated_at DESC NULLS LAST, s.id DESC
                LIMIT 1
            `,
            value: specCode,
        },
        {
            enabled: !!viewId,
            sql: `
                SELECT mf.facility_id
                FROM public.views v
                JOIN model_files mf ON mf.id = v.file_id
                WHERE v.id = $1
                  AND mf.facility_id IS NOT NULL
                LIMIT 1
            `,
            value: Number.parseInt(viewId, 10),
        },
    ];

    for (const lookup of lookups) {
        if (!lookup.enabled) continue;
        const result = await query(lookup.sql, [lookup.value]);
        if (result.rows.length > 0) {
            return result.rows[0].facility_id;
        }
    }

    return null;
}

/**
 * 获取关联对象的文档列表
 * @param {Object} params - 查询参数 { assetCode, spaceCode, specCode, viewId, facilityId }
 * @returns {Promise<Array>}
 */
async function getDocuments(params) {
    const { assetCode, spaceCode, specCode, viewId, facilityId } = params;

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
    } else if (viewId) {
        sql += 'view_id = $1';
        values.push(viewId);
    } else if (facilityId) {
        sql += 'facility_id = $1';
        values.push(facilityId);
    } else {
        throw new Error('必须提供 assetCode, spaceCode, specCode, viewId 或 facilityId 之一');
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
        specCode,
        viewId,
        facilityId
    } = doc;

    const resolvedFacilityId = await resolveDocumentFacilityId({
        facilityId,
        assetCode,
        spaceCode,
        specCode,
        viewId,
    });

    const result = await query(
        `INSERT INTO documents (
            title, file_name, file_path, file_size, file_type, mime_type,
            asset_code, space_code, spec_code, view_id, facility_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [title, fileName, filePath, fileSize, fileType, mimeType, assetCode, spaceCode, specCode, viewId, resolvedFacilityId]
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
 * @param {Object} params - { assetCode, spaceCode, specCode, facilityId }
 * @returns {Promise<Object>}
 */
async function getDocumentStats(params) {
    const { assetCode, spaceCode, specCode, facilityId } = params;

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
    } else if (facilityId) {
        sql += 'facility_id = $1';
        values.push(facilityId);
    } else {
        throw new Error('必须提供 assetCode, spaceCode, specCode 或 facilityId 之一');
    }

    const result = await query(sql, values);
    return result.rows[0];
}

export {
    resolveDocumentFacilityId,
    getDocuments,
    getDocumentById,
    createDocument,
    updateDocumentTitle,
    deleteDocument,
    getDocumentStats
};

export default {
    resolveDocumentFacilityId,
    getDocuments,
    getDocumentById,
    createDocument,
    updateDocumentTitle,
    deleteDocument,
    getDocumentStats
};
