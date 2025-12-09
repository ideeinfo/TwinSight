
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correct path to .env.local (root of workspace)
const envPath = path.join(__dirname, '../../.env.local');
console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password', // Fallback to 'password' which seems correct from inspection
    database: process.env.DB_NAME || 'tandem',
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔄 开始执行 add-file-id.sql 迁移...');

        const sqlPath = path.join(__dirname, '../db/migrations/add-file-id.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 SQL 内容长度:', sql.length);

        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('✅ 迁移成功！file_id 字段已添加到所有表。');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
