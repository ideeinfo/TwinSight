/**
 * 资产规格数据访问对象
 */
import { query, getClient } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 插入或更新资产规格
 * @param {Object} spec - 资产规格对象
 */
export async function upsertAssetSpec(spec) {
    const sql = `
    INSERT INTO asset_specs (
      spec_code, spec_name, classification_code, classification_desc,
      category, family, type, manufacturer, address, phone
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;
    const result = await query(sql, [
        spec.specCode,
        spec.specName,
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
            spec_code, spec_name, classification_code, classification_desc,
            category, family, type, manufacturer, address, phone
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
                    spec.specCode,
                    spec.specName,
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

/**
 * 批量插入或更新资产规格（关联文件）
 * 注意：规格是全局共享的，不按文件区分，所以只使用 spec_code 作为唯一键
 */
export async function batchUpsertAssetSpecsWithFile(specs, fileId) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        for (const spec of specs) {
            if (spec.specCode) {
                // 为新记录生成 UUID
                const uuid = uuidv4();
                await client.query(`
                  INSERT INTO asset_specs (
                    file_id, spec_code, spec_name, classification_code, classification_desc, 
                    category, family, type, manufacturer, address, phone, uuid
                  )
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                  ON CONFLICT (file_id, spec_code)
                  DO UPDATE SET
                    spec_name = EXCLUDED.spec_name,
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
                    fileId,
                    spec.specCode,
                    spec.specName || '',
                    spec.classificationCode || null,
                    spec.classificationDesc || '',
                    spec.category || '',
                    spec.family || '',
                    spec.type || '',
                    spec.manufacturer || '',
                    spec.address || '',
                    spec.phone || '',
                    uuid
                ]);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ 成功插入/更新 ${specs.length} 条资产规格 (文件ID: ${fileId})`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 更新资产规格属性
 * @param {String} specCode - 规格编码
 * @param {Object} updates - 要更新的字段
 */
export async function updateAssetSpec(specCode, updates) {
    const allowedFields = [
        'spec_name', 'classification_code', 'classification_desc',
        'category', 'family', 'type', 'manufacturer', 'address', 'phone'
    ];
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

    // 添加 spec_code 到参数列表
    values.push(specCode);

    const sql = `
    UPDATE asset_specs
    SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE spec_code = $${paramIndex}
    RETURNING *
  `;

    const result = await query(sql, values);
    return result.rows[0];
}

/**
 * 根据文件ID和规格编码更新资产规格
 * @param {Number} fileId - 文件ID
 * @param {String} specCode - 规格编码
 * @param {Object} updates - 要更新的字段
 */
export async function updateAssetSpecByFileId(fileId, specCode, updates) {
    const allowedFields = [
        'spec_name', 'classification_code', 'classification_desc',
        'category', 'family', 'type', 'manufacturer', 'address', 'phone'
    ];
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

    // 添加 file_id 和 spec_code 到参数列表
    values.push(fileId);
    values.push(specCode);

    const sql = `
    UPDATE asset_specs
    SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE file_id = $${paramIndex} AND spec_code = $${paramIndex + 1}
    RETURNING *
  `;

    const result = await query(sql, values);
    return result.rows[0];
}

export default {
    upsertAssetSpec,
    batchUpsertAssetSpecs,
    batchUpsertAssetSpecsWithFile,
    getAllAssetSpecs,
    getAssetSpecByCode,
    getAssetSpecsByClassification,
    updateAssetSpec,
    updateAssetSpecByFileId
};
