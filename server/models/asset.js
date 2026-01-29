/**
 * 资产数据访问对象
 */
import { query, getClient } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 插入或更新资产
 * @param {Object} asset - 资产对象
 */
export async function upsertAsset(asset) {
    const sql = `
    INSERT INTO assets (asset_code, spec_code, name, floor, room, db_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
    const result = await query(sql, [
        asset.assetCode,
        asset.specCode,
        asset.name,
        asset.floor,
        asset.room,
        asset.dbId
    ]);
    return result.rows[0];
}

/**
 * 批量插入资产
 * @param {Array} assets - 资产数组
 */
export async function batchUpsertAssets(assets) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        for (const asset of assets) {
            if (asset.assetCode) {
                await client.query(`
          INSERT INTO assets (asset_code, spec_code, name, floor, room, db_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
                    asset.assetCode,
                    asset.specCode,
                    asset.name,
                    asset.floor,
                    asset.room,
                    asset.dbId
                ]);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ 成功插入/更新 ${assets.length} 条资产`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 获取所有资产
 */
export async function getAllAssets() {
    const sql = `
    SELECT a.*, s.spec_name, s.classification_code, s.classification_desc, s.category, s.family, s.type, s.manufacturer, s.address, s.phone
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    ORDER BY a.asset_code
  `;
    const result = await query(sql);
    return result.rows;
}

/**
 * 根据资产编码获取资产
 */
export async function getAssetByCode(code) {
    const sql = `
    SELECT a.*, s.spec_name, s.classification_code, s.classification_desc, s.category, s.family, s.type, s.manufacturer, s.address, s.phone
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    WHERE a.asset_code = $1
  `;
    const result = await query(sql, [code]);
    return result.rows[0];
}

/**
 * 根据规格编码获取资产列表
 */
export async function getAssetsBySpecCode(specCode) {
    const sql = `
    SELECT a.*, s.spec_name, s.classification_code, s.classification_desc, s.category, s.family, s.type, s.manufacturer, s.address, s.phone
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    WHERE a.spec_code = $1
    ORDER BY a.asset_code
  `;
    const result = await query(sql, [specCode]);
    return result.rows;
}

/**
 * 根据楼层获取资产列表
 */
export async function getAssetsByFloor(floor) {
    const sql = `
    SELECT a.*, s.spec_name, s.classification_code, s.classification_desc, s.category, s.family, s.type, s.manufacturer, s.address, s.phone
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    WHERE a.floor = $1
    ORDER BY a.asset_code
  `;
    const result = await query(sql, [floor]);
    return result.rows;
}

/**
 * 根据房间获取资产列表
 */
export async function getAssetsByRoom(room) {
    const sql = `
    SELECT a.*, s.spec_name, s.classification_code, s.classification_desc, s.category, s.family, s.type, s.manufacturer, s.address, s.phone
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code
    WHERE a.room = $1
    ORDER BY a.asset_code
  `;
    const result = await query(sql, [room]);
    return result.rows;
}

/**
 * 删除所有资产
 */
export async function deleteAllAssets() {
    const sql = 'DELETE FROM assets';
    const result = await query(sql);
    return result.rowCount;
}

/**
 * 根据文件 ID 获取资产列表
 */
export async function getAssetsByFileId(fileId) {
    const sql = `
    SELECT a.*, s.spec_name, s.classification_code, s.classification_desc, s.category, s.family, s.type, s.manufacturer, s.address, s.phone
    FROM assets a
    LEFT JOIN asset_specs s ON a.spec_code = s.spec_code AND a.file_id = s.file_id
    WHERE a.file_id = $1
    ORDER BY a.asset_code
  `;
    const result = await query(sql, [fileId]);
    return result.rows;
}

/**
 * 批量插入资产（带文件关联）
 */
export async function batchUpsertAssetsWithFile(assets, fileId) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        for (const asset of assets) {
            if (asset.assetCode) {
                // 为新记录生成 UUID
                const uuid = uuidv4();
                await client.query(`
          INSERT INTO assets (file_id, asset_code, spec_code, name, floor, room, db_id, uuid)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (file_id, asset_code)
          DO UPDATE SET
            spec_code = EXCLUDED.spec_code,
            name = EXCLUDED.name,
            floor = EXCLUDED.floor,
            room = EXCLUDED.room,
            db_id = EXCLUDED.db_id,
            updated_at = CURRENT_TIMESTAMP
        `, [
                    fileId,
                    asset.assetCode,
                    asset.specCode,
                    asset.name,
                    asset.floor,
                    asset.room,
                    asset.dbId,
                    uuid
                ]);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ 成功插入/更新 ${assets.length} 条资产 (文件ID: ${fileId})`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 更新资产属性
 * @param {String} assetCode - 资产编码
 * @param {Object} updates - 要更新的字段
 */
export async function updateAsset(assetCode, updates) {
    const allowedFields = ['spec_code', 'name', 'floor', 'room'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    // 构建 SET 子句
    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }
    }

    if (setClause.length === 0) {
        throw new Error('没有有效的更新字段');
    }

    // 添加 asset_code 到参数列表
    values.push(assetCode);

    const sql = `
    UPDATE assets
    SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE asset_code = $${paramIndex}
    RETURNING *
  `;

    const result = await query(sql, values);
    return result.rows[0];
}

/**
 * 删除单个资产
 */
export async function deleteAsset(assetCode) {
    const sql = 'DELETE FROM assets WHERE asset_code = $1';
    const result = await query(sql, [assetCode]);
    return result.rowCount > 0;
}

/**
 * 批量删除资产（根据 DB ID）
 */
export async function deleteAssetsByDbIds(dbIds) {
    if (!dbIds || dbIds.length === 0) return 0;
    const sql = 'DELETE FROM assets WHERE db_id = ANY($1)';
    const result = await query(sql, [dbIds]);
    return result.rowCount;
}

export default {
    upsertAsset,
    batchUpsertAssets,
    batchUpsertAssetsWithFile,
    getAllAssets,
    getAssetByCode,
    getAssetsBySpecCode,
    getAssetsByFloor,
    getAssetsByRoom,
    getAssetsByFileId,
    deleteAllAssets,
    deleteAsset,
    deleteAssetsByDbIds,
    updateAsset
};
