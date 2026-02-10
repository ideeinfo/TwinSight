
import db from '../db/index.js';

async function checkLabels() {
    try {
        console.log('🔍 Checking Logic for Label = FullCode ...');

        // 1. Check if any label is exactly the full_code (length > 20 to avoid false positives on short roots)
        const suspiciousNodes = await db.query(`
            SELECT full_code, label, short_code 
            FROM rds_power_nodes 
            WHERE label = full_code AND LENGTH(full_code) > 10
            LIMIT 10
        `);

        if (suspiciousNodes.rows.length > 0) {
            console.warn('⚠️ Found nodes where label EQUALS full_code:');
            console.table(suspiciousNodes.rows);
        } else {
            console.log('✅ No nodes found with label == full_code (for long codes).');
        }

        // 2. Check specific node from screenshot
        // ===DY1.AH1.H01.ZB1.C1DP1.3.DP30.1.N5 (approximate)
        console.log('\n🔍 Check specific hierarchy path:');
        const specificNodes = await db.query(`
            SELECT full_code, label, short_code, node_type
            FROM rds_power_nodes 
            WHERE full_code LIKE '===DY1.AH1.H01.ZB1.C1DP1.3%' 
            ORDER BY length(full_code)
            LIMIT 10
        `);
        console.table(specificNodes.rows);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();
    }
}

checkLabels();
