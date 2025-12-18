/**
 * InfluxDB 配置数据访问对象
 */
import { query, getClient } from '../db/index.js';

/**
 * 获取模型的 InfluxDB 配置
 */
export async function getInfluxConfig(fileId) {
    const result = await query(
        'SELECT * FROM influx_configs WHERE file_id = $1',
        [fileId]
    );
    return result.rows[0] || null;
}

/**
 * 保存或更新模型的 InfluxDB 配置
 */
export async function saveInfluxConfig(fileId, config) {
    const {
        influxUrl,
        influxPort = 8086,
        influxOrg,
        influxBucket,
        influxToken,
        influxUser,
        influxPassword,
        useBasicAuth = false,
        isEnabled = true
    } = config;

    // 检查是否已存在配置
    const existing = await getInfluxConfig(fileId);

    if (existing) {
        // 更新
        const result = await query(`
            UPDATE influx_configs SET
                influx_url = $1,
                influx_port = $2,
                influx_org = $3,
                influx_bucket = $4,
                influx_token = $5,
                influx_user = $6,
                influx_password = $7,
                use_basic_auth = $8,
                is_enabled = $9
            WHERE file_id = $10
            RETURNING *
        `, [
            influxUrl,
            influxPort,
            influxOrg,
            influxBucket,
            influxToken || null,
            influxUser || null,
            influxPassword || null,
            useBasicAuth,
            isEnabled,
            fileId
        ]);
        return result.rows[0];
    } else {
        // 插入
        const result = await query(`
            INSERT INTO influx_configs (
                file_id, influx_url, influx_port, influx_org, influx_bucket,
                influx_token, influx_user, influx_password, use_basic_auth, is_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            fileId,
            influxUrl,
            influxPort,
            influxOrg,
            influxBucket,
            influxToken || null,
            influxUser || null,
            influxPassword || null,
            useBasicAuth,
            isEnabled
        ]);
        return result.rows[0];
    }
}

/**
 * 删除模型的 InfluxDB 配置
 */
export async function deleteInfluxConfig(fileId) {
    const result = await query(
        'DELETE FROM influx_configs WHERE file_id = $1 RETURNING *',
        [fileId]
    );
    return result.rows[0] || null;
}

/**
 * 测试 InfluxDB 连接
 */
export async function testInfluxConnection(config) {
    const {
        influxUrl,
        influxPort = 8086,
        influxOrg,
        influxToken,
        influxUser,
        influxPassword,
        useBasicAuth = false
    } = config;

    const baseUrl = influxUrl.includes('://') ? influxUrl : `http://${influxUrl}`;
    const fullUrl = `${baseUrl}:${influxPort}`;

    try {
        const headers = {};
        if (useBasicAuth && influxUser && influxPassword) {
            headers['Authorization'] = `Basic ${Buffer.from(`${influxUser}:${influxPassword}`).toString('base64')}`;
        } else if (influxToken) {
            headers['Authorization'] = `Token ${influxToken}`;
        }

        // 测试健康检查端点
        const response = await fetch(`${fullUrl}/health`, {
            method: 'GET',
            headers
        });

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                status: data.status || 'pass',
                message: '连接成功'
            };
        } else {
            return {
                success: false,
                status: 'fail',
                message: `连接失败: HTTP ${response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            status: 'error',
            message: `连接错误: ${error.message}`
        };
    }
}

export default {
    getInfluxConfig,
    saveInfluxConfig,
    deleteInfluxConfig,
    testInfluxConnection
};
