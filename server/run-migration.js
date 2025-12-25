
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. 加载环境变量
const envPath = join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.error('❌ .env 文件未找到');
    process.exit(1);
}

async function runMigration() {
    try {
        // 2. 动态导入 DB，确保使用正确的环境变量
        const { query } = await import('./config/database.js');

        console.log('🔄 开始添加 view_id 列...');
        // Correct path relative to server root
        const sqlPath = join(__dirname, 'db/add_view_id_to_documents.sql');
        const sql = readFileSync(sqlPath, 'utf8');
        await query(sql);
        console.log('✅ 数据库迁移成功！');
        process.exit(0);
    } catch (error) {
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    }
}

runMigration();
