
import pool, { closePool } from '../db/index.js';

async function debugData() {
    try {
        console.log('Connecting to DB...');
        const client = await pool.connect();
        try {
            // Find objects with name "AH5柜出线"
            console.log('Searching for objects with name "AH5柜出线"...');
            const resObjects = await client.query(`
                SELECT id, name, mc_code, ref_code, object_type, file_id 
                FROM rds_objects 
                WHERE name LIKE '%AH5柜出线%'
            `);

            console.log(`Found ${resObjects.rowCount} objects:`);
            console.table(resObjects.rows);

            if (resObjects.rowCount > 0) {
                const objectIds = resObjects.rows.map(r => r.id);

                // Find aspects for these objects
                console.log(`Searching for aspects for object IDs: ${objectIds.join(', ')}...`);
                const resAspects = await client.query(`
                    SELECT object_id, aspect_type, full_code, parent_code, hierarchy_level 
                    FROM rds_aspects 
                    WHERE object_id = ANY($1)
                    ORDER BY object_id, full_code
                `, [objectIds]);

                console.log(`Found ${resAspects.rowCount} aspects:`);
                console.table(resAspects.rows);
            } else {
                console.log('No objects found with name "AH5柜出线"');
            }

            // --- Investigate Missing Parent ---
            console.log('\n--- Investigating Missing Parent "10KV出线1 AH5" / Code "===OY1.AH1" ---');

            // Search by Name
            const resParentName = await client.query(`SELECT * FROM rds_objects WHERE name LIKE '%10KV出线1 AH5%'`);
            console.log(`Objects named "10KV出线1 AH5": ${resParentName.rowCount}`);
            if (resParentName.rowCount > 0) console.table(resParentName.rows);

            // Search by Code in Aspects
            const resParentCode = await client.query(`
                SELECT a.*, o.name as object_name 
                FROM rds_aspects a
                LEFT JOIN rds_objects o ON a.object_id = o.id
                WHERE a.full_code LIKE '%===OY1.AH1%'
            `);
            // --- Investigate Power Tree Collisions ---
            console.log('\n--- Investigating Power Tree Collisions (10KV, 1回路, AH2) ---');

            // Search for objects by name pattern
            const resPowerObjs = await client.query(`
                SELECT id, name, file_id 
                FROM rds_objects 
                WHERE name LIKE '%10KV%AH1%' OR name LIKE '%1回路%AH1%' OR name LIKE '%AH2柜出线%'
            `);
            console.table(resPowerObjs.rows);

            const pIds = resPowerObjs.rows.map(r => r.id);
            if (pIds.length > 0) {
                const resPowerAspects = await client.query(`
                    SELECT object_id, aspect_type, full_code, parent_code 
                    FROM rds_aspects 
                    WHERE object_id = ANY($1) AND aspect_type = 'power'
                    ORDER BY full_code
                `, [pIds]);
                console.table(resPowerAspects.rows);

                // Check if multiple objects claim the same full_code?
                const codeCounts = {};
                resPowerAspects.rows.forEach(r => {
                    codeCounts[r.full_code] = (codeCounts[r.full_code] || 0) + 1;
                });
                console.log('Duplicate Codes:', Object.entries(codeCounts).filter(([k, v]) => v > 1));
            }
            // Same as before just ensure proper closure
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await closePool();
    }
}



debugData();
