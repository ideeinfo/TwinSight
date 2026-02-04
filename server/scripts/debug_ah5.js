
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
            console.log(`Aspects matching "%===OY1.AH1%": ${resParentCode.rowCount}`);
            console.table(resParentCode.rows);


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
