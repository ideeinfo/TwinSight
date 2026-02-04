
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
            }

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
