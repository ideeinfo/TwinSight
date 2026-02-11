/**
 * 时序数据 API
 * 所有 InfluxDB 操作通过后端代理，使用数据库中的配置
 */
import { Router } from 'express';
import crypto from 'crypto';
import { getInfluxConfig } from '../models/influx-config.js';
import { query } from '../db/index.js';
import { getConfig } from '../services/config-service.js';

import config from '../config/index.js';

const router = Router();
import { authenticate, authorize } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/auth.js';

// 用于生成和验证 API Key 的密钥
const API_KEY_SECRET = process.env.API_KEY_SECRET || 'tandem-timeseries-secret-2024';

/**
 * 生成 Stream 的 API Key（包含 fileId 以支持多模型）
 */
export function generateStreamApiKey(fileId, spaceCode) {
    const hmac = crypto.createHmac('sha256', API_KEY_SECRET);
    hmac.update(`${fileId}:${spaceCode}`);
    return hmac.digest('base64url').substring(0, 22);
}

/**
 * 验证 API Key 是否有效
 */
export function validateStreamApiKey(fileId, spaceCode, providedKey) {
    const expectedKey = generateStreamApiKey(fileId, spaceCode);
    return crypto.timingSafeEqual(
        Buffer.from(expectedKey),
        Buffer.from(providedKey.substring(0, 22))
    );
}

/**
 * 生成完整的 Stream URL（包含 fileId）
 */
export function generateStreamUrl(fileId, spaceCode, baseUrl = '') {
    const apiKey = generateStreamApiKey(fileId, spaceCode);
    const encodedCode = encodeURIComponent(spaceCode);
    return `${baseUrl}/api/v1/timeseries/streams/${fileId}/${encodedCode}?key=${apiKey}`;
}

/**
 * 获取全局 InfluxDB 配置
 */
async function getGlobalInfluxConfig() {
    try {
        // 优先从数据库获取配置
        const dbUrl = await getConfig('INFLUXDB_URL');

        // 如果数据库没有配置，尝试使用环境变量 (config.influx)
        if (!dbUrl) {
            if (config.influx && config.influx.url) {
                console.log('Using InfluxDB config from Environment Variables');
                return {
                    influx_url: config.influx.url,
                    influx_port: 8086, // Usually part of URL in env, but keep default
                    influx_org: config.influx.org,
                    influx_bucket: config.influx.bucket,
                    influx_token: config.influx.token,
                    is_enabled: true,
                    use_basic_auth: false
                };
            }
            return null;
        }

        return {
            influx_url: dbUrl,
            influx_port: parseInt(await getConfig('INFLUXDB_PORT', '8086')),
            influx_org: await getConfig('INFLUXDB_ORG', ''),
            influx_bucket: await getConfig('INFLUXDB_BUCKET', ''),
            influx_token: await getConfig('INFLUXDB_TOKEN', ''),
            is_enabled: (await getConfig('INFLUXDB_ENABLED', 'true')) === 'true',
            use_basic_auth: false // 全局配置默认使用 Token
        };
    } catch (error) {
        console.error('获取全局 InfluxDB 配置失败:', error);
        return null;
    }
}

/**
 * 获取当前激活模型的 InfluxDB 配置
 */
async function getActiveInfluxConfig() {
    try {
        // 查找当前激活的模型
        const result = await query('SELECT id FROM model_files WHERE is_active = true LIMIT 1');
        if (result.rows.length === 0) {
            return await getGlobalInfluxConfig();
        }
        const fileId = result.rows[0].id;
        const config = await getInfluxConfig(fileId);

        if (!config) {
            console.log(`⚠️ 模型 file_id=${fileId} 未配置 InfluxDB，回退到全局配置`);
            return await getGlobalInfluxConfig();
        }

        return config;
    } catch (error) {
        console.error('获取激活模型 InfluxDB 配置失败:', error);
        return await getGlobalInfluxConfig();
    }
}

/**
 * 从指定文件ID获取 InfluxDB 配置
 */
