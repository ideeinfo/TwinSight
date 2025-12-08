/**
 * 资产规格数据访问对象
 */
import { query, getClient } from '../db/index.js';

/**
 * 插入或更新资产规格
 * @param {Object} spec - 资产规格对象
 */
export async function upsertAssetSpec(spec) {
    const sql = `
    INSERT INTO asset_specs (
      spec_code, classification_code, classification_desc,
      category, family, type, manufacturer, address, phone
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (spec_code)
    DO UPDATE SET
      classification_code = EXCLUDED.classification_code,
      classification_desc = EXCLUDED.classification_desc,
      category = EXCLUDED.category,
      family = EXCLUDED.family,
      type = EXCLUDED.type,
      manufacturer = EXCLUDED.manufacturer,
      address = EXCLUDED.address,
      phone = EXCLUDED.phone,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
    const result = await query(sql, [
        spec.specCode,
        spec.classificationCode,
        spec.classificationDesc,
        spec.category,
        spec.family,
        spec.type,
        spec.manufacturer,
        spec.address,
        spec.phone
    ]);
    return result.rows[0];
}

/**
 * 批量插入资产规格
 * @param {Array} specs - 资产规格数组
 */
export async function batchUpsertAssetSpecs(specs) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        for (const spec of specs) {
            if (spec.specCode) {
                await client.query(`
          INSERT INTO asset_specs (
            spec_code, classification_code, classification_desc,
            category, family, type, manufacturer, address, phone
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (spec_code)
          DO UPDATE SET
            classification_code = EXCLUDED.classification_code,
            classification_desc = EXCLUDED.classification_desc,
            category = EXCLUDED.category,
            family = EXCLUDED.family,
            type = EXCLUDED.type,
            manufacturer = EXCLUDED.manufacturer,
            address = EXCLUDED.address,
            phone = EXCLUDED.phone,
            updated_at = CURRENT_TIMESTAMP
        `, [
                    spec.specCode,
                    spec.classificationCode,
                    spec.classificationDesc,
                    spec.category,
                    spec.family,
                    spec.type,
                    spec.manufacturer,
                    spec.address,
                    spec.phone
                ]);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ 成功插入/更新 ${specs.length} 条资产规格`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 获取所有资产规格
 */
export async function getAllAssetSpecs() {
    const sql = 'SELECT * FROM asset_specs ORDER BY spec_code';
    const result = await query(sql);
    return result.rows;
}

/**
 * 根据规格编码获取规格
 */
export async function getAssetSpecByCode(code) {
    const sql = 'SELECT * FROM asset_specs WHERE spec_code = $1';
    const result = await query(sql, [code]);
    return result.rows[0];
}

/**
 * 根据分类编码获取规格列表
 */
export async function getAssetSpecsByClassification(classificationCode) {
    const sql = 'SELECT * FROM asset_specs WHERE classification_code = $1 ORDER BY spec_code';
    const result = await query(sql, [classificationCode]);
    return result.rows;
}

export default {
    upsertAssetSpec,
    batchUpsertAssetSpecs,
    getAllAssetSpecs,
    getAssetSpecByCode,
    getAssetSpecsByClassification
};
