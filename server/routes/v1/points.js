import { Router } from 'express';
import { body, param, query as validateQuery } from 'express-validator';
import config from '../../config/index.js';
import { query } from '../../db/index.js';
import { PERMISSIONS } from '../../config/auth.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import { validateRequest } from '../../middleware/validate.js';
import { getConfig } from '../../services/config-service.js';
import pointModel, { POINT_TYPES } from '../../models/point.js';

const router = Router();
const INFLUX_TIMEOUT_MS = parseInt(process.env.INFLUX_TIMEOUT_MS || '3000', 10);

const escapeTag = (value) => String(value ?? '').replace(/[,= ]/g, '_');

const getGlobalInfluxConfig = async () => {
    const dbUrl = await getConfig('INFLUXDB_URL');
    if (!dbUrl) {
        if (!config.influx?.url) return null;
        return {
            influx_url: config.influx.url,
            influx_port: 8086,
            influx_org: config.influx.org,
            influx_bucket: config.influx.bucket,
            influx_token: config.influx.token,
            is_enabled: true,
            use_basic_auth: false,
        };
    }

    return {
        influx_url: dbUrl,
        influx_port: parseInt(await getConfig('INFLUXDB_PORT', '8086'), 10),
        influx_org: await getConfig('INFLUXDB_ORG', ''),
        influx_bucket: await getConfig('INFLUXDB_BUCKET', ''),
        influx_token: await getConfig('INFLUXDB_TOKEN', ''),
        is_enabled: (await getConfig('INFLUXDB_ENABLED', 'true')) === 'true',
        use_basic_auth: false,
    };
};

const getInfluxConfigByFileId = async (fileId) => {
    const result = await query('SELECT * FROM influx_configs WHERE file_id = $1 AND is_enabled = true LIMIT 1', [fileId]);
    return result.rows[0] || await getGlobalInfluxConfig();
};

const buildInfluxBaseUrl = (influxConfig) => {
    const url = influxConfig.influx_url;
    if (!url) return '';
    if (url.endsWith('/influx') || url.match(/:\d+$/)) {
        return url.replace(/\/$/, '');
    }
    return `${url.replace(/\/$/, '')}:${influxConfig.influx_port || 8086}`;
};

const buildInfluxHeaders = (influxConfig, accept = 'application/json') => {
    const headers = { Accept: accept };
    if (accept === 'application/csv') {
        headers['Content-Type'] = 'application/vnd.flux';
    }
    if (influxConfig.use_basic_auth && influxConfig.influx_user && influxConfig.influx_password) {
        headers.Authorization = `Basic ${Buffer.from(`${influxConfig.influx_user}:${influxConfig.influx_password}`).toString('base64')}`;
    } else if (influxConfig.influx_token) {
        headers.Authorization = `Token ${influxConfig.influx_token}`;
    }
    return headers.Authorization ? headers : null;
};

