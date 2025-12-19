/**
 * 空间服务层
 * 封装空间相关的业务逻辑
 */
import { query, transaction } from '../config/database.js';

/**
 * 获取所有空间
 */
export async function getAllSpaces() {
    const result = await query(`
    SELECT * FROM spaces
    ORDER BY space_code
  `);
    return result.rows;
}

/**
 * 根据编码获取空间
 */
export async function getSpaceByCode(code) {
    const result = await query('SELECT * FROM spaces WHERE space_code = $1', [code]);
    return result.rows[0] || null;
}

/**
 * 根据文件 ID 获取空间
 */
export async function getSpacesByFileId(fileId) {
    const result = await query(`
    SELECT * FROM spaces
    WHERE file_id = $1
    ORDER BY space_code
  `, [fileId]);
    return result.rows;
}

/**
 * 根据楼层获取空间
 */
export async function getSpacesByFloor(floor, fileId = null) {
    let sql = 'SELECT * FROM spaces WHERE floor = $1';
    const params = [floor];

    if (fileId) {
        sql += ' AND file_id = $2';
        params.push(fileId);
    }

    sql += ' ORDER BY space_code';

    const result = await query(sql, params);
    return result.rows;
}

/**
 * 创建空间
 */
export async function createSpace(data) {
    const {
        spaceCode, name, floor, area, perimeter,
        dbId, fileId, classificationCode, classificationDesc, category
    } = data;

    const result = await query(`
    INSERT INTO spaces (
      space_code, name, floor, area, perimeter,
      db_id, file_id, classification_code, classification_desc, category
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
        spaceCode, name, floor, area, perimeter,
        dbId, fileId, classificationCode, classificationDesc, category
    ]);

    return result.rows[0];
}

/**
 * 更新空间
 */
export async function updateSpace(code, data) {
    const { name, floor, area, perimeter, classificationCode, classificationDesc, category } = data;

    const result = await query(`
    UPDATE spaces
    SET name = COALESCE($1, name),
        floor = COALESCE($2, floor),
        area = COALESCE($3, area),
        perimeter = COALESCE($4, perimeter),
        classification_code = COALESCE($5, classification_code),
        classification_desc = COALESCE($6, classification_desc),
        category = COALESCE($7, category),
        updated_at = NOW()
    WHERE space_code = $8
    RETURNING *
  `, [name, floor, area, perimeter, classificationCode, classificationDesc, category, code]);

    return result.rows[0] || null;
}

/**
 * 删除空间
 */
export async function deleteSpace(code) {
    const result = await query('DELETE FROM spaces WHERE space_code = $1 RETURNING *', [code]);
    return result.rows.length > 0;
}

/**
 * 批量插入/更新空间
 */
export async function batchUpsertSpaces(spaces, fileId = null) {
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < spaces.length; i++) {
        const space = spaces[i];
        try {
            const existing = await getSpaceByCode(space.spaceCode);

            if (existing) {
                await updateSpace(space.spaceCode, space);
                updated++;
            } else {
                await createSpace({ ...space, fileId });
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
 * 获取所有楼层列表
 */
export async function getFloors(fileId = null) {
    let sql = 'SELECT DISTINCT floor FROM spaces WHERE floor IS NOT NULL';
    const params = [];

    if (fileId) {
        sql += ' AND file_id = $1';
        params.push(fileId);
    }

    sql += ' ORDER BY floor';

    const result = await query(sql, params);
    return result.rows.map(r => r.floor);
}

/**
 * 获取空间统计信息
 */
export async function getSpaceStats(fileId = null) {
    let sql = `
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT floor) as floor_count,
      COUNT(DISTINCT classification_code) as classification_count,
      SUM(area) as total_area
    FROM spaces
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
 * 按楼层统计空间数量和面积
 */
export async function getSpaceStatsByFloor(fileId = null) {
    let sql = `
    SELECT 
      floor,
      COUNT(*) as count,
      SUM(area) as total_area
    FROM spaces
    WHERE floor IS NOT NULL
  `;
    const params = [];

    if (fileId) {
        sql += ' AND file_id = $1';
        params.push(fileId);
    }

    sql += ' GROUP BY floor ORDER BY floor';

    const result = await query(sql, params);
    return result.rows;
}

/**
 * 按分类统计空间数量
 */
export async function getSpaceCountByClassification(fileId = null) {
    let sql = `
    SELECT 
      COALESCE(classification_code, 'Uncategorized') as classification,
      COUNT(*) as count
    FROM spaces
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
    getAllSpaces,
    getSpaceByCode,
    getSpacesByFileId,
    getSpacesByFloor,
    createSpace,
    updateSpace,
    deleteSpace,
    batchUpsertSpaces,
    getFloors,
    getSpaceStats,
    getSpaceStatsByFloor,
    getSpaceCountByClassification,
};
