import { query } from '../db/index.js';
import { createKnowledgeBase } from './openwebui-service.js';

function normalizeKnowledgeBase(row) {
    if (!row) return null;
    return {
        id: row.id,
        file_id: row.file_id,
        facility_id: row.facility_id,
        source_file_id: row.source_file_id,
        openwebui_kb_id: row.openwebui_kb_id,
        kb_name: row.kb_name,
        scope_type: row.scope_type || 'file',
        status: row.status || 'active',
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function getFacilityIdForFile(fileId) {
    if (!fileId) return null;

    const result = await query(
        'SELECT facility_id FROM model_files WHERE id = $1',
        [fileId]
    );

    return result.rows[0]?.facility_id || null;
}

export async function getKnowledgeBaseByOpenWebUIId(openwebuiKbId) {
    if (!openwebuiKbId) return null;

    const result = await query(`
        SELECT *
        FROM knowledge_bases
        WHERE openwebui_kb_id = $1
        ORDER BY
            CASE WHEN scope_type = 'facility' THEN 0 ELSE 1 END,
            updated_at DESC,
            created_at DESC
        LIMIT 1
    `, [openwebuiKbId]);

    return normalizeKnowledgeBase(result.rows[0]);
}

export async function getFacilityKnowledgeBase(facilityId) {
    if (!facilityId) return null;

    const result = await query(`
        SELECT *
        FROM knowledge_bases
        WHERE facility_id = $1
          AND scope_type = 'facility'
          AND status = 'active'
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
    `, [facilityId]);

    return normalizeKnowledgeBase(result.rows[0]);
}

export async function getLegacyFileKnowledgeBase(fileId) {
    if (!fileId) return null;

    const result = await query(`
        SELECT *
        FROM knowledge_bases
        WHERE file_id = $1
          AND status = 'active'
        ORDER BY
            CASE WHEN scope_type = 'facility' THEN 0 ELSE 1 END,
            updated_at DESC,
            created_at DESC
        LIMIT 1
    `, [fileId]);

    return normalizeKnowledgeBase(result.rows[0]);
}

export async function resolveKnowledgeBase({ kbId = null, facilityId = null, fileId = null } = {}) {
    if (kbId) {
        const explicitKb = await getKnowledgeBaseByOpenWebUIId(kbId);
        if (explicitKb) return explicitKb;
    }

    let resolvedFacilityId = facilityId || null;
    if (!resolvedFacilityId && fileId) {
        resolvedFacilityId = await getFacilityIdForFile(fileId);
    }

    if (resolvedFacilityId) {
        const facilityKb = await getFacilityKnowledgeBase(resolvedFacilityId);
        if (facilityKb) return facilityKb;
    }

    if (fileId) {
        const legacyKb = await getLegacyFileKnowledgeBase(fileId);
        if (legacyKb) return legacyKb;
    }

    return null;
}

async function getFacilityInfo(facilityId) {
    const result = await query(
        'SELECT id, name FROM facilities WHERE id = $1',
        [facilityId]
    );
    return result.rows[0] || null;
}

export async function ensureFacilityKnowledgeBase(facilityId, options = {}) {
    if (!facilityId) {
        throw new Error('facilityId is required');
    }

    const existing = await getFacilityKnowledgeBase(facilityId);
    if (existing) {
        return existing;
    }

    const facility = await getFacilityInfo(facilityId);
    if (!facility) {
        throw new Error(`Facility ${facilityId} 不存在`);
    }

    const {
        sourceFileId = null,
        preferredName = null,
        description = null,
    } = options;

    if (sourceFileId) {
        const legacy = await getLegacyFileKnowledgeBase(sourceFileId);
        if (legacy) {
            const upgraded = await query(`
                UPDATE knowledge_bases
                SET scope_type = 'facility',
                    facility_id = $2,
                    source_file_id = COALESCE(source_file_id, $3),
                    status = 'active',
                    kb_name = COALESCE(NULLIF($4, ''), kb_name),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [
                legacy.id,
                facilityId,
                sourceFileId,
                preferredName ? `TwinSight-${preferredName}` : null,
            ]);

            return normalizeKnowledgeBase(upgraded.rows[0]);
        }
    }

    const kbName = preferredName ? `TwinSight-${preferredName}` : `TwinSight-${facility.name}`;
    const kbDescription = description || `知识库关联 Facility: ${facility.name}`;
    const openwebuiKb = await createKnowledgeBase(kbName, kbDescription);

    const created = await query(`
        INSERT INTO knowledge_bases (
            file_id,
            facility_id,
            source_file_id,
            openwebui_kb_id,
            kb_name,
            scope_type,
            status
        )
        VALUES ($1, $2, $3, $4, $5, 'facility', 'active')
        RETURNING *
    `, [
        sourceFileId,
        facilityId,
        sourceFileId,
        openwebuiKb.id,
        kbName,
    ]);

    return normalizeKnowledgeBase(created.rows[0]);
}

export async function listKnowledgeBaseDocuments({ kbId, facilityId = null, fileId = null, onlyUnsynced = false }) {
    if (!kbId) {
        throw new Error('kbId is required');
    }

    const params = [kbId];
    let scopeCondition = '';

    if (facilityId) {
        params.push(facilityId);
        scopeCondition = `
            (
                d.facility_id = $2
                OR EXISTS (
                    SELECT 1
                    FROM assets a
                    JOIN model_files mf ON mf.id = a.file_id
                    WHERE a.asset_code = d.asset_code
                      AND mf.facility_id = $2
                )
                OR EXISTS (
                    SELECT 1
                    FROM spaces s
                    JOIN model_files mf ON mf.id = s.file_id
                    WHERE s.space_code = d.space_code
                      AND mf.facility_id = $2
                )
                OR EXISTS (
                    SELECT 1
                    FROM asset_specs sp
                    JOIN model_files mf ON mf.id = sp.file_id
                    WHERE sp.spec_code = d.spec_code
                      AND mf.facility_id = $2
                )
            )
        `;
    } else if (fileId) {
        params.push(fileId);
        scopeCondition = `
            (
                EXISTS (
                    SELECT 1
                    FROM assets a
                    WHERE a.asset_code = d.asset_code
                      AND a.file_id = $2
                )
                OR EXISTS (
                    SELECT 1
                    FROM spaces s
                    WHERE s.space_code = d.space_code
                      AND s.file_id = $2
                )
                OR EXISTS (
                    SELECT 1
                    FROM asset_specs sp
                    WHERE sp.spec_code = d.spec_code
                      AND sp.file_id = $2
                )
            )
        `;
    } else {
        throw new Error('facilityId or fileId is required');
    }

    const pendingClause = onlyUnsynced
        ? `AND (kd.id IS NULL OR kd.sync_status NOT IN ('synced', 'duplicate', 'skipped'))`
        : '';

    const result = await query(`
        SELECT DISTINCT
            d.id,
            d.title,
            d.file_name AS org_name,
            d.file_path AS path,
            d.file_type,
            d.created_at
        FROM documents d
        LEFT JOIN kb_documents kd
            ON kd.document_id = d.id AND kd.kb_id = $1
        WHERE d.file_path IS NOT NULL
          AND ${scopeCondition}
          ${pendingClause}
        ORDER BY d.created_at DESC
    `, params);

    return result.rows;
}

export default {
    getFacilityIdForFile,
    getKnowledgeBaseByOpenWebUIId,
    getFacilityKnowledgeBase,
    getLegacyFileKnowledgeBase,
    resolveKnowledgeBase,
    ensureFacilityKnowledgeBase,
    listKnowledgeBaseDocuments,
};
