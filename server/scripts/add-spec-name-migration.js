import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tandem',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🔄 开始执行数据库迁移：添加 spec_name 字段...');

        // 读取 SQL 文件
        const sqlPath = path.join(__dirname, '../db/migrations/add-spec-name.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // 执行 SQL
        await client.query(sql);

        console.log('✅ 迁移成功完成！');
        console.log('   - 已为 asset_specs 表添加 spec_name 字段');
        console.log('   - 已创建索引 idx_asset_specs_name');

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// 运行迁移
runMigration()
    .then(() => {
        console.log('\n🎉 数据库迁移执行完成！');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ 迁移执行失败:', error);
        process.exit(1);
    });