const queryInflux = async (influxConfig, flux) => {
    const headers = buildInfluxHeaders(influxConfig, 'application/csv');
    if (!headers) return '';

    const response = await fetch(`${buildInfluxBaseUrl(influxConfig)}/api/v2/query?org=${encodeURIComponent(influxConfig.influx_org)}`, {
        method: 'POST',
        headers,
        body: flux,
        signal: AbortSignal.timeout(INFLUX_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw ApiError.internal(`InfluxDB 查询失败: ${response.status}`);
    }

    return response.text();
};

const parsePointCsv = (csv) => {
    const lines = csv.split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
    const header = lines.find((line) => line.includes('_time') && line.includes('_value')) || '';
    const columns = header.split(',');
    const idxTime = columns.indexOf('_time');
    const idxValue = columns.indexOf('_value');
    const idxPoint = columns.indexOf('point_code');
    const idxMeasurement = columns.indexOf('_measurement');
    const idxCode = columns.indexOf('code');
    const idxRoom = columns.indexOf('room');
    const points = [];

    for (const line of lines) {
        if (line === header) continue;
        const parts = line.split(',');
        if (parts.length <= Math.max(idxTime, idxValue)) continue;
        const timestamp = Date.parse(parts[idxTime]);
        const value = Number.parseFloat(parts[idxValue]);
        if (!Number.isNaN(timestamp) && !Number.isNaN(value)) {
            points.push({
                timestamp,
                value,
                pointCode: idxPoint >= 0 ? parts[idxPoint] : undefined,
                measurement: idxMeasurement >= 0 ? parts[idxMeasurement] : undefined,
                code: idxCode >= 0 ? parts[idxCode] : undefined,
                room: idxRoom >= 0 ? parts[idxRoom] : undefined,
            });
        }
    }

    return points;
};

const parseLegacyPointCode = (pointCode) => {
    const match = String(pointCode || '').match(/^legacy_(temperature|humidity)_(.+)$/);
    if (!match) return null;
    return {
        pointType: match[1],
        targetCode: match[2],
    };
};

const writePointValue = async (influxConfig, point, value, timestamp) => {
    const headers = buildInfluxHeaders(influxConfig);
    if (!headers) {
        throw ApiError.internal('InfluxDB 未配置或未启用');
    }

    const numericValue = Number(value) * Number(point.multiplier || 1);
    if (!Number.isFinite(numericValue)) {
        throw ApiError.badRequest('value 必须是数字');
    }

    const tags = [
        `file_id=${point.fileId}`,
        `point_code=${escapeTag(point.pointCode)}`,
        `point_type=${escapeTag(point.pointType)}`,
        `target_type=${escapeTag(point.targetType)}`,
        `target_code=${escapeTag(point.targetCode)}`,
    ].join(',');

    const line = `point_data,${tags} value=${numericValue} ${timestamp}`;
    const response = await fetch(`${buildInfluxBaseUrl(influxConfig)}/api/v2/write?org=${encodeURIComponent(influxConfig.influx_org)}&bucket=${encodeURIComponent(influxConfig.influx_bucket)}&precision=ms`, {
        method: 'POST',
        headers,
        body: line,
        signal: AbortSignal.timeout(INFLUX_TIMEOUT_MS),
    });

    if (!response.ok) {
        const text = await response.text();
        throw ApiError.internal(`InfluxDB 写入失败: ${response.status} ${text.slice(0, 120)}`);
    }
};

router.get('/types',
    authenticate,
    authorize(PERMISSIONS.POINT_READ),
    async (_req, res) => {
        res.json({ success: true, data: POINT_TYPES });
    }
);

router.get('/',
    authenticate,
    authorize(PERMISSIONS.POINT_READ),
    validateQuery('facilityId').optional().isInt().toInt(),
    validateQuery('fileId').optional().isInt().toInt(),
    validateQuery('targetType').optional().isIn(['space', 'asset']),
    validateQuery('pointType').optional().isIn(POINT_TYPES),
    validateQuery('keyword').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const points = await pointModel.listPoints(req.query);
            res.json({ success: true, data: points });
        } catch (error) {
            next(error);
        }
    }
);

router.post('/',
    authenticate,
    authorize(PERMISSIONS.POINT_MANAGE),
    body('fileId').isInt().toInt(),
    body('pointCode').notEmpty().trim(),
    body('name').notEmpty().trim(),
    body('pointType').isIn(POINT_TYPES),
    body('dataKind').optional().isIn(['scalar', 'video']),
    body('targetType').isIn(['space', 'asset']),
    body('targetCode').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const point = await pointModel.createPoint(req.body);
            res.status(201).json({ success: true, data: point });
        } catch (error) {
            next(error);
        }
    }
);

router.put('/:id',
    authenticate,
    authorize(PERMISSIONS.POINT_MANAGE),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const point = await pointModel.updatePoint(req.params.id, req.body);
            res.json({ success: true, data: point });
        } catch (error) {
            next(error);
        }
    }
);

