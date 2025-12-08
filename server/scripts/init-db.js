/**
 * 数据库初始化脚本
 * 执行 schema.sql 创建表结构
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, closePool } from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initDatabase() {
    console.log('🚀 开始初始化数据库...');

    try {
        // 读取 schema.sql 文件
        const schemaPath = join(__dirname, '../db/schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');

        // 执行 SQL
        await query(schema);

        console.log('✅ 数据库表结构创建成功！');
        console.log('📋 已创建的表:');
        console.log('   - classifications (分类编码表)');
        console.log('   - asset_specs (资产规格表)');
        console.log('   - assets (资产表)');
        console.log('   - spaces (空间表)');

    } catch (error) {
        console.error('❌ 数据库初始化失败:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

initDatabase();
