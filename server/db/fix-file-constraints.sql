-- 修复数据导出所需的唯一约束
-- 运行: psql -U postgres -d tandem_db -f server/db/fix-file-constraints.sql

-- 1. 删除旧的唯一约束（如果存在）
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_code_key;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_code_file_id_key;

ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_space_code_key;
ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_space_code_file_id_key;

ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS asset_specs_spec_code_key;
ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS asset_specs_spec_code_file_id_key;

-- 2. 创建新的组合唯一约束
-- 资产表：asset_code + file_id 唯一
ALTER TABLE assets ADD CONSTRAINT assets_asset_code_file_id_key UNIQUE (asset_code, file_id);

-- 空间表：space_code + file_id 唯一
ALTER TABLE spaces ADD CONSTRAINT spaces_space_code_file_id_key UNIQUE (space_code, file_id);

-- 资产规格表：保持 spec_code 唯一（规格是全局共享的）
-- 但需要确保有 spec_code 的唯一约束
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'asset_specs_spec_code_key' AND conrelid = 'asset_specs'::regclass
    ) THEN
        ALTER TABLE asset_specs ADD CONSTRAINT asset_specs_spec_code_key UNIQUE (spec_code);
    END IF;
END $$;

-- 3. 确保 file_id 列存在（用于 asset_specs，如果没有的话）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'asset_specs' AND column_name = 'file_id'
    ) THEN
        ALTER TABLE asset_specs ADD COLUMN file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. 确保 assets 表有 file_id 列
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assets' AND column_name = 'file_id'
    ) THEN
        ALTER TABLE assets ADD COLUMN file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. 确保 spaces 表有 file_id 列
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'spaces' AND column_name = 'file_id'
    ) THEN
        ALTER TABLE spaces ADD COLUMN file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
END $$;

SELECT 'Constraints updated successfully!' as result;
