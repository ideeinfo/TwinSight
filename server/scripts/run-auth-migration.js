const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    // 优先使用 DATABASE_URL (Railway 标准), 否则使用本地 .env 配置
    const connectionString = process.env.DATABASE_URL ||
        `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

    console.log('Connecting to database...');

    const pool = new Pool({
        connectionString,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });

    try {
        const sqlPath = path.join(__dirname, '../db/migrations/create-auth-tables.sql');
        console.log(`Reading SQL file from: ${sqlPath}`);

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing migration...');
        await pool.query(sql);

        console.log('✅ Migration completed successfully!');
        console.log('Auth tables created/verified.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
