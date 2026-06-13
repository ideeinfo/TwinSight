import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClient, query } from '../db/index.js';
import { ApiError } from '../middleware/error-handler.js';

const STATUS_PRIORITY = {
    new: 3,
    completed: 2,
    closed: 1,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toPositiveInt = (value, fieldName) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw ApiError.badRequest(`${fieldName} 必须是正整数`);
    }
    return parsed;
};

const sanitizeString = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const uniqueStrings = (values = []) => {
    return [...new Set(
        values
            .map((value) => sanitizeString(value))
            .filter(Boolean)
    )];
};

const assetBelongsToSpace = (asset, space) => {
    const roomName = sanitizeString(asset?.room).toLowerCase();
    const spaceName = sanitizeString(space?.name).toLowerCase();
    const spaceCode = sanitizeString(space?.space_code).toLowerCase();
    const assetCode = sanitizeString(asset?.asset_code).toLowerCase();

    const roomMatchesSpace = roomName && (
        roomName === spaceName
        || roomName === spaceCode
        || (spaceName && spaceCode && roomName === `${spaceName} ${spaceCode}`)
        || (spaceName && spaceCode && roomName === `${spaceCode} ${spaceName}`)
        || (spaceName && spaceCode && roomName.includes(spaceName) && roomName.includes(spaceCode))
    );

    return roomMatchesSpace
        || (spaceCode && assetCode.includes(spaceCode))
        || Number(asset?.db_id) === Number(space?.db_id);
};

const getStatusTimestamps = (status, previous = {}) => {
    const now = new Date();
    if (status === 'new') {
        return {
            completedAt: null,
            closedAt: null,
        };
    }
    if (status === 'completed') {
        return {
            completedAt: previous.completed_at || now,
            closedAt: null,
        };
    }
    return {
        completedAt: previous.completed_at || now,
        closedAt: previous.closed_at || now,
    };
};

const buildTicketWhere = (filters = {}, values = []) => {
    const conditions = [];

    if (filters.facilityId) {
        values.push(toPositiveInt(filters.facilityId, 'facilityId'));
        conditions.push(`t.facility_id = $${values.length}`);
    }

    if (filters.fileId) {
        values.push(toPositiveInt(filters.fileId, 'fileId'));
        conditions.push(`t.file_id = $${values.length}`);
    }

    if (filters.status) {
        values.push(sanitizeString(filters.status));
        conditions.push(`t.status = $${values.length}`);
    }

    if (filters.spaceCode) {
        values.push(sanitizeString(filters.spaceCode));
        conditions.push(`t.source_space_code = $${values.length}`);
    }

    if (filters.assigneeUserId) {
        values.push(toPositiveInt(filters.assigneeUserId, 'assigneeUserId'));
        conditions.push(`t.assignee_user_id = $${values.length}`);
    }

    if (filters.assetCode) {
        values.push(sanitizeString(filters.assetCode));
        conditions.push(`
            EXISTS (
                SELECT 1
                FROM ticket_assets ta_filter
                JOIN assets a_filter ON a_filter.id = ta_filter.asset_id
                WHERE ta_filter.ticket_id = t.id
                  AND a_filter.asset_code = $${values.length}
            )
        `);
    }

    if (filters.markerDbId) {
        values.push(toPositiveInt(filters.markerDbId, 'markerDbId'));
        const markerIndex = values.length;
        conditions.push(`
            (
                EXISTS (
                    SELECT 1
                    FROM ticket_assets ta_filter
                    JOIN assets a_filter ON a_filter.id = ta_filter.asset_id
                    WHERE ta_filter.ticket_id = t.id
                      AND a_filter.db_id = $${markerIndex}
                )
                OR (
                    NOT EXISTS (
                        SELECT 1 FROM ticket_assets ta_none WHERE ta_none.ticket_id = t.id
                    )
                    AND s.db_id = $${markerIndex}
                )
            )
        `);
    }

    if (filters.keyword) {
        values.push(`%${sanitizeString(filters.keyword)}%`);
        const keywordIndex = values.length;
        conditions.push(`
            (
                t.ticket_no ILIKE $${keywordIndex}
                OR COALESCE(t.title, '') ILIKE $${keywordIndex}
                OR COALESCE(t.description, '') ILIKE $${keywordIndex}
                OR COALESCE(s.name, '') ILIKE $${keywordIndex}
                OR EXISTS (
                    SELECT 1
                    FROM ticket_assets ta_kw
                    JOIN assets a_kw ON a_kw.id = ta_kw.asset_id
                    WHERE ta_kw.ticket_id = t.id
                      AND (
                          a_kw.asset_code ILIKE $${keywordIndex}
                          OR COALESCE(a_kw.name, '') ILIKE $${keywordIndex}
                      )
                )
            )
        `);
    }

    return conditions;
};

