import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'tandem',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
});
console.log('Connecting with DB_PASSWORD length:', process.env.DB_PASSWORD.length);
pool.query('SELECT 1 as val').then(res => {
    console.log('Connected! Result:', res.rows);
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