async function getInfluxConfigByFileId(fileId) {
    try {
        const config = await getInfluxConfig(fileId);
        if (!config) {
            console.log(`⚠️ 模型 file_id=${fileId} 未配置 InfluxDB，回退到全局配置`);
            return await getGlobalInfluxConfig();
        }
        return config;
    } catch (error) {
        console.error('获取 InfluxDB 配置失败:', error);
        return await getGlobalInfluxConfig();
    }
}

/**
 * 根据 spaceCode 获取对应模型的 InfluxDB 配置
 * 如果 space 没有关联到模型，则回退到激活模型配置
 */
async function getInfluxConfigBySpaceCode(spaceCode) {
    try {
        // 通过 space_code 查找关联的 file_id
        const result = await query(
            'SELECT file_id FROM spaces WHERE space_code = $1',
            [spaceCode]
        );
        if (result.rows.length === 0) {
            // 无法找到 space，回退到激活模型配置
            console.log(`⚠️ spaceCode "${spaceCode}" 未找到，使用激活模型配置`);
            return await getActiveInfluxConfig();
        }
        const fileId = result.rows[0].file_id;
        if (!fileId) {
            // space 没有关联 file_id，回退到激活模型配置
            console.log(`⚠️ spaceCode "${spaceCode}" 未关联模型，使用激活模型配置`);
            return await getActiveInfluxConfig();
        }
        console.log(`📊 spaceCode "${spaceCode}" 关联到模型 file_id=${fileId}`);
        const config = await getInfluxConfig(fileId);

        if (!config) {
            console.log(`⚠️ 模型 file_id=${fileId} 未配置 InfluxDB，回退到全局配置`);
            return await getGlobalInfluxConfig();
        }

        return config;
    } catch (error) {
        console.error('根据 spaceCode 获取 InfluxDB 配置失败:', error);
        return await getActiveInfluxConfig();
    }
}

/**
 * 构建 InfluxDB 请求头
 */
function buildInfluxHeaders(config) {
    if (config.use_basic_auth && config.influx_user && config.influx_password) {
        return {
            'Authorization': `Basic ${Buffer.from(`${config.influx_user}:${config.influx_password}`).toString('base64')}`,
            'Content-Type': 'text/plain; charset=utf-8'
        };
    } else if (config.influx_token) {
        return {
            'Authorization': `Token ${config.influx_token}`,
            'Content-Type': 'text/plain; charset=utf-8'
        };
    }
    return null;
}

/**
 * 构建 InfluxDB 查询请求头
 */
function buildInfluxQueryHeaders(config) {
    if (config.use_basic_auth && config.influx_user && config.influx_password) {
        return {
            'Authorization': `Basic ${Buffer.from(`${config.influx_user}:${config.influx_password}`).toString('base64')}`,
            'Content-Type': 'application/vnd.flux',
            'Accept': 'application/csv'
        };
    } else if (config.influx_token) {
        return {
            'Authorization': `Token ${config.influx_token}`,
            'Content-Type': 'application/vnd.flux',
            'Accept': 'application/csv'
        };
    }
    return null;
}

/**
 * 构建 InfluxDB 基础 URL
 */
function buildInfluxBaseUrl(config) {
    const url = config.influx_url;
    const port = config.influx_port || 8086;

    // 如果 URL 已经包含端口或以 /influx 结尾（代理路径），直接返回
    if (url.includes(':') && !url.startsWith('http://') && !url.startsWith('https://')) {
        return url;
    }
    if (url.endsWith('/influx') || url.match(/:\d+$/)) {
        return url;
    }

    // 否则添加端口
    const baseUrl = url.replace(/\/$/, '');
    return `${baseUrl}:${port}`;
}

/**
 * 写入数据到 InfluxDB（包含 fileId 用于多模型支持）
 */
