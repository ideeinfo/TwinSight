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

async function addForeignKey() {
    try {
        await client.connect();
        console.log('📡 已连接到数据库');

        const sqlPath = path.join(__dirname, '..', 'db', 'migrations', 'add_mapping_config_fk.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);
        console.log('✅ 外键约束添加成功');

    } catch (error) {
        console.error('❌ 添加外键失败:', error.message);
    } finally {
        await client.end();
    }
}

addForeignKey();
