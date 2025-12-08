/**
 * 修复数据库约束脚本
 */
import { query, closePool } from '../db/index.js';

async function fixConstraints() {
    console.log('🔧 开始修复数据库约束...');

    try {
        // 删除部分索引
        await query('DROP INDEX IF EXISTS idx_asset_specs_spec_code_unique');
        await query('DROP INDEX IF EXISTS idx_asset_specs_spec_code_file_unique');
        await query('DROP INDEX IF EXISTS idx_assets_asset_code_unique');
        await query('DROP INDEX IF EXISTS idx_assets_asset_code_file_unique');
        await query('DROP INDEX IF EXISTS idx_spaces_space_code_unique');
        await query('DROP INDEX IF EXISTS idx_spaces_space_code_file_unique');
        console.log('✓ 已删除部分索引');

        // 检查并添加 asset_specs 约束
        const r1 = await query("SELECT 1 FROM pg_constraint WHERE conname = 'asset_specs_spec_code_key'");
        if (r1.rows.length === 0) {
            await query('ALTER TABLE asset_specs ADD CONSTRAINT asset_specs_spec_code_key UNIQUE (spec_code)');
            console.log('✓ 已创建 asset_specs 唯一约束');
        } else {
            console.log('✓ asset_specs 唯一约束已存在');
        }

        // 检查并添加 assets 约束
        const r2 = await query("SELECT 1 FROM pg_constraint WHERE conname = 'assets_asset_code_key'");
        if (r2.rows.length === 0) {
            await query('ALTER TABLE assets ADD CONSTRAINT assets_asset_code_key UNIQUE (asset_code)');
            console.log('✓ 已创建 assets 唯一约束');
        } else {
            console.log('✓ assets 唯一约束已存在');
        }

        // 检查并添加 spaces 约束
        const r3 = await query("SELECT 1 FROM pg_constraint WHERE conname = 'spaces_space_code_key'");
        if (r3.rows.length === 0) {
            await query('ALTER TABLE spaces ADD CONSTRAINT spaces_space_code_key UNIQUE (space_code)');
            console.log('✓ 已创建 spaces 唯一约束');
        } else {
            console.log('✓ spaces 唯一约束已存在');
        }

        console.log('✅ 数据库约束修复完成！');

    } catch (error) {
        console.error('❌ 修复失败:', error.message);
        process.exit(1);
    } finally {
        await closePool();
    }
}

fixConstraints();
