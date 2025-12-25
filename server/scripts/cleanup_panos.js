
import { unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '../.env');
console.log(`🔍 尝试加载 .env 文件: ${envPath}`);

if (fs.existsSync(envPath)) {
    console.log('✅ .env 文件存在');
} else {
    console.error('❌ .env 文件不存在!');
}

// 1. 先加载环境变量
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('❌ dotenv 加载错误:', result.error);
} else {
    console.log('✅ dotenv 加载成功');
    console.log('PGUSER:', process.env.PGUSER);
    console.log('PGPASSWORD (length):', process.env.PGPASSWORD ? process.env.PGPASSWORD.length : 0);
}

async function cleanupPanos() {
    try {
        // 2. 动态导入 DB 模块
        console.log('🔄 导入 database.js...');
        const { query } = await import('../config/database.js');

        console.log('🔍 正在查找全景图记录 (Title LIKE "Pano_%")...');

        const res = await query(`
            SELECT * FROM documents 
            WHERE title LIKE 'Pano_%'
        `);

        // ... rest of the code ...
        const docs = res.rows;

        if (docs.length === 0) {
            console.log('✨ 没有发现需要清理的全景图记录。');
            process.exit(0);
        }

        console.log(`📋 发现 ${docs.length} 条记录，准备清理...`);

        const publicDir = join(__dirname, '../../public');

        for (const doc of docs) {
            if (doc.file_path) {
                const relativePath = doc.file_path.startsWith('/') ? doc.file_path.substring(1) : doc.file_path;
                const fullPath = join(publicDir, relativePath);
                try {
                    await unlink(fullPath);
                    console.log(`🗑️ 已删除文件: ${doc.file_name}`);
                } catch (e) {
                    if (e.code === 'ENOENT') {
                        console.log(`⚠️ 文件不存在 (跳过): ${doc.file_name}`);
                    } else {
                        console.error(`❌ 删除文件失败: ${doc.file_name}`, e.message);
                    }
                }
            }
            await query('DELETE FROM documents WHERE id = $1', [doc.id]);
            console.log(`❌ 已删除 DB 记录: ID ${doc.id} - ${doc.title}`);
        }

        console.log('✅ 清理完成！');
        process.exit(0);

    } catch (error) {
        console.error('💥 发生错误:', error);
        process.exit(1);
    }
}

cleanupPanos();
