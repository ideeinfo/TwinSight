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

    // 处理 URL：如果已包含协议和可能的端口，智能处理
    let fullUrl = influxUrl;

    if (!influxUrl.includes('://')) {
        // 没有协议，添加 http 和端口
        fullUrl = `http://${influxUrl}:${influxPort}`;
    } else if (influxUrl.startsWith('https://') && influxPort === 8086) {
        // HTTPS URL，且端口是默认的 8086，不添加端口（使用 443）
        fullUrl = influxUrl;
    } else if (influxUrl.startsWith('http://') && !influxUrl.match(/:\d+$/)) {
        // HTTP URL 没有端口，添加端口
        fullUrl = `${influxUrl}:${influxPort}`;
    }
    // 其他情况保持原样

    console.log(`🔧 测试 InfluxDB 连接: ${fullUrl}`);

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
            headers,
            // 添加超时
            signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                status: data.status || 'pass',
                message: `连接成功 (${fullUrl})`
            };
        } else {
            const text = await response.text();
            console.error(`❌ InfluxDB 连接失败: HTTP ${response.status}`, text);
            return {
                success: false,
                status: 'fail',
                message: `连接失败: HTTP ${response.status} - ${text.slice(0, 100)}`
            };
        }
    } catch (error) {
        console.error(`❌ InfluxDB 连接错误:`, error);
        return {
            success: false,
            status: 'error',
            message: `连接错误: ${error.message} (URL: ${fullUrl})`
        };
    }
}

export default {
    getInfluxConfig,
    saveInfluxConfig,
    deleteInfluxConfig,
    testInfluxConnection
};
