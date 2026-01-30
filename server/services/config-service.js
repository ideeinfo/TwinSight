/**
 * 系统配置服务
 * 从数据库读取敏感配置信息（如 API Key）
 */

import pool from '../db/index.js';

// 缓存配置值（避免频繁查询数据库）
const configCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取配置值
 * @param {string} key - 配置键
 * @param {string} defaultValue - 默认值
 * @returns {Promise<string>}
 */
export async function getConfig(key, defaultValue = '') {
    // 检查缓存
    const cached = configCache.get(key);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.value;
    }

    try {
        const result = await pool.query(
            'SELECT config_value FROM system_config WHERE config_key = $1',
            [key]
        );

        const value = result.rows.length > 0 ? result.rows[0].config_value : defaultValue;

        // 更新缓存
        configCache.set(key, { value, time: Date.now() });

        return value || defaultValue;
    } catch (error) {
        console.error(`获取配置 ${key} 失败:`, error.message);
        return defaultValue;
    }
}

/**
 * 设置配置值
 * @param {string} key - 配置键
 * @param {string} value - 配置值
 * @param {string} description - 描述
 * @returns {Promise<boolean>}
 */
export async function setConfig(key, value, description = '') {
    try {
        await pool.query(
            `INSERT INTO system_config (config_key, config_value, description, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (config_key) 
             DO UPDATE SET config_value = $2, description = COALESCE(NULLIF($3, ''), system_config.description), updated_at = NOW()`,
            [key, value, description]
        );

        // 清除缓存
        configCache.delete(key);

        console.log(`✅ 配置 ${key} 已更新`);
        return true;
    } catch (error) {
        console.error(`设置配置 ${key} 失败:`, error.message);
        return false;
    }
}

/**
 * 获取 Gemini API Key
 */
export async function getGeminiApiKey() {
    return await getConfig('GEMINI_API_KEY', '');
}

/**
 * 获取所有配置（不包含加密的值）
 * @param {string} category - 可选，按分类筛选
 */
export async function getAllConfigs(category = null) {
    try {
        let sql = `SELECT config_key, 
                    CASE WHEN is_encrypted THEN '******' ELSE config_value END as config_value,
                    CASE WHEN is_encrypted THEN config_value ELSE NULL END as raw_value,
                    description, is_encrypted, config_type, category, label, sort_order, updated_at
             FROM system_config`;
        const params = [];

        if (category) {
            sql += ` WHERE category = $1`;
            params.push(category);
        }

        sql += ` ORDER BY category, sort_order, config_key`;

        const result = await pool.query(sql, params);
        return result.rows;
    } catch (error) {
        console.error('获取所有配置失败:', error.message);
        return [];
    }
}

/**
 * 获取配置（内部使用，返回原始值）
 * @param {string} key - 配置键
 */
export async function getConfigRaw(key) {
    try {
        const result = await pool.query(
            'SELECT config_value FROM system_config WHERE config_key = $1',
            [key]
        );
        return result.rows.length > 0 ? result.rows[0].config_value : null;
    } catch (error) {
        console.error(`获取配置 ${key} 失败:`, error.message);
        return null;
    }
}

/**
 * 批量更新配置
 * @param {Array} configs - [{key, value}] 数组
 */
export async function batchSetConfigs(configs) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const { key, value } of configs) {
            await client.query(
                `UPDATE system_config 
                 SET config_value = $2, updated_at = NOW() 
                 WHERE config_key = $1`,
                [key, value]
            );
            // 清除单个缓存
            configCache.delete(key);
        }

        await client.query('COMMIT');
        console.log(`✅ 批量更新 ${configs.length} 个配置项`);
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('批量更新配置失败:', error.message);
        return false;
    } finally {
        client.release();
    }
}

/**
 * 清除配置缓存
 */
export function clearConfigCache() {
    configCache.clear();
}

export default {
    getConfig,
    setConfig,
    getGeminiApiKey,
    getAllConfigs,
    getConfigRaw,
    batchSetConfigs,
    clearConfigCache,
};
