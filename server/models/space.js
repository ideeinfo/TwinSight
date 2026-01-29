/**
 * 空间数据访问对象
 */
import { query, getClient } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 插入或更新空间
 * @param {Object} space - 空间对象
 */
export async function upsertSpace(space) {
    const sql = `
    INSERT INTO spaces (
      space_code, name, classification_code, classification_desc,
      floor, area, perimeter, db_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
    const result = await query(sql, [
        space.spaceCode,
        space.name,
        space.classificationCode,
        space.classificationDesc,
        space.floor,
        space.area,
        space.perimeter,
        space.dbId
    ]);
    return result.rows[0];
}

/**
 * 批量插入空间
 * @param {Array} spaces - 空间数组
 */
export async function batchUpsertSpaces(spaces) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        for (const space of spaces) {
            if (space.spaceCode) {
                await client.query(`
          INSERT INTO spaces (
            space_code, name, classification_code, classification_desc,
            floor, area, perimeter, db_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
                    space.spaceCode,
                    space.name,
                    space.classificationCode,
                    space.classificationDesc,
                    space.floor,
                    space.area,
                    space.perimeter,
                    space.dbId
                ]);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ 成功插入/更新 ${spaces.length} 条空间`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 获取所有空间
 */
export async function getAllSpaces() {
    const sql = 'SELECT * FROM spaces ORDER BY space_code';
    const result = await query(sql);
    return result.rows;
}

/**
 * 根据空间编码获取空间
 */
export async function getSpaceByCode(code) {
    const sql = 'SELECT * FROM spaces WHERE space_code = $1';
    const result = await query(sql, [code]);
    return result.rows[0];
}

/**
 * 根据楼层获取空间列表
 */
export async function getSpacesByFloor(floor) {
    const sql = 'SELECT * FROM spaces WHERE floor = $1 ORDER BY space_code';
    const result = await query(sql, [floor]);
    return result.rows;
}

/**
 * 根据分类编码获取空间列表
 */
export async function getSpacesByClassification(classificationCode) {
    const sql = 'SELECT * FROM spaces WHERE classification_code = $1 ORDER BY space_code';
    const result = await query(sql, [classificationCode]);
    return result.rows;
}

/**
 * 删除所有空间
 */
export async function deleteAllSpaces() {
    const sql = 'DELETE FROM spaces';
    const result = await query(sql);
    return result.rowCount;
}

/**
 * 根据文件 ID 获取空间列表
 */
export async function getSpacesByFileId(fileId) {
    const sql = 'SELECT * FROM spaces WHERE file_id = $1 ORDER BY space_code';
    const result = await query(sql, [fileId]);
    return result.rows;
}

/**
 * 批量插入空间（带文件关联）
 */
export async function batchUpsertSpacesWithFile(spaces, fileId) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // 先删除该文件的所有旧空间
        await client.query('DELETE FROM spaces WHERE file_id = $1', [fileId]);

        // 然后批量插入新空间
        for (const space of spaces) {
            if (space.spaceCode) {
                // 为新记录生成 UUID
                const uuid = uuidv4();
                await client.query(`
          INSERT INTO spaces (
            space_code, name, classification_code, classification_desc,
            floor, area, perimeter, db_id, file_id, uuid
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
                    space.spaceCode,
                    space.name,
                    space.classificationCode,
                    space.classificationDesc,
                    space.floor,
                    space.area,
                    space.perimeter,
                    space.dbId,
                    fileId,
                    uuid
                ]);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ 成功插入/更新 ${spaces.length} 条空间 (文件ID: ${fileId})`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 更新空间属性
 * @param {String} spaceCode - 空间编码
 * @param {Object} updates - 要更新的字段
 */
export async function updateSpace(spaceCode, updates) {
    const allowedFields = ['name', 'classification_code', 'classification_desc', 'floor', 'area', 'perimeter'];
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

    // 添加 space_code 到参数列表
    values.push(spaceCode);

    const sql = `
    UPDATE spaces
    SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE space_code = $${paramIndex}
    RETURNING *
  `;

    const result = await query(sql, values);
    return result.rows[0];
}

/**
 * 删除单个空间
 */
export async function deleteSpace(spaceCode) {
    const sql = 'DELETE FROM spaces WHERE space_code = $1';
    const result = await query(sql, [spaceCode]);
    return result.rowCount > 0;
}

/**
 * 批量删除空间（根据 DB ID）
 */
export async function deleteSpacesByDbIds(dbIds) {
    if (!dbIds || dbIds.length === 0) return 0;
    const sql = 'DELETE FROM spaces WHERE db_id = ANY($1)';
    const result = await query(sql, [dbIds]);
    return result.rowCount;
}

export default {
    upsertSpace,
    batchUpsertSpaces,
    batchUpsertSpacesWithFile,
    getAllSpaces,
    getSpaceByCode,
    getSpacesByFloor,
    getSpacesByClassification,
    getSpacesByFileId,
    deleteAllSpaces,
    deleteSpace,
    deleteSpacesByDbIds,
    updateSpace
};
