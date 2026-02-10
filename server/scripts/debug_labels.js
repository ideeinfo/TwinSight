
import db from '../db/index.js';

async function checkLabels() {
    try {
        console.log('🔍 Checking Power Node Labels...');

        const query = `
            SELECT full_code, short_code, label 
            FROM rds_power_nodes 
            LIMIT 20
        `;
        const result = await db.query(query);

        console.table(result.rows);

        // Check for specific problematic nodes if possible (from screenshot)
        // e.g. nodes starting with ===DY1.AH1.H01
        console.log('\n🔍 Checking specific long-code nodes:');
        const longNodes = await db.query(`
            SELECT full_code, short_code, label 
            FROM rds_power_nodes 
            WHERE full_code LIKE '%DY1.AH1.H01%' 
            LIMIT 10
        `);
        console.table(longNodes.rows);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();
    }
}

checkLabels();
