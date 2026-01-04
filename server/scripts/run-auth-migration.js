import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;

// 获取 __dirname 的替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const isRemote = !!process.env.DATABASE_URL;

    // 优先使用 DATABASE_URL (Railway 标准), 否则使用本地 .env 配置
    const connectionString = process.env.DATABASE_URL ||
        `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

    // Railway (及大多数云数据库) 需要 SSL 连接
    const sslConfig = isRemote ? { rejectUnauthorized: false } : false;

    console.log('----------------------------------------');
    console.log(`🔍 Connection Debug:`);
    console.log(`   Target: ${isRemote ? 'Remote (Railway)' : 'Local'}`);
    console.log(`   SSL: ${sslConfig ? 'Enabled' : 'Disabled'}`);
    console.log('----------------------------------------');

    const client = new Client({
        connectionString,
        ssl: sslConfig
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully!');

        const sqlPath = path.join(__dirname, '../db/migrations/create-auth-tables.sql');
        console.log(`Reading SQL from: ${sqlPath}`);

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing migration...');
        await client.query(sql);

        console.log('----------------------------------------');
        console.log('✅ SUCCESS: Auth tables created/verified.');
        console.log('----------------------------------------');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        if (err.code) console.error(`   Code: ${err.code}`);
        if (err.detail) console.error(`   Detail: ${err.detail}`);
    } finally {
        await client.end();
    }
}

runMigration();
