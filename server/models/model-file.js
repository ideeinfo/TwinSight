/**
 * 模型文件数据访问对象
 */
import { query, getClient } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 生成唯一文件编码
 */
export function generateFileCode() {
    const timestamp = Date.now().toString(36);
    const random = uuidv4().split('-')[0];
    return `MF${timestamp}${random}`.toUpperCase();
}

/**
 * 创建模型文件记录
 */
export async function createModelFile(data) {
    const fileCode = data.fileCode || generateFileCode();
    const sql = `
    INSERT INTO model_files (file_code, title, original_name, file_path, file_size, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
    const result = await query(sql, [
        fileCode,
        data.title,
        data.originalName,
        data.filePath,
        data.fileSize,
        data.status || 'uploaded'
    ]);
    return result.rows[0];
}

/**
 * 获取所有模型文件
 */
export async function getAllModelFiles() {
    const sql = `
    SELECT * FROM model_files
    ORDER BY created_at DESC
  `;
    const result = await query(sql);
    return result.rows;
}

/**
 * 根据 ID 获取模型文件
 */
export async function getModelFileById(id) {
    const sql = 'SELECT * FROM model_files WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0];
}

/**
 * 根据编码获取模型文件
 */
export async function getModelFileByCode(fileCode) {
    const sql = 'SELECT * FROM model_files WHERE file_code = $1';
    const result = await query(sql, [fileCode]);
    return result.rows[0];
}

/**
 * 获取当前激活的模型文件
 */
export async function getActiveModelFile() {
    const sql = 'SELECT * FROM model_files WHERE is_active = true LIMIT 1';
    const result = await query(sql);
    return result.rows[0];
}

/**
 * 更新模型文件状态
 */
export async function updateModelFileStatus(id, status, extractedPath = null) {
    let sql, params;
    if (extractedPath) {
        sql = `
      UPDATE model_files 
      SET status = $2, extracted_path = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
        params = [id, status, extractedPath];
    } else {
        sql = `
      UPDATE model_files 
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
        params = [id, status];
    }
    const result = await query(sql, params);
    return result.rows[0];
}

/**
 * 激活模型文件（同时取消其他文件的激活状态）
 */
export async function activateModelFile(id) {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // 取消所有文件的激活状态
        await client.query('UPDATE model_files SET is_active = false');

        // 激活指定文件
        const result = await client.query(
            'UPDATE model_files SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 删除模型文件记录
 */
export async function deleteModelFile(id) {
    const sql = 'DELETE FROM model_files WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
}

/**
 * 更新文件路径
 */
export async function updateModelFilePath(id, filePath) {
    const sql = `
    UPDATE model_files 
    SET file_path = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
    const result = await query(sql, [id, filePath]);
    return result.rows[0];
}

/**
 * 更新文件标题
 */
export async function updateModelFileTitle(id, title) {
    const sql = `
    UPDATE model_files 
    SET title = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
    const result = await query(sql, [id, title]);
    return result.rows[0];
}

export default {
    generateFileCode,
    createModelFile,
    getAllModelFiles,
    getModelFileById,
    getModelFileByCode,
    getActiveModelFile,
    updateModelFileStatus,
    activateModelFile,
    deleteModelFile,
    updateModelFilePath,
    updateModelFileTitle
};
