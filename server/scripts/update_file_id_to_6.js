
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../../.env.local');
console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tandem',
});

async function updateFileIds() {
    const client = await pool.connect();
    try {
        console.log('🔄 Setting file_id to 6 for all tables...');

        await client.query('BEGIN');

        // Disable triggers to avoid unnecessary timestamp updates if desired, but here we just update directly

        // 1. classifications
        const res1 = await client.query('UPDATE classifications SET file_id = 6 WHERE file_id IS NULL OR file_id != 6');
        console.log(`✅ Updated ${res1.rowCount} rows in classifications`);

        // 2. asset_specs
        const res2 = await client.query('UPDATE asset_specs SET file_id = 6 WHERE file_id IS NULL OR file_id != 6');
        console.log(`✅ Updated ${res2.rowCount} rows in asset_specs`);

        // 3. assets
        const res3 = await client.query('UPDATE assets SET file_id = 6 WHERE file_id IS NULL OR file_id != 6');
        console.log(`✅ Updated ${res3.rowCount} rows in assets`);

        // 4. spaces
        const res4 = await client.query('UPDATE spaces SET file_id = 6 WHERE file_id IS NULL OR file_id != 6');
        console.log(`✅ Updated ${res4.rowCount} rows in spaces`);

        await client.query('COMMIT');
        console.log('🎉 All updates completed successfully.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Update failed:', error);
        // Specialized error handling for unique constraint violations
        if (error.code === '23505') {
            console.error('⚠️ Unique constraint violation! You likely have duplicates that would conflict if they all became file_id=6.');
            console.error('   Consider clearing the table first or manually resolving duplicates.');
        }
    } finally {
        client.release();
        await pool.end();
    }
}

updateFileIds();
