
import db from '../db/index.js';

async function checkPowerTables() {
    try {
        console.log('🔍 Checking Power Graph Tables...');

        // 1. Check total counts
        const nodesCount = await db.query('SELECT COUNT(*) FROM rds_power_nodes');
        const edgesCount = await db.query('SELECT COUNT(*) FROM rds_power_edges');

        console.log(`\n📊 Total Counts:`);
        console.log(`- rds_power_nodes: ${nodesCount.rows[0].count}`);
        console.log(`- rds_power_edges: ${edgesCount.rows[0].count}`);remote: Enumerating objects: 9, done.
remote: Counting objects: 100% (9/9), done.
remote: Compressing objects: 100% (1/1), done.
remote: Total 5 (delta 4), reused 5 (delta 4), pack-reused 0 (from 0)
Unpacking objects: 100% (5/5), 478 bytes | 239.00 KiB/s, done.
From https://github.com/ideeinfo/TwinSight
 * branch            rds        -> FETCH_HEAD
   fbc61a6..6e2eaaa  rds        -> origin/rds
Updating fbc61a6..6e2eaaa
Fast-forward
 server/db/index.js | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
diwei@XPS:/opt/twinsight/server$ node scripts/check_power_tables.js
📦 使用独立环境变量连接 PostgreSQL
🔍 Checking Power Graph Tables...

📊 Total Counts:
- rds_power_nodes: 242
- rds_power_edges: 240

📂 Node Counts by File ID:
- File ID 6: 242 nodes

👀 Sample Nodes (Top 5):
┌─────────┬────────────────────────────┬─────────┬───────────┬───────┐
│ (index) │         full_code          │  label  │ node_type │ level │
├─────────┼────────────────────────────┼─────────┼───────────┼───────┤
│    0    │          '===DY1'          │  'DY1'  │ 'source'  │   1   │
│    1    │        '===DY1.AH1'        │  'AH1'  │   'bus'   │   2   │
│    2    │      '===DY1.AH1.H01'      │  'H01'  │ 'feeder'  │   3   │
│    3    │    '===DY1.AH1.H01.ZB1'    │  'ZB1'  │ 'feeder'  │   4   │
│    4    │ '===DY1.AH1.H01.ZB1.C1DP1' │ 'C1DP1' │ 'feeder'  │   5   │
└─────────┴────────────────────────────┴─────────┴───────────┴───────┘
diwei@XPS:/opt/twinsight/server$ 

        if (parseInt(nodesCount.rows[0].count) === 0) {
            console.warn('\n⚠️ Tables are empty! Import process might have failed to populate them.');
            process.exit(0);
        }

        // 2. Check by File ID
        const fileCounts = await db.query(`
            SELECT file_id, COUNT(*) as count 
            FROM rds_power_nodes 
            GROUP BY file_id
        `);

        console.log(`\n📂 Node Counts by File ID:`);
        fileCounts.rows.forEach(row => {
            console.log(`- File ID ${row.file_id}: ${row.count} nodes`);
        });

        // 3. Sample Data
        console.log(`\n👀 Sample Nodes (Top 5):`);
        const sampleNodes = await db.query(`
            SELECT full_code, label, node_type, level 
            FROM rds_power_nodes 
            LIMIT 5
        `);
        console.table(sampleNodes.rows);

    } catch (err) {
        console.error('❌ Error checking tables:', err);
    } finally {
        process.exit();
    }
}

checkPowerTables();
