
import db from '../db/index.js';

async function checkPowerTables() {
    try {
        console.log('🔍 Checking Power Graph Tables...');

        // 1. Check total counts
        const nodesCount = await db.query('SELECT COUNT(*) FROM rds_power_nodes');
        const edgesCount = await db.query('SELECT COUNT(*) FROM rds_power_edges');

        console.log(`\n📊 Total Counts:`);
        console.log(`- rds_power_nodes: ${nodesCount.rows[0].count}`);
        console.log(`- rds_power_edges: ${edgesCount.rows[0].count}`);

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
