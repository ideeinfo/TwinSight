/**
 * 执行创建documents表的SQL脚本
 */
import { readFileSync } from 'fs';
import { query } from './db/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createDocumentsTable() {
    try {
        console.log('📋 读取SQL文件...');
        const sqlPath = join(__dirname, 'db', 'create_documents_table.sql');
        const sql = readFileSync(sqlPath, 'utf8');

        console.log('🔨 执行SQL...');
        await query(sql);

        console.log('✅ documents表创建成功！');
        console.log('\n表结构:');
        console.log('- id (主键)');
        console.log('- title (文档标题)');
        console.log('- file_name (原始文件名)');
        console.log('- file_path (存储路径)');
        console.log('- file_size (文件大小)');
        console.log('- file_type (文件类型)');
        console.log('- mime_type (MIME类型)');
        console.log('- asset_code (关联资产)');
        console.log('- space_code (关联空间)');
        console.log('- spec_code (关联规格)');
        console.log('- created_at, updated_at');
        console.log('\n✅ 所有索引已创建');
        console.log('✅ 外键约束已添加');

        process.exit(0);
    } catch (error) {
        console.error('❌ 创建表失败:', error.message);
        process.exit(1);
    }
}

createDocumentsTable();
