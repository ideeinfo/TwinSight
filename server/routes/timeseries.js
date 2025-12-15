/**
 * 时序数据接入 API
 * 接收外部传入的 JSON 格式时序数据并写入 InfluxDB
 */
import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// InfluxDB 配置（从环境变量读取）
const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'tandem';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'tandem';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

// 用于生成和验证 API Key 的密钥（生产环境应该使用更安全的密钥管理）
const API_KEY_SECRET = process.env.API_KEY_SECRET || 'tandem-timeseries-secret-2024';

/**
 * 生成 Stream 的 API Key
 * 基于空间编码和密钥生成唯一的 API Key
 */
export function generateStreamApiKey(spaceCode) {
    const hmac = crypto.createHmac('sha256', API_KEY_SECRET);
    hmac.update(spaceCode);
    // 返回 URL 安全的 Base64 编码（22字符）
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
 * 格式: http://host:port/api/v1/timeseries/streams/:spaceCode?key=:apiKey
 */
export function generateStreamUrl(spaceCode, baseUrl = '') {
    const apiKey = generateStreamApiKey(spaceCode);
    const encodedCode = encodeURIComponent(spaceCode);
    return `${baseUrl}/api/v1/timeseries/streams/${encodedCode}?key=${apiKey}`;
}

/**
 * 将数据写入 InfluxDB
 */
async function writeToInflux(spaceCode, data, timestamp = Date.now()) {
    if (!INFLUX_TOKEN) {
        console.warn('⚠️ InfluxDB Token 未配置，跳过写入');
        return { ok: false, reason: 'not_configured' };
    }

    // 构建 Line Protocol 格式的数据
    // 格式: measurement,tag=value field=value timestamp
    const lines = [];
    const escapedCode = spaceCode.replace(/[,= ]/g, '_');

    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number' && !isNaN(value)) {
            // 使用 measurement 名称为字段名，便于查询
            lines.push(`${key},room=${escapedCode},code=${escapedCode} value=${value} ${timestamp}`);
        }
    }

    if (lines.length === 0) {
        return { ok: false, reason: 'no_valid_data' };
    }

    const body = lines.join('\n');
    console.log(`📊 写入 InfluxDB: ${lines.length} 条数据点, 空间=${spaceCode}`);

    try {
        const resp = await fetch(
            `${INFLUX_URL}/api/v2/write?org=${encodeURIComponent(INFLUX_ORG)}&bucket=${encodeURIComponent(INFLUX_BUCKET)}&precision=ms`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${INFLUX_TOKEN}`,
                    'Content-Type': 'text/plain; charset=utf-8'
                },
                body
            }
        );

        if (resp.ok) {
            console.log(`✅ InfluxDB 写入成功`);
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

// ========================================
// API 路由
// ========================================

/**
 * 接收时序数据
 * POST /api/v1/timeseries/streams/:spaceCode
 * 
 * 请求头或查询参数中需要包含 API Key:
 *   - 查询参数: ?key=xxx
 *   - 请求头: Authorization: Bearer xxx
 * 
 * 请求体 (JSON):
 * {
 *   "room_temp": 25.8,
 *   "room_humi": 65,
 *   "timestamp": 1702648800000  // 可选，毫秒时间戳
 * }
 */
router.post('/streams/:spaceCode', async (req, res) => {
    try {
        const { spaceCode } = req.params;

        // 获取 API Key（从查询参数或 Authorization 头）
        let apiKey = req.query.key;
        if (!apiKey) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                apiKey = authHeader.substring(7);
            }
        }

        // 验证 API Key
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API Key is required. Provide via ?key=xxx or Authorization header.'
            });
        }

        try {
            if (!validateStreamApiKey(spaceCode, apiKey)) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid API Key'
                });
            }
        } catch (e) {
            return res.status(403).json({
                success: false,
                error: 'Invalid API Key format'
            });
        }

        // 解析请求体
        const data = req.body;
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body must be a non-empty JSON object with numeric values'
            });
        }

        // 提取时间戳（如果提供）
        const timestamp = data.timestamp ? parseInt(data.timestamp) : Date.now();

        // 移除 timestamp 字段，只保留数据字段
        const { timestamp: _, ...dataFields } = data;

        // 写入 InfluxDB
        const result = await writeToInflux(spaceCode, dataFields, timestamp);

        if (result.ok) {
            res.json({
                success: true,
                message: 'Data written successfully',
                spaceCode,
                fieldsWritten: Object.keys(dataFields).length
            });
        } else if (result.reason === 'not_configured') {
            res.status(503).json({
                success: false,
                error: 'InfluxDB not configured on server'
            });
        } else if (result.reason === 'no_valid_data') {
            res.status(400).json({
                success: false,
                error: 'No valid numeric data fields found'
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to write to InfluxDB'
            });
        }

    } catch (error) {
        console.error('时序数据写入错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取 Stream URL（用于前端生成复制链接）
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
        console.error('生成 Stream URL 错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量获取多个空间的 Stream URL
 * POST /api/v1/timeseries/stream-urls
 * 请求体: { spaceCodes: ["SPACE_001", "SPACE_002"] }
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
        console.error('批量生成 Stream URL 错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
