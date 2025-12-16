/**
 * 执行创建views表的SQL脚本
 */
import { readFileSync } from 'fs';
import { query } from './db/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createViewsTable() {
    try {
        console.log('📋 读取SQL文件...');
        const sqlPath = join(__dirname, 'db', 'create_views_table.sql');
        const sql = readFileSync(sqlPath, 'utf8');

        console.log('🔨 执行SQL...');
        await query(sql);

        console.log('✅ views表创建成功！');
        console.log('\n表结构:');
        console.log('- id (主键)');
        console.log('- file_id (关联文件ID)');
        console.log('- name (视图名称)');
        console.log('- thumbnail (缩略图Base64)');
        console.log('- camera_state (相机状态)');
        console.log('- isolation_state (隔离状态)');
        console.log('- selection_state (选择状态)');
        console.log('- theming_state (主题颜色)');
        console.log('- environment (环境光照)');
        console.log('- cutplanes (剖切面)');
        console.log('- explode_scale (爆炸比例)');
        console.log('- render_options (渲染选项)');
        console.log('- other_settings (其他设置)');
        console.log('- created_at, updated_at');

        process.exit(0);
    } catch (error) {
        console.error('❌ 创建表失败:', error.message);
        process.exit(1);
    }
}

createViewsTable();
