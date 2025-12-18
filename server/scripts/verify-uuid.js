/**
 * 验证 UUID 字段是否已正确添加
 */
import { query } from '../db/index.js';

async function verifyUuids() {
    console.log('🔍 验证 UUID 字段...\n');

    // 检查 asset_specs
    console.log('📦 asset_specs 表:');
    const assetSpecsSample = await query('SELECT id, spec_code, uuid FROM asset_specs LIMIT 3');
    assetSpecsSample.rows.forEach(row => {
        console.log(`  ID: ${row.id}, spec_code: ${row.spec_code}, uuid: ${row.uuid}`);
    });

    // 检查 assets
    console.log('\n📦 assets 表:');
    const assetsSample = await query('SELECT id, asset_code, uuid FROM assets LIMIT 3');
    assetsSample.rows.forEach(row => {
        console.log(`  ID: ${row.id}, asset_code: ${row.asset_code}, uuid: ${row.uuid}`);
    });

    // 检查 spaces
    console.log('\n📦 spaces 表:');
    const spacesSample = await query('SELECT id, space_code, uuid FROM spaces LIMIT 3');
    spacesSample.rows.forEach(row => {
        console.log(`  ID: ${row.id}, space_code: ${row.space_code}, uuid: ${row.uuid}`);
    });

    // 统计没有 UUID 的记录
    console.log('\n📊 空 UUID 统计:');
    const nullAssetSpecs = await query('SELECT COUNT(*) as count FROM asset_specs WHERE uuid IS NULL');
    console.log(`  asset_specs: ${nullAssetSpecs.rows[0].count} 条记录没有 UUID`);

    const nullAssets = await query('SELECT COUNT(*) as count FROM assets WHERE uuid IS NULL');
    console.log(`  assets: ${nullAssets.rows[0].count} 条记录没有 UUID`);

    const nullSpaces = await query('SELECT COUNT(*) as count FROM spaces WHERE uuid IS NULL');
    console.log(`  spaces: ${nullSpaces.rows[0].count} 条记录没有 UUID`);

    console.log('\n✅ 验证完成！');
    process.exit(0);
}

verifyUuids().catch(err => {
    console.error('验证失败:', err);
    process.exit(1);
});
