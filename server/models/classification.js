/**
 * 分类编码数据访问对象
 */
import { query, getClient } from '../db/index.js';

/**
 * 插入或更新分类编码
 * @param {Object} classification - 分类编码对象
 * @param {string} classification.classificationCode - 分类编码
 * @param {string} classification.classificationDesc - 分类描述
 * @param {string} classification.classificationType - 分类类型 ('asset' 或 'space')
 */
export async function upsertClassification(classification) {
    const sql = `
    INSERT INTO classifications (classification_code, classification_desc, classification_type)
    VALUES ($1, $2, $3)
    ON CONFLICT (classification_code, classification_type)
    DO UPDATE SET
      classification_desc = EXCLUDED.classification_desc,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
    const result = await query(sql, [
        classification.classificationCode,
        classification.classificationDesc,
        classification.classificationType
    ]);
    return result.rows[0];
}

/**
 * 批量插入分类编码
 * @param {Array} classifications - 分类编码数组
 */
export async function batchUpsertClassifications(classifications) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        for (const c of classifications) {
            if (c.classificationCode) {
                await client.query(`
          INSERT INTO classifications (classification_code, classification_desc, classification_type)
          VALUES ($1, $2, $3)
          ON CONFLICT (classification_code, classification_type)
          DO UPDATE SET
            classification_desc = EXCLUDED.classification_desc,
            updated_at = CURRENT_TIMESTAMP
        `, [c.classificationCode, c.classificationDesc, c.classificationType]);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ 成功插入/更新 ${classifications.length} 条分类编码`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 获取所有分类编码
 * @param {string} type - 可选，过滤类型 ('asset' 或 'space')
 */
export async function getAllClassifications(type = null) {
    let sql = 'SELECT * FROM classifications';
    const params = [];

    if (type) {
        sql += ' WHERE classification_type = $1';
        params.push(type);
    }

    sql += ' ORDER BY classification_code';
    const result = await query(sql, params);
    return result.rows;
}

/**
 * 根据编码获取分类
 */
export async function getClassificationByCode(code, type) {
    const sql = `
    SELECT * FROM classifications 
    WHERE classification_code = $1 AND classification_type = $2
  `;
    const result = await query(sql, [code, type]);
    return result.rows[0];
}

export default {
    upsertClassification,
    batchUpsertClassifications,
    getAllClassifications,
    getClassificationByCode
};
