import { getClient, closePool } from '../db/index.js';

const TARGET = {
    facilityId: 10,
    fileId: 30,
    creatorUserId: 1,
    seedTag: 'zhangyuan-demo-20260612',
};

const SPECS = [
    {
        spaceCode: '1387',
        title: '空调机房1387巡检噪声偏高',
        description: '夜间巡检时发现空调机房1387存在持续性嗡鸣，靠近送风侧更明显，建议检查风机盘管与风管连接件的振动传递情况。',
        priority: 'high',
        status: 'new',
        assigneeUserId: 1,
        createdAt: '2026-04-18T09:20:00+08:00',
    },
    {
        spaceCode: '1387',
        title: '空调机房1387送风不均复核',
        description: '机房1387内局部区域送风偏弱，现场温差较明显，需复核风口风量平衡并确认回风侧是否存在遮挡。',
        priority: 'medium',
        status: 'completed',
        assigneeUserId: 3,
        createdAt: '2026-04-22T14:10:00+08:00',
        completedAt: '2026-04-24T11:45:00+08:00',
    },
    {
        spaceCode: '1403',
        title: '空调机房1403管线凝露复查',
        description: '上周巡检记录显示空调机房1403冷媒与给排水交汇区域有轻微凝露，本次工单用于复查保温层修补后的实际效果。',
        priority: 'high',
        status: 'closed',
        assigneeUserId: 1,
        createdAt: '2026-04-27T10:00:00+08:00',
        completedAt: '2026-04-29T15:20:00+08:00',
        closedAt: '2026-05-01T09:30:00+08:00',
    },
    {
        spaceCode: '1400',
        title: '空调机房1400检修通道积水排查',
        description: '空调机房1400检修通道地面有零星积水痕迹，需排查是否为冷凝水外溢或管件微渗造成。',
        priority: 'high',
        status: 'new',
        assigneeUserId: 3,
        createdAt: '2026-05-03T08:35:00+08:00',
    },
    {
        spaceCode: '1378',
        title: '空调机房1378排风能力下降',
        description: '空调机房1378在高负载时闷热感增强，排风效果较弱，需检查排风扇、风管及风口联动状态。',
        priority: 'medium',
        status: 'completed',
        assigneeUserId: 1,
        createdAt: '2026-05-08T13:25:00+08:00',
        completedAt: '2026-05-10T16:10:00+08:00',
    },
    {
        spaceCode: '1334',
        title: '空调机房1334送风端积尘清理',
        description: '空调机房1334多个送风端表面积尘较重，已影响出风均匀性，安排一次集中清理和风量复核。',
        priority: 'low',
        status: 'closed',
        assigneeUserId: 3,
        createdAt: '2026-05-12T09:00:00+08:00',
        completedAt: '2026-05-13T17:40:00+08:00',
        closedAt: '2026-05-15T10:15:00+08:00',
    },
    {
        spaceCode: '1393',
        title: '空调机房1393照明闪烁排查',
        description: '机房1393值守人员反馈照明偶发闪烁，需排查回路接触情况并确认是否与设备启停产生的瞬时负载有关。',
        priority: 'medium',
        status: 'new',
        assigneeUserId: 1,
        createdAt: '2026-05-18T19:10:00+08:00',
    },
    {
        spaceCode: '1396',
        title: '空调机房1396温湿度波动巡检',
        description: '近一周监测显示空调机房1396温湿度波动偏大，需现场核实送回风组织和管道保温完整性。',
        priority: 'medium',
        status: 'completed',
        assigneeUserId: 3,
        createdAt: '2026-05-21T10:50:00+08:00',
        completedAt: '2026-05-24T15:05:00+08:00',
    },
    {
        spaceCode: '1387',
        assetCode: '标准 [20320888]',
        title: '风机盘管异响排查',
        description: '空调机房1387内卧式暗装风机盘管带回风_左接管运行时存在高频异响，需检查叶轮积尘、固定件松动及回风段共振。',
        priority: 'high',
        status: 'new',
        assigneeUserId: 1,
        createdAt: '2026-05-25T09:40:00+08:00',
    },
    {
        spaceCode: '1387',
        assetCode: '标准 [20320898]',
        title: '百叶风口风量不足',
        description: '空调机房1387单层百叶风口出风偏弱，现场可见局部积尘和叶片角度不一致，建议拆检并重新校正。',
        priority: 'medium',
        status: 'completed',
        assigneeUserId: 3,
        createdAt: '2026-05-27T14:15:00+08:00',
        completedAt: '2026-05-28T18:20:00+08:00',
    },
    {
        spaceCode: '1387',
        assetCode: 'FM甲1022\' [19956717]',
        title: '防火门闭门器回弹异常',
        description: '空调机房1387单嵌板钢防火门闭门器回弹偏快，关门末段存在冲击，需调整回位阻尼并复核闭锁状态。',
        priority: 'high',
        status: 'closed',
        assigneeUserId: 1,
        createdAt: '2026-05-29T08:30:00+08:00',
        completedAt: '2026-05-30T16:50:00+08:00',
        closedAt: '2026-06-01T09:05:00+08:00',
    },
    {
        spaceCode: '1387',
        assetCode: 'LC1536 [19919154]',
        title: '固定窗密封胶老化检查',
        description: '空调机房1387固定窗边缘密封胶有老化发硬迹象，雨季前建议补胶并确认框边无渗水点。',
        priority: 'low',
        status: 'new',
        assigneeUserId: 3,
        createdAt: '2026-06-02T11:25:00+08:00',
    },
    {
        spaceCode: '1380',
        assetCode: 'EL弱电-安防桥架 [20320465]',
        title: '弱电桥架支吊架松动',
        description: '空调机房1380安防桥架水平弯通处支吊架有轻微晃动，需复紧连接件并检查桥架转角受力是否均衡。',
        priority: 'medium',
        status: 'completed',
        assigneeUserId: 1,
        createdAt: '2026-06-03T15:00:00+08:00',
        completedAt: '2026-06-05T12:40:00+08:00',
    },
    {
        spaceCode: '1380',
        assetCode: 'HW-内外热镀锌钢管-卡箍 [20320490]',
        title: '给水管卡箍渗水复检',
        description: '空调机房1380镀锌钢管卡箍连接位附近发现返潮痕迹，需复检卡箍压紧情况并确认是否仍有慢渗。',
        priority: 'high',
        status: 'new',
        assigneeUserId: 3,
        createdAt: '2026-06-04T09:15:00+08:00',
    },
    {
        spaceCode: '1403',
        assetCode: 'FM甲1220 [19958482]',
        title: '机房防火门门缝偏大',
        description: '空调机房1403双嵌板钢防火门门缝偏大，闭合后密封性不足，建议调整合页并复核五金件磨损。',
        priority: 'high',
        status: 'completed',
        assigneeUserId: 1,
        createdAt: '2026-06-05T17:30:00+08:00',
        completedAt: '2026-06-06T13:10:00+08:00',
    },
    {
        spaceCode: '1403',
        assetCode: '镀锌钢管、无缝钢管 [20321408]',
        title: '冷冻水管保温破损修补',
        description: '空调机房1403一段镀锌钢管外保温层开裂，局部表面已有凝露，需补齐保温并固定收边。',
        priority: 'high',
        status: 'closed',
        assigneeUserId: 3,
        createdAt: '2026-06-06T08:45:00+08:00',
        completedAt: '2026-06-07T15:30:00+08:00',
        closedAt: '2026-06-08T10:20:00+08:00',
    },
    {
        spaceCode: '1400',
        assetCode: 'LC1628 [20170317]',
        title: '观察窗结露处理',
        description: '空调机房1400固定窗内侧在早晚温差较大时出现结露，需检查密封与邻近送风口风向是否直吹窗面。',
        priority: 'medium',
        status: 'new',
        assigneeUserId: 1,
        createdAt: '2026-06-08T16:05:00+08:00',
    },
    {
        spaceCode: '1400',
        assetCode: '镀锌钢管、无缝钢管 [20321282]',
        title: '管道标识脱落补标',
        description: '空调机房1400一处镀锌钢管介质流向标识脱落，影响巡检识别，需补做标签并复核相邻管段标识完整性。',
        priority: 'low',
        status: 'completed',
        assigneeUserId: 3,
        createdAt: '2026-06-09T09:30:00+08:00',
        completedAt: '2026-06-10T17:55:00+08:00',
    },
    {
        spaceCode: '1378',
        assetCode: 'P-250 [20321744]',
        title: '排风扇振动偏大',
        description: '空调机房1378排风扇运行时机壳振动明显，需检查叶轮平衡、安装底座和减振连接件状态。',
        priority: 'high',
        status: 'new',
        assigneeUserId: 1,
        createdAt: '2026-06-10T13:40:00+08:00',
    },
    {
        spaceCode: '1334',
        assetCode: '标准 [20318681]',
        title: '方形风口固定螺丝缺失',
        description: '空调机房1334方形风口边框一侧固定螺丝缺失，面板贴合不紧，需补装并校正出风角度。',
        priority: 'medium',
        status: 'closed',
        assigneeUserId: 3,
        createdAt: '2026-06-11T08:20:00+08:00',
        completedAt: '2026-06-11T15:10:00+08:00',
        closedAt: '2026-06-12T09:00:00+08:00',
    },
];

