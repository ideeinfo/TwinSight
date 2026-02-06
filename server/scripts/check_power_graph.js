/**
 * 检查电源图数据结构
 */
import db from '../db/index.js';

async function main() {
    try {
        // 查询 file_id 分布
        const fileResult = await db.query(`
            SELECT file_id, COUNT(*) as cnt 
            FROM rds_power_nodes 
            GROUP BY file_id
            ORDER BY file_id
        `);
        console.log('=== 电源图节点按 file_id 分布 ===');
        fileResult.rows.forEach(r => console.log(`  file_id=${r.file_id}: ${r.cnt} 节点`));

        if (fileResult.rows.length === 0) {
            console.log('  (无数据)');
            process.exit(0);
        }

        // 找最大的 file_id
        const targetFileId = fileResult.rows[fileResult.rows.length - 1].file_id;
        console.log(`\n使用 file_id = ${targetFileId} 进行分析\n`);

        // 查询水泵相关节点
        const nodeResult = await db.query(`
            SELECT id, full_code, short_code, parent_code, label, level, node_type, object_id
            FROM rds_power_nodes 
            WHERE file_id = $1 
              AND (label ILIKE '%水泵%' OR full_code LIKE '%DP9O.1.1%')
            ORDER BY full_code
        `, [targetFileId]);

        console.log('=== 水泵相关节点 ===');
        nodeResult.rows.forEach(n => {
            console.log(`ID: ${n.id.substring(0, 12)}...`);
            console.log(`  Label: ${n.label}`);
            console.log(`  FullCode: ${n.full_code}`);
            console.log(`  ParentCode: ${n.parent_code || '(无)'}`);
            console.log(`  Level: ${n.level}, Type: ${n.node_type}`);
            console.log(`  ObjectId: ${n.object_id || '(无)'}`);
            console.log();
        });

        // 查询这些节点相关的边
        const nodeIds = nodeResult.rows.map(n => n.id);
        if (nodeIds.length > 0) {
            const edgeResult = await db.query(`
                SELECT e.source_node_id, e.target_node_id, e.relation_type,
                       s.label as source_label, s.full_code as source_code,
                       t.label as target_label, t.full_code as target_code
                FROM rds_power_edges e
                LEFT JOIN rds_power_nodes s ON e.source_node_id = s.id
                LEFT JOIN rds_power_nodes t ON e.target_node_id = t.id
                WHERE e.file_id = $1
                  AND (e.source_node_id = ANY($2) OR e.target_node_id = ANY($2))
            `, [targetFileId, nodeIds]);

            console.log('=== 相关边 ===');
            edgeResult.rows.forEach(e => {
                console.log(`${e.source_label || e.source_code} -> ${e.target_label || e.target_code} [${e.relation_type}]`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

main();