async function writeToInflux(config, fileId, spaceCode, data, timestamp = Date.now()) {
    const headers = buildInfluxHeaders(config);
    if (!headers) {
        console.warn('⚠️ InfluxDB 认证未配置');
        return { ok: false, reason: 'not_configured' };
    }

    const baseUrl = buildInfluxBaseUrl(config);
    const lines = [];
    const escapedCode = spaceCode.replace(/[,= ]/g, '_');

    for (const [key, value] of Object.entries(data)) {
        // 尝试将字符串转换为数字（兼容 Node-RED 可能发送字符串类型的数值）
        let numValue = value;
        if (typeof value === 'string') {
            numValue = parseFloat(value);
        }
        if (typeof numValue === 'number' && !isNaN(numValue)) {
            // 添加 file_id 作为 tag，用于精确查询
            lines.push(`${key},room=${escapedCode},code=${escapedCode},file_id=${fileId} value=${numValue} ${timestamp}`);
        }
    }

    if (lines.length === 0) {
        return { ok: false, reason: 'no_valid_data' };
    }

    const body = lines.join('\n');

    try {
        const writeUrl = `${baseUrl}/api/v2/write?org=${encodeURIComponent(config.influx_org)}&bucket=${encodeURIComponent(config.influx_bucket)}&precision=ms`;
        const resp = await fetch(writeUrl, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(10000) // 10秒超时
        });

        if (resp.ok) {
            return { ok: true };
        } else {
            const errorText = await resp.text();
            console.error(`❌ InfluxDB 写入失败: ${resp.status} - ${errorText}`);
            return { ok: false, status: resp.status, error: errorText };
        }
    } catch (error) {
        console.error('❌ InfluxDB 连接错误:', error.message);
        return { ok: false, error: error.message };
    }
}

/**
 * 查询 InfluxDB
 */
async function queryInflux(config, flux) {
    const headers = buildInfluxQueryHeaders(config);
    if (!headers) {
        return { ok: false, reason: 'not_configured', data: [] };
    }

    const baseUrl = buildInfluxBaseUrl(config);

    try {
        const resp = await fetch(
            `${baseUrl}/api/v2/query?org=${encodeURIComponent(config.influx_org)}`,
            {
                method: 'POST',
                headers,
                body: flux,
                signal: AbortSignal.timeout(10000) // 10秒超时
            }
        );

        if (!resp.ok) {
            const errorText = await resp.text();
            console.error(`❌ InfluxDB 查询失败: ${resp.status} - ${errorText}`);
            return { ok: false, status: resp.status, error: errorText, data: [] };
        }

        const csv = await resp.text();
        return { ok: true, csv };
    } catch (error) {
        console.error('❌ InfluxDB 查询错误:', error.message);
        return { ok: false, error: error.message, data: [] };
    }
}

/**
 * 解析 CSV 响应为数据点数组
 */
function parseTimeSeriesCsv(csv) {
    const lines = csv.split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    const header = lines.find(l => l.includes('_time') && l.includes('_value')) || '';
    const cols = header.split(',');
    const idxTime = cols.indexOf('_time');
    const idxValue = cols.indexOf('_value');
    const points = [];

    for (const l of lines) {
        if (l === header) continue;
        const parts = l.split(',');
        if (parts.length <= Math.max(idxTime, idxValue)) continue;
        const t = Date.parse(parts[idxTime]);
        const v = parseFloat(parts[idxValue]);
        if (!Number.isNaN(t) && !Number.isNaN(v)) {
            points.push({ timestamp: t, value: v });
        }
    }
    return points;
}

/**
 * 解析带 code 字段的 CSV 响应
 */
function parseLatestByRoomsCsv(csv) {
    const lines = csv.split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    const header = lines.find(l => l.includes('_value') && l.includes('code')) || '';
    const cols = header.split(',');
    const idxCode = cols.indexOf('code');
    const idxValue = cols.indexOf('_value');
    const result = {};

    for (const l of lines) {
        if (l === header) continue;
        const parts = l.split(',');
        if (parts.length <= Math.max(idxCode, idxValue)) continue;
        const code = parts[idxCode];
        const val = parseFloat(parts[idxValue]);
        if (!Number.isNaN(val) && code) result[code] = val;
    }
    return result;
}

// ========================================
// API 路由
// ========================================

/**
 * 接收时序数据（新版：包含 fileId）
 * POST /api/v1/timeseries/streams/:fileId/:spaceCode
 */
