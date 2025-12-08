/**
 * 空间数据访问对象
 */
import { query, getClient } from '../db/index.js';

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
    ON CONFLICT (space_code)
    DO UPDATE SET
      name = EXCLUDED.name,
      classification_code = EXCLUDED.classification_code,
      classification_desc = EXCLUDED.classification_desc,
      floor = EXCLUDED.floor,
      area = EXCLUDED.area,
      perimeter = EXCLUDED.perimeter,
      db_id = EXCLUDED.db_id,
      updated_at = CURRENT_TIMESTAMP
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
          ON CONFLICT (space_code)
          DO UPDATE SET
            name = EXCLUDED.name,
            classification_code = EXCLUDED.classification_code,
            classification_desc = EXCLUDED.classification_desc,
            floor = EXCLUDED.floor,
            area = EXCLUDED.area,
            perimeter = EXCLUDED.perimeter,
            db_id = EXCLUDED.db_id,
            updated_at = CURRENT_TIMESTAMP
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

        for (const space of spaces) {
            if (space.spaceCode) {
                await client.query(`
          INSERT INTO spaces (
            space_code, name, classification_code, classification_desc,
            floor, area, perimeter, db_id, file_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (space_code, file_id)
          DO UPDATE SET
            name = EXCLUDED.name,
            classification_code = EXCLUDED.classification_code,
            classification_desc = EXCLUDED.classification_desc,
            floor = EXCLUDED.floor,
            area = EXCLUDED.area,
            perimeter = EXCLUDED.perimeter,
            db_id = EXCLUDED.db_id,
            updated_at = CURRENT_TIMESTAMP
        `, [
                    space.spaceCode,
                    space.name,
                    space.classificationCode,
                    space.classificationDesc,
                    space.floor,
                    space.area,
                    space.perimeter,
                    space.dbId,
                    fileId
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

export default {
    upsertSpace,
    batchUpsertSpaces,
    batchUpsertSpacesWithFile,
    getAllSpaces,
    getSpaceByCode,
    getSpacesByFloor,
    getSpacesByClassification,
    getSpacesByFileId,
    deleteAllSpaces
};
