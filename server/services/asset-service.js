/**
 * 资产服务层
 * 封装资产相关的业务逻辑
 */
import { query, transaction } from '../config/database.js';

/**
 * 获取所有资产
 */
export async function getAllAssets() {
    const result = await query(`
    SELECT a.*, 
           s.spec_name, s.manufacturer, s.address, s.phone,
           s.classification_code as spec_classification_code,
           s.classification_desc as spec_classification_desc
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    ORDER BY a.asset_code
  `);
    return result.rows;
}

/**
 * 根据编码获取资产
 */
export async function getAssetByCode(code) {
    const result = await query(`
    SELECT a.*, 
           s.spec_name, s.manufacturer, s.address, s.phone,
           s.classification_code as spec_classification_code,
           s.classification_desc as spec_classification_desc
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    WHERE a.asset_code = $1
  `, [code]);
    return result.rows[0] || null;
}

/**
 * 根据文件 ID 获取资产
 */
export async function getAssetsByFileId(fileId) {
    const result = await query(`
    SELECT a.*, 
           s.spec_name, s.manufacturer, s.address, s.phone,
           s.classification_code as spec_classification_code,
           s.classification_desc as spec_classification_desc
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    WHERE a.file_id = $1
    ORDER BY a.asset_code
  `, [fileId]);
    return result.rows;
}

/**
 * 根据规格编码获取资产
 */
export async function getAssetsBySpecCode(specCode) {
    const result = await query(`
    SELECT a.*, 
           s.spec_name, s.manufacturer, s.address, s.phone
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    WHERE a.spec_code = $1
    ORDER BY a.asset_code
  `, [specCode]);
    return result.rows;
}

/**
 * 创建资产
 */
export async function createAsset(data) {
    const {
        assetCode, name, specCode, floor, room,
        dbId, fileId, classificationCode, classificationDesc,
        category, family, type
    } = data;

    const result = await query(`
    INSERT INTO assets (
      asset_code, name, spec_code, floor, room, 
      db_id, file_id, classification_code, classification_desc,
      category, family, type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
        assetCode, name, specCode, floor, room,
        dbId, fileId, classificationCode, classificationDesc,
        category, family, type
    ]);

    return result.rows[0];
}

/**
 * 更新资产
 */
export async function updateAsset(code, data) {
    const { name, specCode, floor, room, classificationCode, classificationDesc } = data;

    const result = await query(`
    UPDATE assets
    SET name = COALESCE($1, name),
        spec_code = COALESCE($2, spec_code),
        floor = COALESCE($3, floor),
        room = COALESCE($4, room),
        classification_code = COALESCE($5, classification_code),
        classification_desc = COALESCE($6, classification_desc),
        updated_at = NOW()
    WHERE asset_code = $7
    RETURNING *
  `, [name, specCode, floor, room, classificationCode, classificationDesc, code]);

    return result.rows[0] || null;
}

/**
 * 删除资产
 */
export async function deleteAsset(code) {
    const result = await query('DELETE FROM assets WHERE asset_code = $1 RETURNING *', [code]);
    return result.rows.length > 0;
}

/**
 * 批量插入/更新资产
 */
export async function batchUpsertAssets(assets, fileId = null) {
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        try {
            const existing = await getAssetByCode(asset.assetCode);

            if (existing) {
                await updateAsset(asset.assetCode, asset);
                updated++;
            } else {
                await createAsset({ ...asset, fileId });
                inserted++;
            }
        } catch (error) {
            failed++;
            errors.push({ index: i, error: error.message });
        }
    }

    return { inserted, updated, failed, errors };
}

/**
 * 获取资产统计信息
 */
export async function getAssetStats(fileId = null) {
    let sql = `
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT spec_code) as spec_count,
      COUNT(DISTINCT floor) as floor_count,
      COUNT(DISTINCT classification_code) as classification_count
    FROM assets
  `;
    const params = [];

    if (fileId) {
        sql += ' WHERE file_id = $1';
        params.push(fileId);
    }

    const result = await query(sql, params);
    return result.rows[0];
}

/**
 * 按分类统计资产数量
 */
export async function getAssetCountByClassification(fileId = null) {
    let sql = `
    SELECT 
      COALESCE(classification_code, 'Uncategorized') as classification,
      COUNT(*) as count
    FROM assets
  `;
    const params = [];

    if (fileId) {
        sql += ' WHERE file_id = $1';
        params.push(fileId);
    }

    sql += ' GROUP BY classification_code ORDER BY count DESC';

    const result = await query(sql, params);
    return result.rows;
}

export default {
    getAllAssets,
    getAssetByCode,
    getAssetsByFileId,
    getAssetsBySpecCode,
    createAsset,
    updateAsset,
    deleteAsset,
    batchUpsertAssets,
    getAssetStats,
    getAssetCountByClassification,
};
