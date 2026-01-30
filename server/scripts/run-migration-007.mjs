/**
 * 执行系统配置表扩展迁移
 * 运行: node server/scripts/run-migration-007.mjs
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'twinsight',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 开始执行迁移: 007_extend_system_config.sql');

        // 读取迁移脚本
        const sqlPath = path.join(__dirname, '../migrations/007_extend_system_config.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        // 执行迁移
        await client.query(sql);

        console.log('✅ 迁移执行成功!');

        // 验证结果
        const result = await client.query(`
      SELECT config_key, category, label, config_type, sort_order 
      FROM system_config 
      ORDER BY category, sort_order
    `);

        console.log('\n📊 当前配置项:');
        console.table(result.rows);

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);
