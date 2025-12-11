import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new pg.Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'tandem',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function runMigration() {
    try {
        await client.connect();
        console.log('📡 已连接到数据库');

        const sqlPath = path.join(__dirname, '..', 'db', 'migrations', 'create_mapping_config.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);
        console.log('✅ 映射配置表创建成功');

    } catch (error) {
        console.error('❌ 创建表失败:', error);
    } finally {
        await client.end();
    }
}

runMigration();
