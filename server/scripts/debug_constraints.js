
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

async function checkConstraints() {
    try {
        console.log('🔍 Checking constraints for table: classifications');
        const res = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c 
            JOIN pg_namespace n ON n.oid = c.connamespace 
            WHERE n.nspname = 'public'
            AND c.conrelid::regclass::text = 'classifications';
        `);
        console.table(res.rows);

        console.log('\n🔍 Checking constraints for table: assets');
        const res2 = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c 
            JOIN pg_namespace n ON n.oid = c.connamespace 
            WHERE n.nspname = 'public'
            AND c.conrelid::regclass::text = 'assets';
        `);
        console.table(res2.rows);

        console.log('\n🔍 Checking constraints for table: asset_specs');
        const res3 = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c 
            JOIN pg_namespace n ON n.oid = c.connamespace 
            WHERE n.nspname = 'public'
            AND c.conrelid::regclass::text = 'asset_specs';
        `);
        console.table(res3.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkConstraints();
