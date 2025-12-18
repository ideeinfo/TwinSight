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
 */
export async function getAllConfigs() {
    try {
        const result = await pool.query(
            `SELECT config_key, 
                    CASE WHEN is_encrypted THEN '******' ELSE config_value END as config_value,
                    description, is_encrypted, updated_at
             FROM system_config
             ORDER BY config_key`
        );
        return result.rows;
    } catch (error) {
        console.error('获取所有配置失败:', error.message);
        return [];
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
    clearConfigCache,
};
