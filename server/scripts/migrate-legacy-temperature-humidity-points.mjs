import { closePool, getClient } from '../db/index.js';

const args = new Map(
    process.argv.slice(2).map((arg) => {
        const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
        return [key, value];
    })
);

const dryRun = args.has('dry-run');
const fileId = args.get('file-id') ? Number.parseInt(args.get('file-id'), 10) : null;
const facilityId = args.get('facility-id') ? Number.parseInt(args.get('facility-id'), 10) : null;

const pointDefinitions = [
    {
        suffix: 'temperature',
        name: '温度',
        pointType: 'temperature',
        unit: '℃',
        thresholdMin: 10,
        thresholdMax: 30,
    },
    {
        suffix: 'humidity',
        name: '湿度',
        pointType: 'humidity',
        unit: '%',
        thresholdMin: 30,
        thresholdMax: 70,
    },
];

const client = await getClient();

try {
    const filters = ['s.space_code IS NOT NULL', "s.space_code <> ''"];
    const values = [];

    if (fileId) {
        values.push(fileId);
        filters.push(`s.file_id = $${values.length}`);
    }

    if (facilityId) {
        values.push(facilityId);
        filters.push(`mf.facility_id = $${values.length}`);
    }

    const spaces = await client.query(`
        SELECT
            s.file_id,
            s.space_code,
            COALESCE(NULLIF(s.name, ''), s.space_code) AS space_name,
            mf.facility_id
        FROM spaces s
        LEFT JOIN model_files mf ON mf.id = s.file_id
        WHERE ${filters.join(' AND ')}
        ORDER BY s.file_id, s.space_code
    `, values);

    let existing = 0;
    let created = 0;
    const candidates = [];

    for (const space of spaces.rows) {
        for (const definition of pointDefinitions) {
            candidates.push({
                facilityId: space.facility_id,
                fileId: space.file_id,
                pointCode: `legacy_${definition.suffix}_${space.space_code}`.replace(/\s+/g, '_'),
                name: `${space.space_name}${definition.name}`,
                pointType: definition.pointType,
                unit: definition.unit,
                targetCode: space.space_code,
                thresholdMin: definition.thresholdMin,
                thresholdMax: definition.thresholdMax,
                description: `由原温湿度连接自动转换的${definition.name}点位。`,
            });
        }
    }

    if (dryRun) {
        console.log(JSON.stringify({
            dryRun: true,
            spaces: spaces.rowCount,
            candidates: candidates.length,
            note: '未写入数据库',
        }, null, 2));
    } else {
        await client.query('BEGIN');
        for (const point of candidates) {
            const result = await client.query(`
                INSERT INTO points (
                    facility_id, file_id, point_code, name, point_type, data_kind,
                    target_type, target_code, unit, multiplier, protocol,
                    threshold_min, threshold_max, is_enabled, description
                )
                VALUES ($1, $2, $3, $4, $5, 'scalar', 'space', $6, $7, 1, 'legacy-timeseries', $8, $9, true, $10)
                ON CONFLICT (file_id, point_code) DO NOTHING
                RETURNING id
            `, [
                point.facilityId,
                point.fileId,
                point.pointCode,
                point.name,
                point.pointType,
                point.targetCode,
                point.unit,
                point.thresholdMin,
                point.thresholdMax,
                point.description,
            ]);

            if (result.rows.length > 0) {
                created += 1;
            } else {
                existing += 1;
            }
        }
        await client.query('COMMIT');
        console.log(JSON.stringify({
            dryRun: false,
            spaces: spaces.rowCount,
            candidates: candidates.length,
            created,
            existing,
        }, null, 2));
    }
} catch (error) {
    if (!dryRun) {
        await client.query('ROLLBACK').catch(() => {});
    }
    console.error(error);
    process.exitCode = 1;
} finally {
    client.release();
    await closePool();
}
