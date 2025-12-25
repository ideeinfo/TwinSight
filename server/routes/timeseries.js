/**
 * 时序数据 API
 * 所有 InfluxDB 操作通过后端代理，使用数据库中的配置
 */
import { Router } from 'express';
import crypto from 'crypto';
import { getInfluxConfig } from '../models/influx-config.js';
import { query } from '../db/index.js';

const router = Router();

// 用于生成和验证 API Key 的密钥
const API_KEY_SECRET = process.env.API_KEY_SECRET || 'tandem-timeseries-secret-2024';

/**
 * 生成 Stream 的 API Key
 */
export function generateStreamApiKey(spaceCode) {
    const hmac = crypto.createHmac('sha256', API_KEY_SECRET);
    hmac.update(spaceCode);
    return hmac.digest('base64url').substring(0, 22);
}

/**
 * 验证 API Key 是否有效
 */
export function validateStreamApiKey(spaceCode, providedKey) {
    const expectedKey = generateStreamApiKey(spaceCode);
    return crypto.timingSafeEqual(
        Buffer.from(expectedKey),
        Buffer.from(providedKey.substring(0, 22))
    );
}

/**
 * 生成完整的 Stream URL
 */
export function generateStreamUrl(spaceCode, baseUrl = '') {
    const apiKey = generateStreamApiKey(spaceCode);
    const encodedCode = encodeURIComponent(spaceCode);
    return `${baseUrl}/api/v1/timeseries/streams/${encodedCode}?key=${apiKey}`;
}

/**
 * 获取当前激活模型的 InfluxDB 配置
 */
async function getActiveInfluxConfig() {
    try {
        // 查找当前激活的模型
        const result = await query('SELECT id FROM model_files WHERE is_active = true LIMIT 1');
        if (result.rows.length === 0) {
            return null;
        }
        const fileId = result.rows[0].id;
        const config = await getInfluxConfig(fileId);
        return config;
    } catch (error) {
        console.error('获取激活模型 InfluxDB 配置失败:', error);
        return null;
    }
}

/**
 * 从指定文件ID获取 InfluxDB 配置
 */
async function getInfluxConfigByFileId(fileId) {
    try {
        const config = await getInfluxConfig(fileId);
        return config;
    } catch (error) {
        console.error('获取 InfluxDB 配置失败:', error);
        return null;
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
 * 将数据写入 InfluxDB
 */
async function writeToInflux(config, spaceCode, data, timestamp = Date.now()) {
    const headers = buildInfluxHeaders(config);
    if (!headers) {
        console.warn('⚠️ InfluxDB 认证未配置');
        return { ok: false, reason: 'not_configured' };
    }

    const baseUrl = buildInfluxBaseUrl(config);
    const lines = [];
    const escapedCode = spaceCode.replace(/[,= ]/g, '_');

    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number' && !isNaN(value)) {
            lines.push(`${key},room=${escapedCode},code=${escapedCode} value=${value} ${timestamp}`);
        }
    }

    if (lines.length === 0) {
        return { ok: false, reason: 'no_valid_data' };
    }

    const body = lines.join('\n');
    // 禁用日志
    // console.log(`📊 写入 InfluxDB: ${lines.length} 条数据点, 空间=${spaceCode}`);

    try {
        const resp = await fetch(
            `${baseUrl}/api/v2/write?org=${encodeURIComponent(config.influx_org)}&bucket=${encodeURIComponent(config.influx_bucket)}&precision=ms`,
            { method: 'POST', headers, body }
        );

        if (resp.ok) {
            // console.log(`✅ InfluxDB 写入成功`);
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
            { method: 'POST', headers, body: flux }
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
 * 接收时序数据
 * POST /api/v1/timeseries/streams/:spaceCode
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

        try {
            if (!validateStreamApiKey(spaceCode, apiKey)) {
                return res.status(403).json({ success: false, error: 'Invalid API Key' });
            }
        } catch (e) {
            return res.status(403).json({ success: false, error: 'Invalid API Key format' });
        }

        // 获取 InfluxDB 配置
        const config = await getActiveInfluxConfig();
        if (!config || !config.is_enabled) {
            return res.status(503).json({
                success: false,
                error: 'InfluxDB not configured for active model'
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

        const result = await writeToInflux(config, spaceCode, dataFields, timestamp);

        if (result.ok) {
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
router.get('/query/average', async (req, res) => {
    try {
        const { startMs, endMs, windowMs, fileId } = req.query;

        // 获取配置
        let config;
        if (fileId) {
            config = await getInfluxConfigByFileId(parseInt(fileId));
        } else {
            config = await getActiveInfluxConfig();
        }

        if (!config || !config.is_enabled) {
            return res.json({ success: true, data: [] });
        }

        const startIso = new Date(parseInt(startMs)).toISOString();
        const endIso = new Date(parseInt(endMs)).toISOString();
        const window = parseInt(windowMs) || 60000;

        const flux = `from(bucket: "${config.influx_bucket}")
  |> range(start: ${startIso}, stop: ${endIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value")
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
router.get('/query/room', async (req, res) => {
    try {
        const { roomCode, startMs, endMs, windowMs, fileId } = req.query;

        let config;
        if (fileId) {
            config = await getInfluxConfigByFileId(parseInt(fileId));
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

        const flux = `from(bucket: "${config.influx_bucket}")
  |> range(start: ${startIso}, stop: ${endIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value")
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
router.post('/query/latest', async (req, res) => {
    try {
        const { roomCodes, lookbackMs, fileId } = req.body;

        if (!roomCodes || !Array.isArray(roomCodes) || roomCodes.length === 0) {
            return res.json({ success: true, data: {} });
        }

        let config;
        if (fileId) {
            config = await getInfluxConfigByFileId(parseInt(fileId));
        } else {
            config = await getActiveInfluxConfig();
        }

        if (!config || !config.is_enabled) {
            return res.json({ success: true, data: {} });
        }

        const startIso = new Date(Date.now() - Math.max(lookbackMs || 300000, 300000)).toISOString();
        const regex = roomCodes.map(c => c.replace(/[,= ]/g, '_')).join('|');

        const flux = `from(bucket: "${config.influx_bucket}")
  |> range(start: ${startIso})
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature") and r._field == "value" and r["code"] =~ /${regex}/)
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
router.get('/status', async (req, res) => {
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
 * GET /api/v1/timeseries/stream-url/:spaceCode
 */
router.get('/stream-url/:spaceCode', async (req, res) => {
    try {
        const { spaceCode } = req.params;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const streamUrl = generateStreamUrl(spaceCode, baseUrl);

        res.json({
            success: true,
            data: {
                spaceCode,
                streamUrl,
                apiKey: generateStreamApiKey(spaceCode)
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
router.post('/stream-urls', async (req, res) => {
    try {
        const { spaceCodes } = req.body;

        if (!Array.isArray(spaceCodes) || spaceCodes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'spaceCodes must be a non-empty array'
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const urls = spaceCodes.map(code => ({
            spaceCode: code,
            streamUrl: generateStreamUrl(code, baseUrl),
            apiKey: generateStreamApiKey(code)
        }));

        res.json({ success: true, data: urls });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