router.post('/streams/:fileId/:spaceCode', async (req, res) => {
    try {
        const { fileId, spaceCode } = req.params;

        // 获取 API Key
        let apiKey = req.query.key;
        if (!apiKey) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                apiKey = authHeader.substring(7);
            }
        }

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API Key is required'
            });
        }

        console.log(`🔑 [API Key 验证] fileId=${fileId}, spaceCode=${spaceCode}, providedKey=${apiKey?.substring(0, 8)}...`);

        try {
            const isValid = validateStreamApiKey(fileId, spaceCode, apiKey);
            console.log(`🔑 [API Key 验证结果] isValid=${isValid}`);
            if (!isValid) {
                // 打印期望的 key 用于调试
                const expectedKey = generateStreamApiKey(fileId, spaceCode);
                console.log(`🔑 [期望 Key] ${expectedKey} vs [提供 Key] ${apiKey?.substring(0, 22)}`);
                return res.status(403).json({ success: false, error: 'Invalid API Key' });
            }
        } catch (e) {
            console.error('🔑 [API Key 验证异常]', e);
            return res.status(403).json({ success: false, error: 'Invalid API Key format' });
        }

        // 直接使用 fileId 获取 InfluxDB 配置
        const config = await getInfluxConfigByFileId(parseInt(fileId));
        if (!config || !config.is_enabled) {
            return res.status(503).json({
                success: false,
                error: `InfluxDB not configured for model ${fileId}`
            });
        }

        const data = req.body;
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body must be a non-empty JSON object'
            });
        }

        const timestamp = data.timestamp ? parseInt(data.timestamp) : Date.now();
        const { timestamp: _, ...dataFields } = data;

        const result = await writeToInflux(config, fileId, spaceCode, dataFields, timestamp);

        if (result.ok) {
            // 异步执行触发器评估，不阻塞响应
            import('../services/iot-trigger-service.js').then(({ evaluateTriggers }) => {
                console.log(`📊 [Timeseries] Calling evaluateTriggers for ${spaceCode}`);
                evaluateTriggers(dataFields, { fileId, spaceCode });
            }).catch(err => console.error('Failed to load trigger service:', err));

            res.json({
                success: true,
                message: 'Data written successfully',
                fileId,
                spaceCode,
                fieldsWritten: Object.keys(dataFields).length
            });
        } else if (result.reason === 'not_configured') {
            res.status(503).json({ success: false, error: 'InfluxDB auth not configured' });
        } else if (result.reason === 'no_valid_data') {
            res.status(400).json({ success: false, error: 'No valid numeric data fields found' });
        } else {
            res.status(500).json({ success: false, error: result.error || 'Failed to write to InfluxDB' });
        }
    } catch (error) {
        console.error('时序数据写入错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 接收时序数据（旧版：仅 spaceCode，向后兼容）
 * POST /api/v1/timeseries/streams/:spaceCode
 * @deprecated 使用新版 /streams/:fileId/:spaceCode
 */
router.post('/streams/:spaceCode', async (req, res) => {
    try {
        const { spaceCode } = req.params;

        // 获取 API Key
        let apiKey = req.query.key;
        if (!apiKey) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                apiKey = authHeader.substring(7);
            }
        }

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API Key is required'
            });
        }

        // 旧版路由：尝试通过 spaceCode 查找 file_id，然后验证 key
        const config = await getInfluxConfigBySpaceCode(spaceCode);
        if (!config || !config.is_enabled) {
            return res.status(503).json({
                success: false,
                error: 'InfluxDB not configured for this space. Please use new URL format with fileId.'
            });
        }

        // 使用找到的 file_id 验证 key（向后兼容：也尝试旧版 key 验证）
        const fileId = config.file_id;
        let keyValid = false;
        try {
            // 优先尝试新格式 key
            keyValid = validateStreamApiKey(fileId, spaceCode, apiKey);
        } catch (e) {
            keyValid = false;
        }

        if (!keyValid) {
            return res.status(403).json({
                success: false,
                error: 'Invalid API Key. Please regenerate URL from the app.'
            });
        }

        const data = req.body;
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body must be a non-empty JSON object'
            });
        }

        const timestamp = data.timestamp ? parseInt(data.timestamp) : Date.now();
        const { timestamp: _, ...dataFields } = data;

        const result = await writeToInflux(config, fileId, spaceCode, dataFields, timestamp);

        if (result.ok) {
            // 异步执行触发器评估，不阻塞响应
            import('../services/iot-trigger-service.js').then(({ evaluateTriggers }) => {
                console.log(`📊 [Timeseries] Calling evaluateTriggers (legacy) for ${spaceCode}`);
                evaluateTriggers(dataFields, { fileId, spaceCode });
            }).catch(err => console.error('Failed to load trigger service:', err));

            res.json({
                success: true,
                message: 'Data written successfully',
                spaceCode,
                fieldsWritten: Object.keys(dataFields).length
            });
        } else if (result.reason === 'not_configured') {
            res.status(503).json({ success: false, error: 'InfluxDB auth not configured' });
        } else if (result.reason === 'no_valid_data') {
            res.status(400).json({ success: false, error: 'No valid numeric data fields found' });
        } else {
            res.status(500).json({ success: false, error: result.error || 'Failed to write to InfluxDB' });
        }
    } catch (error) {
        console.error('时序数据写入错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 查询平均值时序数据
 * GET /api/v1/timeseries/query/average
 */
router.get('/query/average', authenticate, authorize(PERMISSIONS.INFLUX_READ), async (req, res) => {
    try {
        const { startMs, endMs, windowMs, fileId } = req.query;
        console.log(`📊 [query/average] 收到请求: fileId=${fileId || '未传递'}`);

        // 获取配置
        let config;
        if (fileId) {
            console.log(`📊 [query/average] 使用 fileId=${fileId} 获取配置`);
            config = await getInfluxConfigByFileId(parseInt(fileId));
        } else {
            console.log(`📊 [query/average] 未传递 fileId，使用激活模型配置`);
            config = await getActiveInfluxConfig();
        }

        if (!config || !config.is_enabled) {
            return res.json({ success: true, data: [] });
        }

        const startIso = new Date(parseInt(startMs)).toISOString();
        const endIso = new Date(parseInt(endMs)).toISOString();
        const window = parseInt(windowMs) || 60000;

        // 构建 file_id 过滤条件（如果有 fileId 参数）
        const fileIdFilter = fileId ? ` and r.file_id == "${fileId}"` : '';

        const flux = `from(bucket: "${config.influx_bucket}")
  |> range(start: ${startIso}, stop: ${endIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value"${fileIdFilter})
  |> aggregateWindow(every: ${window}ms, fn: mean, createEmpty: false)
  |> group(columns: ["_time"]) 
  |> mean()`;

        const result = await queryInflux(config, flux);
        if (!result.ok) {
            return res.json({ success: true, data: [] });
        }

        const points = parseTimeSeriesCsv(result.csv);
        res.json({ success: true, data: points });
    } catch (error) {
        console.error('查询平均值错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 查询房间时序数据
 * GET /api/v1/timeseries/query/room
 */
router.get('/query/room', authenticate, authorize(PERMISSIONS.INFLUX_READ), async (req, res) => {
    try {
        const { roomCode, startMs, endMs, windowMs, fileId } = req.query;

        // 优先使用 fileId，其次使用 roomCode 查找对应模型的配置
        let config;
        if (fileId) {
            config = await getInfluxConfigByFileId(parseInt(fileId));
        } else if (roomCode) {
            config = await getInfluxConfigBySpaceCode(roomCode);
        } else {
            config = await getActiveInfluxConfig();
        }

        if (!config || !config.is_enabled) {
            return res.json({ success: true, data: [] });
        }

        const startIso = new Date(parseInt(startMs)).toISOString();
        const endIso = new Date(parseInt(endMs)).toISOString();
        const window = windowMs ? parseInt(windowMs) : 0;
        const escapedCode = roomCode.replace(/[,= ]/g, '_');

        // 当 windowMs > 0 时才进行聚合，否则返回原始数据点
        const aggregateClause = window > 0
            ? `|> aggregateWindow(every: ${window}ms, fn: mean, createEmpty: false)`
            : '';

        // 构建 file_id 过滤条件（如果有 fileId 参数）
        const fileIdFilter = fileId ? ` and r.file_id == "${fileId}"` : '';

        const flux = `from(bucket: "${config.influx_bucket}")
  |> range(start: ${startIso}, stop: ${endIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value"${fileIdFilter})
  |> filter(fn: (r) => r.code == "${escapedCode}")
  ${aggregateClause}`;

        const result = await queryInflux(config, flux);
        if (!result.ok) {
            return res.json({ success: true, data: [] });
        }

        const points = parseTimeSeriesCsv(result.csv);
        res.json({ success: true, data: points });
    } catch (error) {
        console.error('查询房间数据错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 查询多个房间的最新值
 * POST /api/v1/timeseries/query/latest
 */
router.post('/query/latest', authenticate, authorize(PERMISSIONS.INFLUX_READ), async (req, res) => {
    try {
        const { roomCodes, lookbackMs, fileId } = req.body;

        if (!roomCodes || !Array.isArray(roomCodes) || roomCodes.length === 0) {
            return res.json({ success: true, data: {} });
        }

        // 优先使用 fileId，其次使用第一个 roomCode 查找对应模型的配置
        let config;
        if (fileId) {
            config = await getInfluxConfigByFileId(parseInt(fileId));
        } else if (roomCodes.length > 0) {
            config = await getInfluxConfigBySpaceCode(roomCodes[0]);
        } else {
            config = await getActiveInfluxConfig();
        }

        if (!config || !config.is_enabled) {
            return res.json({ success: true, data: {} });
        }

        const startIso = new Date(Date.now() - Math.max(lookbackMs || 300000, 300000)).toISOString();
        const regex = roomCodes.map(c => c.replace(/[,= ]/g, '_')).join('|');

        // 构建 file_id 过滤条件（如果有 fileId 参数）
        const fileIdFilter = fileId ? ` and r.file_id == "${fileId}"` : '';

        const flux = `from(bucket: "${config.influx_bucket}")
  |> range(start: ${startIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value" and r["code"] =~ /${regex}/${fileIdFilter})
  |> group(columns: ["code"]) 
  |> last()`;

        const result = await queryInflux(config, flux);
        if (!result.ok) {
            return res.json({ success: true, data: {} });
        }

        const latestValues = parseLatestByRoomsCsv(result.csv);
        res.json({ success: true, data: latestValues });
    } catch (error) {
        console.error('查询最新值错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 检查 InfluxDB 配置状态
 * GET /api/v1/timeseries/status
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        const { fileId } = req.query;

        let config;
        if (fileId) {
            config = await getInfluxConfigByFileId(parseInt(fileId));
        } else {
            config = await getActiveInfluxConfig();
        }

        if (!config) {
            return res.json({
                success: true,
                data: { configured: false, enabled: false }
            });
        }

        res.json({
            success: true,
            data: {
                configured: true,
                enabled: config.is_enabled,
                url: config.influx_url,
                org: config.influx_org,
                bucket: config.influx_bucket
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取 Stream URL
 * GET /api/v1/timeseries/stream-url/:fileId/:spaceCode
 */
router.get('/stream-url/:fileId/:spaceCode', authenticate, authorize(PERMISSIONS.ASSET_UPDATE), async (req, res) => {
    try {
        const { fileId, spaceCode } = req.params;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const streamUrl = generateStreamUrl(fileId, spaceCode, baseUrl);

        res.json({
            success: true,
            data: {
                fileId,
                spaceCode,
                streamUrl,
                apiKey: generateStreamApiKey(fileId, spaceCode)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量获取多个空间的 Stream URL
 * POST /api/v1/timeseries/stream-urls
 */
router.post('/stream-urls', authenticate, authorize(PERMISSIONS.ASSET_UPDATE), async (req, res) => {
    try {
        const { fileId, spaceCodes } = req.body;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                error: 'fileId is required'
            });
        }

        if (!Array.isArray(spaceCodes) || spaceCodes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'spaceCodes must be a non-empty array'
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const urls = spaceCodes.map(code => ({
            fileId,
            spaceCode: code,
            streamUrl: generateStreamUrl(fileId, code, baseUrl),
            apiKey: generateStreamApiKey(fileId, code)
        }));

        res.json({ success: true, data: urls });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