const hydrateTickets = async (db, tickets) => {
    if (!tickets.length) {
        return [];
    }

    const ticketIds = tickets.map((ticket) => ticket.id);

    const [assetsResult, attachmentsResult] = await Promise.all([
        db.query(`
            SELECT
                ta.ticket_id,
                a.id,
                a.asset_code,
                a.name,
                a.db_id,
                a.room,
                a.floor,
                a.spec_code
            FROM ticket_assets ta
            JOIN assets a ON a.id = ta.asset_id
            WHERE ta.ticket_id = ANY($1::int[])
            ORDER BY a.asset_code ASC
        `, [ticketIds]),
        db.query(`
            SELECT
                id,
                ticket_id,
                file_name,
                original_name,
                file_path,
                file_size,
                mime_type,
                created_at
            FROM ticket_attachments
            WHERE ticket_id = ANY($1::int[])
            ORDER BY created_at ASC, id ASC
        `, [ticketIds]),
    ]);

    const assetsByTicketId = new Map();
    const attachmentsByTicketId = new Map();

    for (const row of assetsResult.rows) {
        if (!assetsByTicketId.has(row.ticket_id)) {
            assetsByTicketId.set(row.ticket_id, []);
        }
        assetsByTicketId.get(row.ticket_id).push({
            id: row.id,
            assetCode: row.asset_code,
            name: row.name,
            dbId: row.db_id,
            room: row.room,
            floor: row.floor,
            specCode: row.spec_code,
        });
    }

    for (const row of attachmentsResult.rows) {
        if (!attachmentsByTicketId.has(row.ticket_id)) {
            attachmentsByTicketId.set(row.ticket_id, []);
        }
        attachmentsByTicketId.get(row.ticket_id).push({
            id: row.id,
            fileName: row.file_name,
            originalName: row.original_name,
            filePath: row.file_path,
            fileSize: Number(row.file_size || 0),
            mimeType: row.mime_type,
            createdAt: row.created_at,
        });
    }

    return tickets.map((ticket) => ({
        ...ticket,
        assets: assetsByTicketId.get(ticket.id) || [],
        attachments: attachmentsByTicketId.get(ticket.id) || [],
    }));
};

