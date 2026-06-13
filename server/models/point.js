import crypto from 'crypto';
import { query, getClient } from '../db/index.js';
import { ApiError } from '../middleware/error-handler.js';

const API_KEY_SECRET = process.env.API_KEY_SECRET || 'tandem-timeseries-secret-2024';

export const POINT_TYPES = [
    'temperature',
    'humidity',
    'illuminance',
    'displacement',
    'vibration',
    'energy',
    'electricity',
    'water',
    'gas',
    'video',
];

const DATA_KINDS = ['scalar', 'video'];
const TARGET_TYPES = ['space', 'asset'];

const sanitizeString = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const toPositiveInt = (value, fieldName) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw ApiError.badRequest(`${fieldName} 无效`);
    }
    return parsed;
};

const normalizePointCode = (value) => sanitizeString(value).replace(/\s+/g, '_');

const mapPointRow = (row) => ({
    id: row.id,
    uuid: row.uuid,
    facilityId: row.facility_id,
    fileId: row.file_id,
    pointCode: row.point_code,
    name: row.name,
    pointType: row.point_type,
    dataKind: row.data_kind,
    targetType: row.target_type,
    targetCode: row.target_code,
    unit: row.unit,
    multiplier: Number(row.multiplier ?? 1),
    protocol: row.protocol,
    sourceUrl: row.source_url,
    thresholdMin: row.threshold_min === null ? null : Number(row.threshold_min),
    thresholdMax: row.threshold_max === null ? null : Number(row.threshold_max),
    isEnabled: row.is_enabled,
    description: row.description,
    targetName: row.target_name,
    targetDbId: row.target_db_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const validateTarget = async (client, { fileId, targetType, targetCode }) => {
    if (targetType === 'space') {
        const result = await client.query(
            'SELECT space_code AS code, name, db_id FROM spaces WHERE file_id = $1 AND space_code = $2 LIMIT 1',
            [fileId, targetCode]
        );
        if (!result.rows[0]) {
            throw ApiError.badRequest('绑定空间不存在');
        }
        return result.rows[0];
    }

    const result = await client.query(
        'SELECT asset_code AS code, name, db_id FROM assets WHERE file_id = $1 AND asset_code = $2 LIMIT 1',
        [fileId, targetCode]
    );
    if (!result.rows[0]) {
        throw ApiError.badRequest('绑定资产不存在');
    }
    return result.rows[0];
};

const normalizePayload = (payload = {}, existing = null) => {
    const fileId = payload.fileId !== undefined
        ? toPositiveInt(payload.fileId, 'fileId')
        : existing?.fileId;
    const pointCode = payload.pointCode !== undefined
        ? normalizePointCode(payload.pointCode)
        : existing?.pointCode;
    const name = payload.name !== undefined
        ? sanitizeString(payload.name)
        : existing?.name;
    const pointType = payload.pointType !== undefined
        ? sanitizeString(payload.pointType)
        : existing?.pointType;
    const dataKind = payload.dataKind !== undefined
        ? sanitizeString(payload.dataKind)
        : (pointType === 'video' ? 'video' : existing?.dataKind || 'scalar');
    const targetType = payload.targetType !== undefined
        ? sanitizeString(payload.targetType)
        : existing?.targetType;
    const targetCode = payload.targetCode !== undefined
        ? sanitizeString(payload.targetCode)
        : existing?.targetCode;

    if (!fileId) throw ApiError.badRequest('fileId 不能为空');
    if (!pointCode) throw ApiError.badRequest('pointCode 不能为空');
    if (!name) throw ApiError.badRequest('name 不能为空');
    if (!POINT_TYPES.includes(pointType)) throw ApiError.badRequest('pointType 无效');
    if (!DATA_KINDS.includes(dataKind)) throw ApiError.badRequest('dataKind 无效');
    if (!TARGET_TYPES.includes(targetType)) throw ApiError.badRequest('targetType 无效');
    if (!targetCode) throw ApiError.badRequest('targetCode 不能为空');

    return {
        facilityId: payload.facilityId !== undefined ? payload.facilityId || null : existing?.facilityId || null,
        fileId,
        pointCode,
        name,
        pointType,
        dataKind,
        targetType,
        targetCode,
        unit: payload.unit !== undefined ? sanitizeString(payload.unit) || null : existing?.unit || null,
        multiplier: payload.multiplier !== undefined ? Number(payload.multiplier || 1) : existing?.multiplier ?? 1,
        protocol: payload.protocol !== undefined ? sanitizeString(payload.protocol) || 'http' : existing?.protocol || 'http',
        sourceUrl: payload.sourceUrl !== undefined ? sanitizeString(payload.sourceUrl) || null : existing?.sourceUrl || null,
        thresholdMin: payload.thresholdMin !== undefined && payload.thresholdMin !== '' ? Number(payload.thresholdMin) : (payload.thresholdMin === '' ? null : existing?.thresholdMin ?? null),
        thresholdMax: payload.thresholdMax !== undefined && payload.thresholdMax !== '' ? Number(payload.thresholdMax) : (payload.thresholdMax === '' ? null : existing?.thresholdMax ?? null),
        isEnabled: payload.isEnabled !== undefined ? Boolean(payload.isEnabled) : existing?.isEnabled ?? true,
        description: payload.description !== undefined ? sanitizeString(payload.description) || null : existing?.description || null,
    };
};

export function generatePointApiKey(fileId, pointCode) {
    const hmac = crypto.createHmac('sha256', API_KEY_SECRET);
    hmac.update(`point:${fileId}:${pointCode}`);
    return hmac.digest('base64url').substring(0, 22);
}

export function validatePointApiKey(fileId, pointCode, providedKey = '') {
    const expectedKey = generatePointApiKey(fileId, pointCode);
    if (providedKey.length < expectedKey.length) return false;
    return crypto.timingSafeEqual(
        Buffer.from(expectedKey),
        Buffer.from(providedKey.substring(0, expectedKey.length))
    );
}

export function generatePointStreamUrl(fileId, pointCode, baseUrl = '') {
    const apiKey = generatePointApiKey(fileId, pointCode);
    return `${baseUrl}/api/v1/points/streams/${fileId}/${encodeURIComponent(pointCode)}?key=${apiKey}`;
}

export async function listPoints(filters = {}) {
    const values = [];
    const conditions = [];

    if (filters.facilityId) {
        values.push(toPositiveInt(filters.facilityId, 'facilityId'));
        conditions.push(`p.facility_id = $${values.length}`);
    }
    if (filters.fileId) {
        values.push(toPositiveInt(filters.fileId, 'fileId'));
        conditions.push(`p.file_id = $${values.length}`);
    }
    if (filters.targetType) {
        values.push(sanitizeString(filters.targetType));
        conditions.push(`p.target_type = $${values.length}`);
    }
    if (filters.pointType) {
        values.push(sanitizeString(filters.pointType));
        conditions.push(`p.point_type = $${values.length}`);
    }
    if (filters.keyword) {
        values.push(`%${sanitizeString(filters.keyword)}%`);
        conditions.push(`(p.point_code ILIKE $${values.length} OR p.name ILIKE $${values.length} OR p.target_code ILIKE $${values.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(`
        SELECT
            p.*,
            CASE WHEN p.target_type = 'space' THEN s.name ELSE a.name END AS target_name,
            CASE WHEN p.target_type = 'space' THEN s.db_id ELSE a.db_id END AS target_db_id
        FROM points p
        LEFT JOIN spaces s ON p.target_type = 'space' AND s.file_id = p.file_id AND s.space_code = p.target_code
        LEFT JOIN assets a ON p.target_type = 'asset' AND a.file_id = p.file_id AND a.asset_code = p.target_code
        ${whereClause}
        ORDER BY p.updated_at DESC, p.id DESC
    `, values);

    return result.rows.map(mapPointRow);
}

export async function getPointById(id, db = { query }) {
    const result = await db.query(`
        SELECT
            p.*,
            CASE WHEN p.target_type = 'space' THEN s.name ELSE a.name END AS target_name,
            CASE WHEN p.target_type = 'space' THEN s.db_id ELSE a.db_id END AS target_db_id
        FROM points p
        LEFT JOIN spaces s ON p.target_type = 'space' AND s.file_id = p.file_id AND s.space_code = p.target_code
        LEFT JOIN assets a ON p.target_type = 'asset' AND a.file_id = p.file_id AND a.asset_code = p.target_code
        WHERE p.id = $1
    `, [toPositiveInt(id, 'id')]);
    return result.rows[0] ? mapPointRow(result.rows[0]) : null;
}

export async function getPointByCode(fileId, pointCode, db = { query }) {
    const result = await db.query(`
        SELECT
            p.*,
            CASE WHEN p.target_type = 'space' THEN s.name ELSE a.name END AS target_name,
            CASE WHEN p.target_type = 'space' THEN s.db_id ELSE a.db_id END AS target_db_id
        FROM points p
        LEFT JOIN spaces s ON p.target_type = 'space' AND s.file_id = p.file_id AND s.space_code = p.target_code
        LEFT JOIN assets a ON p.target_type = 'asset' AND a.file_id = p.file_id AND a.asset_code = p.target_code
        WHERE p.file_id = $1 AND p.point_code = $2
    `, [toPositiveInt(fileId, 'fileId'), normalizePointCode(pointCode)]);
    return result.rows[0] ? mapPointRow(result.rows[0]) : null;
}

export async function createPoint(payload) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const data = normalizePayload(payload);
        await validateTarget(client, data);

        const result = await client.query(`
            INSERT INTO points (
                facility_id, file_id, point_code, name, point_type, data_kind,
                target_type, target_code, unit, multiplier, protocol, source_url,
                threshold_min, threshold_max, is_enabled, description
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id
        `, [
            data.facilityId,
            data.fileId,
            data.pointCode,
            data.name,
            data.pointType,
            data.dataKind,
            data.targetType,
            data.targetCode,
            data.unit,
            data.multiplier,
            data.protocol,
            data.sourceUrl,
            data.thresholdMin,
            data.thresholdMax,
            data.isEnabled,
            data.description,
        ]);

        await client.query('COMMIT');
        return getPointById(result.rows[0].id);
    } catch (error) {
        await client.query('ROLLBACK');
        if (error?.code === '23505') {
            throw ApiError.badRequest('同一模型下点位编号已存在');
        }
        throw error;
    } finally {
        client.release();
    }
}

export async function updatePoint(id, payload) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const existing = await getPointById(id, client);
        if (!existing) throw ApiError.notFound('点位不存在');

        const data = normalizePayload(payload, existing);
        await validateTarget(client, data);

        await client.query(`
            UPDATE points
            SET
                facility_id = $2,
                file_id = $3,
                point_code = $4,
                name = $5,
                point_type = $6,
                data_kind = $7,
                target_type = $8,
                target_code = $9,
                unit = $10,
                multiplier = $11,
                protocol = $12,
                source_url = $13,
                threshold_min = $14,
                threshold_max = $15,
                is_enabled = $16,
                description = $17
            WHERE id = $1
        `, [
            existing.id,
            data.facilityId,
            data.fileId,
            data.pointCode,
            data.name,
            data.pointType,
            data.dataKind,
            data.targetType,
            data.targetCode,
            data.unit,
            data.multiplier,
            data.protocol,
            data.sourceUrl,
            data.thresholdMin,
            data.thresholdMax,
            data.isEnabled,
            data.description,
        ]);

        await client.query('COMMIT');
        return getPointById(existing.id);
    } catch (error) {
        await client.query('ROLLBACK');
        if (error?.code === '23505') {
            throw ApiError.badRequest('同一模型下点位编号已存在');
        }
        throw error;
    } finally {
        client.release();
    }
}

export async function deletePoint(id) {
    const existing = await getPointById(id);
    if (!existing) throw ApiError.notFound('点位不存在');

    await query('DELETE FROM points WHERE id = $1', [existing.id]);
    return existing;
}

export default {
    POINT_TYPES,
    createPoint,
    deletePoint,
    generatePointApiKey,
    generatePointStreamUrl,
    getPointByCode,
    getPointById,
    listPoints,
    updatePoint,
    validatePointApiKey,
};