const formatTicketNo = (id) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `WO-${yyyy}${mm}${dd}-${String(id).padStart(4, '0')}`;
};

const toDate = (value) => (value ? new Date(value) : null);

const resolveUpdatedAt = (spec) => {
    return toDate(spec.closedAt)
        || toDate(spec.completedAt)
        || new Date(new Date(spec.createdAt).getTime() + 4 * 60 * 60 * 1000);
};

async function main() {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const modelResult = await client.query(`
            SELECT id, facility_id, title
            FROM model_files
            WHERE id = $1
            LIMIT 1
        `, [TARGET.fileId]);

        const model = modelResult.rows[0];
        if (!model || Number(model.facility_id) !== TARGET.facilityId) {
            throw new Error(`目标模型不存在，或 file_id=${TARGET.fileId} 不属于 facility_id=${TARGET.facilityId}`);
        }

        const spaceCodes = [...new Set(SPECS.map((spec) => spec.spaceCode))];
        const assetCodes = [...new Set(SPECS.map((spec) => spec.assetCode).filter(Boolean))];

        const spacesResult = await client.query(`
            SELECT id, space_code, name, db_id
            FROM spaces
            WHERE file_id = $1
              AND space_code = ANY($2::text[])
        `, [TARGET.fileId, spaceCodes]);
        const spacesByCode = new Map(spacesResult.rows.map((row) => [row.space_code, row]));

        if (spacesByCode.size !== spaceCodes.length) {
            const missing = spaceCodes.filter((code) => !spacesByCode.has(code));
            throw new Error(`缺少空间数据: ${missing.join(', ')}`);
        }

        const assetsByCode = new Map();
        if (assetCodes.length > 0) {
            const assetsResult = await client.query(`
                SELECT id, asset_code, name, room, db_id
                FROM assets
                WHERE file_id = $1
                  AND asset_code = ANY($2::text[])
            `, [TARGET.fileId, assetCodes]);

            assetsResult.rows.forEach((row) => {
                assetsByCode.set(row.asset_code, row);
            });

            if (assetsByCode.size !== assetCodes.length) {
                const missing = assetCodes.filter((code) => !assetsByCode.has(code));
                throw new Error(`缺少资产数据: ${missing.join(', ')}`);
            }
        }

        await client.query(`
            DELETE FROM tickets
            WHERE facility_id = $1
              AND file_id = $2
        `, [TARGET.facilityId, TARGET.fileId]);

        for (const spec of SPECS) {
            const space = spacesByCode.get(spec.spaceCode);
            const asset = spec.assetCode ? assetsByCode.get(spec.assetCode) : null;

            if (asset && !String(asset.room || '').includes(spec.spaceCode)) {
                throw new Error(`资产 ${spec.assetCode} 与空间 ${spec.spaceCode} 不匹配`);
            }

            const nextIdResult = await client.query(`
                SELECT nextval(pg_get_serial_sequence('tickets', 'id')) AS next_id
            `);
            const nextId = Number(nextIdResult.rows[0].next_id);

            await client.query(`
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
                    closed_at,
                    metadata,
                    created_at,
                    updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17
                )
            `, [
                nextId,
                TARGET.facilityId,
                TARGET.fileId,
                formatTicketNo(nextId),
                spec.title,
                spec.description,
                spec.priority,
                spec.status,
                asset ? 'asset' : 'space',
                space.space_code,
                spec.assigneeUserId,
                TARGET.creatorUserId,
                toDate(spec.completedAt),
                toDate(spec.closedAt),
                JSON.stringify({
                    demo: true,
                    seedTag: TARGET.seedTag,
                    seededAt: new Date().toISOString(),
                    sourceSpaceName: space.name,
                    sourceAssetName: asset?.name || null,
                }),
                toDate(spec.createdAt),
                resolveUpdatedAt(spec),
            ]);

            if (asset) {
                await client.query(`
                    INSERT INTO ticket_assets (ticket_id, asset_id)
                    VALUES ($1, $2)
                `, [nextId, asset.id]);
            }
        }

        await client.query('COMMIT');
        console.log(`已为 ${model.title} 重建 ${SPECS.length} 条示例工单`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await closePool();
    }
}

main().catch((error) => {
    console.error('生成示例工单失败:', error);
    process.exitCode = 1;
});
