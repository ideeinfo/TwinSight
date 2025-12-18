/**
 * 数据库迁移脚本：为资产表、资产规格表、空间表添加 UUID 字段
 * 同时为现有记录生成 UUID
 */
import { query, getClient } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

async function addUuidColumns() {
    const client = await getClient();

    try {
        console.log('🚀 开始添加 UUID 字段...\n');

        await client.query('BEGIN');

        // 1. 为 asset_specs 表添加 uuid 字段
        console.log('📦 处理 asset_specs 表...');
        const assetSpecsHasUuid = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'asset_specs' AND column_name = 'uuid'
        `);

        if (assetSpecsHasUuid.rows.length === 0) {
            await client.query(`
                ALTER TABLE asset_specs 
                ADD COLUMN uuid UUID DEFAULT gen_random_uuid()
            `);
            console.log('  ✅ 已添加 uuid 字段到 asset_specs');

            // 创建唯一索引
            await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_specs_uuid ON asset_specs(uuid)
            `);
            console.log('  ✅ 已创建 uuid 唯一索引');
        } else {
            console.log('  ⏭️ asset_specs 已有 uuid 字段，跳过');
        }

        // 2. 为 assets 表添加 uuid 字段
        console.log('📦 处理 assets 表...');
        const assetsHasUuid = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'assets' AND column_name = 'uuid'
        `);

        if (assetsHasUuid.rows.length === 0) {
            await client.query(`
                ALTER TABLE assets 
                ADD COLUMN uuid UUID DEFAULT gen_random_uuid()
            `);
            console.log('  ✅ 已添加 uuid 字段到 assets');

            // 创建唯一索引
            await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_uuid ON assets(uuid)
            `);
            console.log('  ✅ 已创建 uuid 唯一索引');
        } else {
            console.log('  ⏭️ assets 已有 uuid 字段，跳过');
        }

        // 3. 为 spaces 表添加 uuid 字段
        console.log('📦 处理 spaces 表...');
        const spacesHasUuid = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'spaces' AND column_name = 'uuid'
        `);

        if (spacesHasUuid.rows.length === 0) {
            await client.query(`
                ALTER TABLE spaces 
                ADD COLUMN uuid UUID DEFAULT gen_random_uuid()
            `);
            console.log('  ✅ 已添加 uuid 字段到 spaces');

            // 创建唯一索引
            await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_uuid ON spaces(uuid)
            `);
            console.log('  ✅ 已创建 uuid 唯一索引');
        } else {
            console.log('  ⏭️ spaces 已有 uuid 字段，跳过');
        }

        await client.query('COMMIT');
        console.log('\n✅ UUID 字段添加完成！');

        // 4. 为现有记录生成 UUID（如果还没有）
        console.log('\n🔄 为现有记录生成 UUID...');

        // 更新 asset_specs 中没有 uuid 的记录
        const updateAssetSpecs = await query(`
            UPDATE asset_specs SET uuid = gen_random_uuid() WHERE uuid IS NULL
        `);
        console.log(`  📦 asset_specs: 更新了 ${updateAssetSpecs.rowCount} 条记录`);

        // 更新 assets 中没有 uuid 的记录
        const updateAssets = await query(`
            UPDATE assets SET uuid = gen_random_uuid() WHERE uuid IS NULL
        `);
        console.log(`  📦 assets: 更新了 ${updateAssets.rowCount} 条记录`);

        // 更新 spaces 中没有 uuid 的记录
        const updateSpaces = await query(`
            UPDATE spaces SET uuid = gen_random_uuid() WHERE uuid IS NULL
        `);
        console.log(`  📦 spaces: 更新了 ${updateSpaces.rowCount} 条记录`);

        // 5. 显示统计信息
        console.log('\n📊 当前数据统计:');

        const assetSpecsCount = await query('SELECT COUNT(*) as count FROM asset_specs');
        console.log(`  📦 asset_specs: ${assetSpecsCount.rows[0].count} 条记录`);

        const assetsCount = await query('SELECT COUNT(*) as count FROM assets');
        console.log(`  📦 assets: ${assetsCount.rows[0].count} 条记录`);

        const spacesCount = await query('SELECT COUNT(*) as count FROM spaces');
        console.log(`  📦 spaces: ${spacesCount.rows[0].count} 条记录`);

        console.log('\n🎉 迁移完成！所有记录都已分配 UUID。');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 迁移失败:', error.message);
        throw error;
    } finally {
        client.release();
    }

    process.exit(0);
}

addUuidColumns().catch(err => {
    console.error('脚本执行失败:', err);
    process.exit(1);
});