router.delete('/:id',
    authenticate,
    authorize(PERMISSIONS.POINT_MANAGE),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            await pointModel.deletePoint(req.params.id);
            res.json({ success: true, message: '点位已删除' });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/:id/stream-url',
    authenticate,
    authorize(PERMISSIONS.POINT_MANAGE),
    param('id').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const point = await pointModel.getPointById(req.params.id);
            if (!point) throw ApiError.notFound('点位不存在');
            if (point.dataKind === 'video') throw ApiError.badRequest('视频点位不支持时序写入地址');

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            res.json({
                success: true,
                data: {
                    pointId: point.id,
                    pointCode: point.pointCode,
                    streamUrl: pointModel.generatePointStreamUrl(point.fileId, point.pointCode, baseUrl),
                    apiKey: pointModel.generatePointApiKey(point.fileId, point.pointCode),
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.post('/streams/:fileId/:pointCode',
    param('fileId').isInt().toInt(),
    param('pointCode').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { fileId, pointCode } = req.params;
            const apiKey = req.query.key || req.headers.authorization?.replace(/^Bearer\s+/i, '');
            if (!apiKey || !pointModel.validatePointApiKey(fileId, pointCode, apiKey)) {
                throw ApiError.forbidden('Invalid API Key');
            }

            const point = await pointModel.getPointByCode(fileId, pointCode);
            if (!point || !point.isEnabled) throw ApiError.notFound('点位不存在或未启用');
            if (point.dataKind === 'video') throw ApiError.badRequest('视频点位不支持时序写入');

            const value = req.body?.value;
            const timestamp = req.body?.timestamp ? Number.parseInt(req.body.timestamp, 10) : Date.now();
            const influxConfig = await getInfluxConfigByFileId(point.fileId);
            if (!influxConfig?.is_enabled) throw ApiError.internal('InfluxDB 未配置或未启用');

            await writePointValue(influxConfig, point, value, timestamp);
            res.json({
                success: true,
                data: {
                    pointCode: point.pointCode,
                    value: Number(value) * Number(point.multiplier || 1),
                    timestamp,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/query/latest',
    authenticate,
    authorize(PERMISSIONS.POINT_READ),
    validateQuery('fileId').isInt().toInt(),
    validateQuery('pointCodes').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { fileId, pointCodes } = req.query;
            const influxConfig = await getInfluxConfigByFileId(fileId);
            if (!influxConfig?.is_enabled) return res.json({ success: true, data: {} });

            const flux = `from(bucket: "${influxConfig.influx_bucket}")
  |> range(start: -3650d)
  |> filter(fn: (r) => r._measurement == "point_data" and r._field == "value" and r["file_id"] == "${fileId}")
  |> group(columns: ["point_code"])
  |> last()`;
            const requestedCodes = pointCodes
                ? new Set(String(pointCodes).split(',').map((code) => escapeTag(code)).filter(Boolean))
                : null;
            const points = parsePointCsv(await queryInflux(influxConfig, flux));
            const data = {};
            for (const point of points) {
                if (point.pointCode && (!requestedCodes || requestedCodes.has(point.pointCode))) {
                    data[point.pointCode] = { value: point.value, timestamp: point.timestamp };
                }
            }

            const legacyRequests = requestedCodes
                ? [...requestedCodes].map(parseLegacyPointCode).filter(Boolean)
                : [];
            const missingLegacyCodes = legacyRequests
                .map(({ pointType, targetCode }) => `legacy_${pointType}_${targetCode}`)
                .filter((pointCode) => !data[pointCode]);

            if (missingLegacyCodes.length > 0) {
                const legacyTargetCodes = [...new Set(legacyRequests.map(({ targetCode }) => targetCode))];
                const codeSet = legacyTargetCodes.map((code) => `"${String(code).replace(/"/g, '\\"')}"`).join(', ');
                const legacyFlux = `from(bucket: "${influxConfig.influx_bucket}")
  |> range(start: -3650d)
  |> filter(fn: (r) => (r._measurement == "room_temp" or r._measurement == "temperature" or r._measurement == "humidity") and r._field == "value" and r["file_id"] == "${fileId}")
  |> filter(fn: (r) => contains(value: r["code"], set: [${codeSet}]) or contains(value: r["room"], set: [${codeSet}]))
  |> group(columns: ["_measurement", "code", "room"])
  |> last()`;
                const legacyPoints = parsePointCsv(await queryInflux(influxConfig, legacyFlux));
                for (const point of legacyPoints) {
                    const targetCode = point.code || point.room;
                    const pointType = point.measurement === 'humidity' ? 'humidity' : 'temperature';
                    const pointCode = `legacy_${pointType}_${targetCode}`;
                    if (missingLegacyCodes.includes(pointCode)) {
                        data[pointCode] = { value: point.value, timestamp: point.timestamp };
                    }
                }
            }
            res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }
);

router.get('/query/trend',
    authenticate,
    authorize(PERMISSIONS.POINT_READ),
    validateQuery('fileId').isInt().toInt(),
    validateQuery('pointCode').notEmpty().trim(),
    validateQuery('startMs').isInt().toInt(),
    validateQuery('endMs').isInt().toInt(),
    validateQuery('windowMs').optional().isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { fileId, pointCode, startMs, endMs, windowMs } = req.query;
            const influxConfig = await getInfluxConfigByFileId(fileId);
            if (!influxConfig?.is_enabled) return res.json({ success: true, data: [] });

            const aggregateClause = windowMs
                ? `|> aggregateWindow(every: ${windowMs}ms, fn: mean, createEmpty: false)`
                : '';
            const flux = `from(bucket: "${influxConfig.influx_bucket}")
  |> range(start: ${new Date(startMs).toISOString()}, stop: ${new Date(endMs).toISOString()})
  |> filter(fn: (r) => r._measurement == "point_data" and r._field == "value" and r["file_id"] == "${fileId}" and r["point_code"] == "${escapeTag(pointCode)}")
  ${aggregateClause}
  |> sort(columns: ["_time"])`;
            res.json({ success: true, data: parsePointCsv(await queryInflux(influxConfig, flux)) });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
