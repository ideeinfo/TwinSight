
import { query } from '../config/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function checkPanos() {
    try {
        console.log('🔍 查询 Pano 文档记录...');
        const res = await query("SELECT id, title, file_path FROM documents WHERE title LIKE 'Pano_%'");
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkPanos();
