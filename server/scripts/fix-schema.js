import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'tandem',
    user: 'postgres',
    password: 'password'
});

async function fixSchema() {
    const client = await pool.connect();

    try {
        console.log('🔄 开始修复数据库 Schema...\n');

        // 1. 删除旧表（谨慎！会清空数据）
        console.log('⚠️  警告：将要删除并重建所有表！');
        console.log('   如果表中有重要数据，请先备份！\n');

        await client.query('BEGIN');

        // 删除依赖表
        await client.query('DROP TABLE IF EXISTS assets CASCADE');
        await client.query('DROP TABLE IF EXISTS spaces CASCADE');
        await client.query('DROP TABLE IF EXISTS asset_specs CASCADE');
        await client.query('DROP TABLE IF EXISTS classifications CASCADE');

        console.log('✅ 已删除旧表');

        // 2. 读取并执行完整的 schema.sql
        const schemaPath = path.join(__dirname, '../db/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        await client.query(schema);

        console.log('✅ 已重建所有表结构');

        await client.query('COMMIT');

        console.log('\n🎉 Schema 修复完成！');
        console.log('   所有表已按最新 schema.sql 创建');
        console.log('   包含所有必需的约束和索引');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ 修复失败:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fixSchema();
