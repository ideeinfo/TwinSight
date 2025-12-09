
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tandem',
});

async function fixConstraints() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing missing unique constraints...');

        await client.query('BEGIN');

        // 1. Assets
        console.log('Checked assets table...');
        await client.query(`
            ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_file_asset_unique;
            ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_code_key CASCADE;
            ALTER TABLE assets ADD CONSTRAINT assets_file_asset_unique UNIQUE (file_id, asset_code);
        `);

        // 2. Asset Specs
        console.log('Checked asset_specs table...');
        await client.query(`
            ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS specs_file_spec_unique;
            ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS asset_specs_spec_code_key CASCADE;
            ALTER TABLE asset_specs ADD CONSTRAINT specs_file_spec_unique UNIQUE (file_id, spec_code);
        `);

        // 3. Spacess
        console.log('Checked spaces table...');
        await client.query(`
            ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_file_space_unique;
            ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_space_code_key CASCADE;
            ALTER TABLE spaces ADD CONSTRAINT spaces_file_space_unique UNIQUE (file_id, space_code);
        `);

        // 4. Classifications (Re-ensure)
        console.log('Checked classifications table...');
        // Note: We already saw this exists, but let's be safe.
        // BUT wait, in classification.js I just removed ON CONFLICT.
        // So adding constraint here doesn't hurt, but won't be used by code unless I revert code.
        // Actually, having the constraint is good for data integrity even if code just INSERTS (and fails on specific duplicates).
        await client.query(`
            ALTER TABLE classifications DROP CONSTRAINT IF EXISTS class_file_code_unique;
            ALTER TABLE classifications DROP CONSTRAINT IF EXISTS classifications_classification_code_key CASCADE;
            ALTER TABLE classifications ADD CONSTRAINT class_file_code_unique UNIQUE (file_id, classification_code);
        `);


        await client.query('COMMIT');
        console.log('✅ All constraints fixed and re-applied.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Failed to fix constraints:', error);
        if (error.code === '23505') {
            console.error('⚠️ Duplicate keys found. You must clean the data first.');
            console.error('   Try running: DELETE FROM assets; DELETE FROM spaces; ...');
            // Auto-clean duplicates if requested? Users often want this fixed.
            // But let's see.
        }
    } finally {
        client.release();
        await pool.end();
    }
}

fixConstraints();
