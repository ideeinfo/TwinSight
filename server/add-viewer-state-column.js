/**
 * 添加 viewer_state 列到 views 表
 */
import { query } from './db/index.js';

async function addViewerStateColumn() {
    try {
        console.log('📋 添加 viewer_state 列...');

        await query(`
            ALTER TABLE views 
            ADD COLUMN IF NOT EXISTS viewer_state JSONB
        `);

        console.log('✅ viewer_state 列添加成功！');
        process.exit(0);
    } catch (error) {
        console.error('❌ 添加列失败:', error.message);
        process.exit(1);
    }
}

addViewerStateColumn();
