import { query } from '../db/index.js';

function generateFacilityCode(name = 'facility') {
    const normalized = String(name)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24) || 'FACILITY';
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    return `FAC-${normalized}-${suffix}`;
}

async function getAllFacilities() {
    const sql = `
        SELECT
            f.*,
            (
                SELECT COUNT(*)
                FROM model_files mf
                WHERE mf.facility_id = f.id
            )::int AS model_count,
            (
                SELECT COUNT(*)
                FROM views v
                JOIN model_files mf ON mf.id = v.file_id
                WHERE mf.facility_id = f.id
            )::int AS view_count,
            (
                SELECT mf.id
                FROM model_files mf
                WHERE mf.facility_id = f.id
                ORDER BY mf.display_order ASC, mf.created_at DESC, mf.id DESC
                LIMIT 1
            ) AS default_model_id,
            (
                SELECT COUNT(*)
                FROM assets a
                JOIN model_files mf ON mf.id = a.file_id
                WHERE mf.facility_id = f.id
            )::int AS asset_count,
            (
                SELECT COUNT(*)
                FROM spaces s
                JOIN model_files mf ON mf.id = s.file_id
                WHERE mf.facility_id = f.id
            )::int AS space_count,
            (
                SELECT COUNT(DISTINCT ic.file_id)
                FROM influx_configs ic
                JOIN model_files mf ON mf.id = ic.file_id
                WHERE mf.facility_id = f.id
                  AND ic.is_enabled = TRUE
            )::int AS iot_count,
            (
                SELECT COUNT(*)
                FROM documents d
                WHERE d.facility_id = f.id
            )::int AS document_count
        FROM facilities f
        ORDER BY f.created_at DESC, f.id DESC
    `;

    const result = await query(sql);
    return result.rows;
}

async function getFacilityById(id) {
    const sql = `
        SELECT
            f.*,
            (
                SELECT COUNT(*)
                FROM model_files mf
                WHERE mf.facility_id = f.id
            )::int AS model_count,
            (
                SELECT COUNT(*)
                FROM views v
                JOIN model_files mf ON mf.id = v.file_id
                WHERE mf.facility_id = f.id
            )::int AS view_count,
            (
                SELECT mf.id
                FROM model_files mf
                WHERE mf.facility_id = f.id
                ORDER BY mf.display_order ASC, mf.created_at DESC, mf.id DESC
                LIMIT 1
            ) AS default_model_id,
            (
                SELECT COUNT(*)
                FROM assets a
                JOIN model_files mf ON mf.id = a.file_id
                WHERE mf.facility_id = f.id
            )::int AS asset_count,
            (
                SELECT COUNT(*)
                FROM spaces s
                JOIN model_files mf ON mf.id = s.file_id
                WHERE mf.facility_id = f.id
            )::int AS space_count,
            (
                SELECT COUNT(DISTINCT ic.file_id)
                FROM influx_configs ic
                JOIN model_files mf ON mf.id = ic.file_id
                WHERE mf.facility_id = f.id
                  AND ic.is_enabled = TRUE
            )::int AS iot_count,
            (
                SELECT COUNT(*)
                FROM documents d
                WHERE d.facility_id = f.id
            )::int AS document_count
        FROM facilities f
        WHERE f.id = $1
    `;

    const result = await query(sql, [id]);
    return result.rows[0];
}

async function getFacilityModels(id) {
    const sql = `
        SELECT
            mf.*,
            (
                SELECT COUNT(*)
                FROM views v
                WHERE v.file_id = mf.id
            )::int AS view_count,
            (
                SELECT v.id
                FROM views v
                WHERE v.file_id = mf.id
                  AND v.is_default = TRUE
                ORDER BY v.updated_at DESC, v.id DESC
                LIMIT 1
            ) AS default_view_id
        FROM model_files mf
        WHERE mf.facility_id = $1
        ORDER BY mf.display_order ASC, mf.created_at DESC, mf.id DESC
    `;

    const result = await query(sql, [id]);
    return result.rows;
}

async function getFacilityWithModels(id) {
    const facility = await getFacilityById(id);
    if (!facility) return null;

    const models = await getFacilityModels(id);
    const modelIds = models.map(model => model.id);
    let viewsByFileId = new Map();

    if (modelIds.length > 0) {
        const sql = `
            SELECT
                id,
                file_id,
                name,
                thumbnail,
                is_default,
                created_at,
                updated_at
            FROM views
            WHERE file_id = ANY($1::int[])
            ORDER BY is_default DESC, updated_at DESC, id DESC
        `;
        const result = await query(sql, [modelIds]);
        viewsByFileId = result.rows.reduce((acc, row) => {
            const list = acc.get(row.file_id) || [];
            list.push(row);
            acc.set(row.file_id, list);
            return acc;
        }, new Map());
    }

    return {
        ...facility,
        model_count: models.length,
        dashboard_count: 0,
        asset_count: facility.asset_count ?? 0,
        space_count: facility.space_count ?? 0,
        iot_count: facility.iot_count ?? 0,
        document_count: facility.document_count ?? 0,
        models: models.map(model => ({
            ...model,
            views: viewsByFileId.get(model.id) || [],
        })),
    };
}

async function createFacility(data) {
    const sql = `
        INSERT INTO facilities (
            facility_code,
            name,
            description,
            address,
            cover_image_path,
            status,
            metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING *
    `;

    const result = await query(sql, [
        data.facilityCode || generateFacilityCode(data.name),
        data.name,
        data.description || null,
        data.address || null,
        data.coverImagePath || null,
        data.status || 'active',
        JSON.stringify(data.metadata || {}),
    ]);

    return result.rows[0];
}

async function updateFacility(id, updates) {
    const allowedFields = {
        facilityCode: 'facility_code',
        facility_code: 'facility_code',
        name: 'name',
        description: 'description',
        address: 'address',
        coverImagePath: 'cover_image_path',
        cover_image_path: 'cover_image_path',
        status: 'status',
        metadata: 'metadata',
    };

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, rawValue] of Object.entries(updates)) {
        const field = allowedFields[key];
        if (!field) continue;

        setClauses.push(`${field} = $${paramIndex}`);
        values.push(field === 'metadata' ? JSON.stringify(rawValue || {}) : rawValue);
        paramIndex++;
    }

    if (setClauses.length === 0) {
        return getFacilityById(id);
    }

    values.push(id);

    const sql = `
        UPDATE facilities
        SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0];
}

async function deleteFacility(id) {
    const sql = `
        DELETE FROM facilities
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [id]);
    return result.rows[0];
}

export {
    generateFacilityCode,
    getAllFacilities,
    getFacilityById,
    getFacilityModels,
    getFacilityWithModels,
    createFacility,
    updateFacility,
    deleteFacility,
};

export default {
    generateFacilityCode,
    getAllFacilities,
    getFacilityById,
    getFacilityModels,
    getFacilityWithModels,
    createFacility,
    updateFacility,
    deleteFacility,
};
