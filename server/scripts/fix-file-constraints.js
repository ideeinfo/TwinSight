import { query, getClient } from '../db/index.js';

async function fixConstraints() {
  const client = await getClient();

  try {
    console.log('🔧 开始修复数据库约束...');

    await client.query('BEGIN');

    // 1. 删除旧的唯一约束（使用 CASCADE）
    console.log('📦 删除旧约束...');
    try { await client.query('ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_code_key CASCADE'); } catch (e) { }
    try { await client.query('ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_code_file_id_key CASCADE'); } catch (e) { }
    try { await client.query('ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_space_code_key CASCADE'); } catch (e) { }
    try { await client.query('ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_space_code_file_id_key CASCADE'); } catch (e) { }
    try { await client.query('ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS asset_specs_spec_code_key CASCADE'); } catch (e) { }
    // 删除旧索引
    try { await client.query('DROP INDEX IF EXISTS assets_code_file_unique'); } catch (e) { }
    try { await client.query('DROP INDEX IF EXISTS spaces_code_file_unique'); } catch (e) { }
    try { await client.query('DROP INDEX IF EXISTS asset_specs_code_unique'); } catch (e) { }

    // 2. 确保 file_id 列存在
    console.log('📦 确保 file_id 列存在...');

    // 检查 assets 表
    const assetsCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'file_id'
    `);
    if (assetsCheck.rows.length === 0) {
      await client.query('ALTER TABLE assets ADD COLUMN file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE');
      console.log('  ✓ 为 assets 表添加了 file_id 列');
    }

    // 检查 spaces 表
    const spacesCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'spaces' AND column_name = 'file_id'
    `);
    if (spacesCheck.rows.length === 0) {
      await client.query('ALTER TABLE spaces ADD COLUMN file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE');
      console.log('  ✓ 为 spaces 表添加了 file_id 列');
    }

    // 检查 asset_specs 表
    const specsCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'asset_specs' AND column_name = 'file_id'
    `);
    if (specsCheck.rows.length === 0) {
      await client.query('ALTER TABLE asset_specs ADD COLUMN file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE');
      console.log('  ✓ 为 asset_specs 表添加了 file_id 列');
    }

    // 3. 创建新的组合唯一约束
    console.log('📦 创建新的唯一约束...');

    // 使用 COALESCE 处理 NULL file_id 的情况
    // 或者创建部分索引

    // 对于 assets：创建唯一索引（可以处理 NULL）
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS assets_code_file_unique 
      ON assets (asset_code, COALESCE(file_id, -1))
    `);
    console.log('  ✓ 创建了 assets 的唯一索引');

    // 对于 spaces：创建唯一索引
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS spaces_code_file_unique 
      ON spaces (space_code, COALESCE(file_id, -1))
    `);
    console.log('  ✓ 创建了 spaces 的唯一索引');

    // 对于 asset_specs：保持 spec_code 唯一
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS asset_specs_code_unique 
      ON asset_specs (spec_code)
    `);
    console.log('  ✓ 创建了 asset_specs 的唯一索引');

    await client.query('COMMIT');
    console.log('✅ 数据库约束修复完成！');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 修复约束失败:', error.message);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

fixConstraints().catch(console.error);