const mapTicketRow = (row) => ({
    id: row.id,
    uuid: row.uuid,
    facilityId: row.facility_id,
    fileId: row.file_id,
    ticketNo: row.ticket_no,
    title: row.title || '',
    description: row.description,
    priority: row.priority,
    status: row.status,
    sourceType: row.source_type,
    sourceSpaceCode: row.source_space_code,
    spaceName: row.space_name || '',
    spaceDbId: row.space_db_id,
    assigneeUserId: row.assignee_user_id,
    assigneeName: row.assignee_name || '',
    creatorUserId: row.created_by_user_id,
    creatorName: row.creator_name || '',
    fileTitle: row.file_title || '',
    completedAt: row.completed_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const getBaseTicketQuery = () => `
    SELECT
        t.*,
        s.name AS space_name,
        s.db_id AS space_db_id,
        mf.title AS file_title,
        assignee.name AS assignee_name,
        creator.name AS creator_name
    FROM tickets t
    JOIN spaces s
      ON s.file_id = t.file_id
     AND s.space_code = t.source_space_code
    JOIN model_files mf ON mf.id = t.file_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_user_id
    LEFT JOIN users creator ON creator.id = t.created_by_user_id
`;

const formatTicketNo = (id) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `WO-${yyyy}${mm}${dd}-${String(id).padStart(4, '0')}`;
};

async function resolveTicketScope(client, payload) {
    const facilityId = toPositiveInt(payload.facilityId, 'facilityId');
    const fileId = toPositiveInt(payload.fileId, 'fileId');
    const sourceSpaceCode = sanitizeString(payload.spaceCode);
    if (!sourceSpaceCode) {
        throw ApiError.badRequest('spaceCode 不能为空');
    }

    const spaceResult = await client.query(`
        SELECT
            s.id,
            s.space_code,
            s.name,
            s.db_id,
            s.file_id,
            mf.facility_id
        FROM spaces s
        JOIN model_files mf ON mf.id = s.file_id
        WHERE s.file_id = $1
          AND s.space_code = $2
          AND mf.facility_id = $3
        LIMIT 1
    `, [fileId, sourceSpaceCode, facilityId]);

    const space = spaceResult.rows[0];
    if (!space) {
        throw ApiError.badRequest('所选空间不存在或不属于当前设施');
    }

    const assetCodes = uniqueStrings(payload.assetCodes);
    if (assetCodes.length === 0) {
        return {
            facilityId,
            fileId,
            space,
            assets: [],
        };
    }

    const assetsResult = await client.query(`
        SELECT
            id,
            asset_code,
            name,
            room,
            floor,
            db_id
        FROM assets
        WHERE file_id = $1
          AND asset_code = ANY($2::text[])
        ORDER BY asset_code ASC
    `, [fileId, assetCodes]);

    if (assetsResult.rows.length !== assetCodes.length) {
        throw ApiError.badRequest('存在无效资产，无法创建工单');
    }

    const invalidAsset = assetsResult.rows.find((asset) => !assetBelongsToSpace(asset, space));

    if (invalidAsset) {
        throw ApiError.badRequest('同一张工单的资产必须属于同一空间');
    }

    return {
        facilityId,
        fileId,
        space,
        assets: assetsResult.rows,
    };
}

async function validateAssignee(client, assigneeUserId) {
    if (!assigneeUserId) {
        return null;
    }

    const parsed = toPositiveInt(assigneeUserId, 'assigneeUserId');
    const result = await client.query(`
        SELECT id
        FROM users
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
    `, [parsed]);

    if (result.rows.length === 0) {
        throw ApiError.badRequest('指派用户不存在或已禁用');
    }

    return parsed;
}

async function listTickets(filters = {}) {
    const values = [];
    const conditions = buildTicketWhere(filters, values);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(`
        ${getBaseTicketQuery()}
        ${whereClause}
        ORDER BY
            CASE t.status
                WHEN 'new' THEN 1
                WHEN 'completed' THEN 2
                ELSE 3
            END,
            t.created_at DESC,
            t.id DESC
    `, values);

    return hydrateTickets({ query }, result.rows.map(mapTicketRow));
}

async function getTicketById(id, db = { query }) {
    const ticketId = toPositiveInt(id, 'ticketId');
    const result = await db.query(`
        ${getBaseTicketQuery()}
        WHERE t.id = $1
        LIMIT 1
    `, [ticketId]);

    if (result.rows.length === 0) {
        return null;
    }

    const tickets = await hydrateTickets(db, result.rows.map(mapTicketRow));
    return tickets[0] || null;
}

async function createTicket(payload, files = [], currentUserId = null) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const scope = await resolveTicketScope(client, payload);
        const title = sanitizeString(payload.title);
        const description = sanitizeString(payload.description);
        const priority = ['low', 'medium', 'high'].includes(payload.priority) ? payload.priority : 'medium';
        const status = ['new', 'completed', 'closed'].includes(payload.status) ? payload.status : 'new';
        const assigneeUserId = await validateAssignee(client, payload.assigneeUserId);
        const timestamps = getStatusTimestamps(status);

        if (!description) {
            throw ApiError.badRequest('description 不能为空');
        }

        const creatorUserId = Number.isInteger(currentUserId) && currentUserId > 0 ? currentUserId : null;
        const sourceType = scope.assets.length > 0 ? 'asset' : 'space';
        const sequenceResult = await client.query(`
            SELECT nextval(pg_get_serial_sequence('tickets', 'id')) AS next_id
        `);
        const nextTicketId = Number(sequenceResult.rows[0].next_id);
        const ticketNo = formatTicketNo(nextTicketId);

        const insertResult = await client.query(`
            INSERT INTO tickets (
                id,
                facility_id,
                file_id,
                ticket_no,
                title,
                description,
                priority,
                status,
                source_type,
                source_space_code,
                assignee_user_id,
                created_by_user_id,
                completed_at,
                closed_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
            RETURNING id
        `, [
            nextTicketId,
            scope.facilityId,
            scope.fileId,
            ticketNo,
            title || null,
            description,
            priority,
            status,
            sourceType,
            scope.space.space_code,
            assigneeUserId,
            creatorUserId,
            timestamps.completedAt,
            timestamps.closedAt,
        ]);

        const ticketId = insertResult.rows[0].id;

        if (scope.assets.length > 0) {
            for (const asset of scope.assets) {
                await client.query(`
                    INSERT INTO ticket_assets (ticket_id, asset_id)
                    VALUES ($1, $2)
                `, [ticketId, asset.id]);
            }
        }

        if (files.length > 0) {
            for (const file of files) {
                await client.query(`
                    INSERT INTO ticket_attachments (
                        ticket_id,
                        file_name,
                        original_name,
                        file_path,
                        file_size,
                        mime_type
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    ticketId,
                    file.filename,
                    file.originalname,
                    `/files/tickets/${file.filename}`,
                    file.size,
                    file.mimetype,
                ]);
            }
        }

        await client.query('COMMIT');
        return getTicketById(ticketId);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function updateTicket(id, payload, files = []) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const ticketId = toPositiveInt(id, 'ticketId');
        const existing = await getTicketById(ticketId, client);
        if (!existing) {
            throw ApiError.notFound('工单不存在');
        }

        const scope = await resolveTicketScope(client, {
            facilityId: payload.facilityId ?? existing.facilityId,
            fileId: payload.fileId ?? existing.fileId,
            spaceCode: payload.spaceCode ?? existing.sourceSpaceCode,
            assetCodes: payload.assetCodes ?? existing.assets.map((asset) => asset.assetCode),
        });

        const title = payload.title !== undefined ? sanitizeString(payload.title) : existing.title;
        const description = payload.description !== undefined ? sanitizeString(payload.description) : existing.description;
        const priority = payload.priority !== undefined && ['low', 'medium', 'high'].includes(payload.priority)
            ? payload.priority
            : existing.priority;
        const status = payload.status !== undefined && ['new', 'completed', 'closed'].includes(payload.status)
            ? payload.status
            : existing.status;
        const assigneeUserId = payload.assigneeUserId !== undefined
            ? await validateAssignee(client, payload.assigneeUserId)
            : existing.assigneeUserId;
        const timestamps = getStatusTimestamps(status, {
            completed_at: existing.completedAt,
            closed_at: existing.closedAt,
        });

        if (!description) {
            throw ApiError.badRequest('description 不能为空');
        }

        await client.query(`
            UPDATE tickets
            SET
                facility_id = $2,
                file_id = $3,
                title = $4,
                description = $5,
                priority = $6,
                status = $7,
                source_type = $8,
                source_space_code = $9,
                assignee_user_id = $10,
                completed_at = $11,
                closed_at = $12
            WHERE id = $1
        `, [
            ticketId,
            scope.facilityId,
            scope.fileId,
            title || null,
            description,
            priority,
            status,
            scope.assets.length > 0 ? 'asset' : 'space',
            scope.space.space_code,
            assigneeUserId,
            timestamps.completedAt,
            timestamps.closedAt,
        ]);

        await client.query('DELETE FROM ticket_assets WHERE ticket_id = $1', [ticketId]);
        for (const asset of scope.assets) {
            await client.query(`
                INSERT INTO ticket_assets (ticket_id, asset_id)
                VALUES ($1, $2)
            `, [ticketId, asset.id]);
        }

        const keepAttachmentIds = (Array.isArray(payload.keepAttachmentIds) ? payload.keepAttachmentIds : [])
            .map((value) => Number.parseInt(value, 10))
            .filter((value) => Number.isInteger(value) && value > 0);

        const attachmentsResult = await client.query(`
            SELECT id, file_name
            FROM ticket_attachments
            WHERE ticket_id = $1
        `, [ticketId]);

        const attachmentsToDelete = attachmentsResult.rows.filter((attachment) => !keepAttachmentIds.includes(attachment.id));
        if (attachmentsToDelete.length > 0) {
            await client.query(`
                DELETE FROM ticket_attachments
                WHERE ticket_id = $1
                  AND id = ANY($2::int[])
            `, [ticketId, attachmentsToDelete.map((attachment) => attachment.id)]);
        }

        if (files.length > 0) {
            for (const file of files) {
                await client.query(`
                    INSERT INTO ticket_attachments (
                        ticket_id,
                        file_name,
                        original_name,
                        file_path,
                        file_size,
                        mime_type
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    ticketId,
                    file.filename,
                    file.originalname,
                    `/files/tickets/${file.filename}`,
                    file.size,
                    file.mimetype,
                ]);
            }
        }

        await client.query('COMMIT');

        for (const attachment of attachmentsToDelete) {
            await fs.unlink(filePathFromStoredName(attachment.file_name)).catch(() => {});
        }

        return getTicketById(ticketId);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

const filePathFromStoredName = (fileName) => {
    return path.join(__dirname, '../../public/files/tickets', fileName);
};

async function deleteTicket(id) {
    const client = await getClient();

    try {
        await client.query('BEGIN');
        const ticket = await getTicketById(id, client);
        if (!ticket) {
            throw ApiError.notFound('工单不存在');
        }

        const attachmentNames = ticket.attachments.map((attachment) => attachment.fileName);
        await client.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
        await client.query('COMMIT');

        for (const fileName of attachmentNames) {
            await fs.unlink(filePathFromStoredName(fileName)).catch(() => {});
        }

        return ticket;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function listAssignees() {
    const result = await query(`
        SELECT
            u.id,
            u.name,
            u.email,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT ur.role), NULL) AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.is_active = TRUE
        GROUP BY u.id
        ORDER BY u.name ASC, u.email ASC
    `);

    return result.rows
        .map((row) => ({
            id: row.id,
            name: row.name || row.email,
            email: row.email,
            roles: row.roles || [],
        }))
        .filter((row) => row.roles.length === 0 || row.roles.some((role) => ['admin', 'manager', 'editor'].includes(role)));
}

async function listMarkers({ facilityId, fileId }) {
    const values = [toPositiveInt(fileId, 'fileId')];
    let facilityCondition = '';
    if (facilityId) {
        values.push(toPositiveInt(facilityId, 'facilityId'));
        facilityCondition = ` AND t.facility_id = $${values.length}`;
    }

    const result = await query(`
        WITH marker_targets AS (
            SELECT
                t.id AS ticket_id,
                t.status,
                a.db_id AS target_db_id,
                'asset' AS target_type,
                a.asset_code AS asset_code,
                a.name AS asset_name,
                s.space_code AS space_code,
                s.name AS space_name
            FROM tickets t
            JOIN ticket_assets ta ON ta.ticket_id = t.id
            JOIN assets a ON a.id = ta.asset_id
            JOIN spaces s
              ON s.file_id = t.file_id
             AND s.space_code = t.source_space_code
            WHERE t.file_id = $1
            ${facilityCondition}

            UNION ALL

            SELECT
                t.id AS ticket_id,
                t.status,
                s.db_id AS target_db_id,
                'space' AS target_type,
                NULL AS asset_code,
                NULL AS asset_name,
                s.space_code AS space_code,
                s.name AS space_name
            FROM tickets t
            JOIN spaces s
              ON s.file_id = t.file_id
             AND s.space_code = t.source_space_code
            WHERE t.file_id = $1
              ${facilityCondition}
              AND NOT EXISTS (
                  SELECT 1
                  FROM ticket_assets ta_none
                  WHERE ta_none.ticket_id = t.id
              )
        )
        SELECT
            target_db_id,
            target_type,
            MAX(asset_code) AS asset_code,
            MAX(asset_name) AS asset_name,
            MAX(space_code) AS space_code,
            MAX(space_name) AS space_name,
            COUNT(DISTINCT ticket_id) AS ticket_count,
            ARRAY_AGG(DISTINCT ticket_id ORDER BY ticket_id) AS ticket_ids,
            ARRAY_AGG(DISTINCT status) AS statuses
        FROM marker_targets
        WHERE target_db_id IS NOT NULL
        GROUP BY target_db_id, target_type
        ORDER BY target_type ASC, target_db_id ASC
    `, values);

    return result.rows.map((row) => {
        const statuses = Array.isArray(row.statuses) ? row.statuses : [];
        const displayStatus = statuses
            .slice()
            .sort((left, right) => (STATUS_PRIORITY[right] || 0) - (STATUS_PRIORITY[left] || 0))[0] || 'closed';

        return {
            dbId: row.target_db_id,
            targetType: row.target_type,
            assetCode: row.asset_code,
            assetName: row.asset_name,
            spaceCode: row.space_code,
            spaceName: row.space_name,
            ticketCount: Number(row.ticket_count || 0),
            ticketIds: row.ticket_ids || [],
            statuses,
            displayStatus,
            label: row.asset_name || row.asset_code || row.space_name || row.space_code || `DB ${row.target_db_id}`,
        };
    });
}

export default {
    createTicket,
    deleteTicket,
    getTicketById,
    listAssignees,
    listMarkers,
    listTickets,
    updateTicket,
};
