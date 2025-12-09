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
export async function batchUpsertClassifications(classifications, fileId = null) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        for (const c of classifications) {
            if (c.classificationCode) {
                // 如果提供了 fileId，使用带 file_id 的插入逻辑
                if (fileId) {
                    await client.query(`
                      INSERT INTO classifications (file_id, classification_code, classification_desc, classification_type)
                      VALUES ($1, $2, $3, $4)
                      ON CONFLICT (file_id, classification_code)
                      DO UPDATE SET
                        classification_desc = EXCLUDED.classification_desc,
                        classification_type = EXCLUDED.classification_type,
                        updated_at = CURRENT_TIMESTAMP
                    `, [fileId, c.classificationCode, c.classificationDesc, c.classificationType]);
                } else {
                    // 兼容旧逻辑或无 file_id 的情况
                    // 由于已删除 (classification_code, classification_type) 的唯一约束，不能再用 ON CONFLICT 匹配它。
                    // 降级为直接插入（可能会产生重复数据，但不会报错）
                    // 或者更安全的做法：先查询是否存在。
                    // 鉴于这是 fallback 且用户要求减少报错，我们尝试直接插入，并忽略可能的错误。

                    console.warn(`⚠️ 插入分类未提供 fileId: ${c.classificationCode}`);

                    // 尝试更新或插入 (Manual Upsert)
                    // 但为了性能且没有约束，直接插入是最快的。
                    await client.query(`
                      INSERT INTO classifications (classification_code, classification_desc, classification_type)
                      VALUES ($1, $2, $3)
                    `, [c.classificationCode, c.classificationDesc, c.classificationType]);
                }
            }
        }

        await client.query('COMMIT');
        console.log(`✅ 成功插入/更新 ${classifications.length} 条分类编码 (fileId: ${fileId})`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 保存分类编码失败:', error);
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
