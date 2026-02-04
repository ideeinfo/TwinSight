import { query, closePool } from './db/index.js';

async function runDebug() {
    try {
        console.log('🔍 Starting DB Debug...');

        // 1. Check total counts
        const countRes = await query('SELECT count(*) FROM asset_specs');
        console.log(`📊 Total asset_specs: ${countRes.rows[0].count}`);

        // 2. Check specs with file_id
        const fileIdRes = await query('SELECT count(*) FROM asset_specs WHERE file_id IS NOT NULL');
        console.log(`📊 Asset specs with file_id: ${fileIdRes.rows[0].count}`);

        // 3. Check specs sample
        const sampleRes = await query('SELECT spec_code, spec_name, file_id, classification_code FROM asset_specs LIMIT 5');
        console.log('📋 Sample asset_specs:', sampleRes.rows);

        // 4. Check for mismatches: Assets with spec_code but no matching spec
        // Note: This query checks assuming we join on spec_code AND file_id (which is what getAssetsByFileId does)

        // First, find a valid file_id from assets
        const fileIdsRes = await query('SELECT DISTINCT file_id FROM assets LIMIT 5');
        console.log('📂 File IDs in assets table:', fileIdsRes.rows.map(r => r.file_id));

        if (fileIdsRes.rows.length > 0) {
            const fid = fileIdsRes.rows[0].file_id;
            console.log(`🔬 Testing JOIN for file_id: ${fid}`);

            // Count assets for this file
            const assetCount = await query('SELECT count(*) FROM assets WHERE file_id = $1', [fid]);
            console.log(`  Assets in file ${fid}: ${assetCount.rows[0].count}`);

            // Count assets that successfully join with specs using file_id
            const joinCount = await query(`
        SELECT count(*) 
        FROM assets a 
        JOIN asset_specs s ON a.spec_code = s.spec_code AND a.file_id = s.file_id
        WHERE a.file_id = $1
      `, [fid]);

            console.log(`  Assets with matching specs (using file_id AND spec_code): ${joinCount.rows[0].count}`);

            // Count assets that join ONLY on spec_code (ignoring file_id)
            // 5. Check for valid data
            const validDataCount = await query("SELECT count(*) FROM asset_specs WHERE spec_name != '' OR classification_code IS NOT NULL");
            console.log(`📊 Specs with valid name or classification: ${validDataCount.rows[0].count}`);

            const validSamples = await query("SELECT * FROM asset_specs WHERE spec_name != '' LIMIT 5");
            console.log('📋 Valid Spec Samples:', validSamples.rows);
            const joinSpecOnlyCount = await query(`
        SELECT count(*) 
        FROM assets a 
        JOIN asset_specs s ON a.spec_code = s.spec_code
        WHERE a.file_id = $1
      `, [fid]);

            console.log(`  Assets with matching specs (spec_code ONLY): ${joinSpecOnlyCount.rows[0].count}`);
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await closePool();
    }
}

runDebug();
