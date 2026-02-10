
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

console.log('DB Host:', process.env.DB_HOST); // Debug

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Beginning migration: Adding mc_code column...');

        // Add mc_code column
        await client.query(`
      ALTER TABLE rds_objects 
      ADD COLUMN IF NOT EXISTS mc_code VARCHAR(255);
    `);

        // Add index
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rds_objects_mc_code ON rds_objects(mc_code);
    `);

        console.log('Migration successful: mc_code column added.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
