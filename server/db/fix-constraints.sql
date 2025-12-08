-- 修复唯一约束
DROP INDEX IF EXISTS idx_asset_specs_spec_code_unique;
DROP INDEX IF EXISTS idx_asset_specs_spec_code_file_unique;
DROP INDEX IF EXISTS idx_assets_asset_code_unique;
DROP INDEX IF EXISTS idx_assets_asset_code_file_unique;
DROP INDEX IF EXISTS idx_spaces_space_code_unique;
DROP INDEX IF EXISTS idx_spaces_space_code_file_unique;

-- 恢复原来的约束（如果已存在则忽略）
-- asset_specs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_specs_spec_code_key') THEN
        ALTER TABLE asset_specs ADD CONSTRAINT asset_specs_spec_code_key UNIQUE (spec_code);
    END IF;
END $$;

-- assets  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_asset_code_key') THEN
        ALTER TABLE assets ADD CONSTRAINT assets_asset_code_key UNIQUE (asset_code);
    END IF;
END $$;

-- spaces
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spaces_space_code_key') THEN
        ALTER TABLE spaces ADD CONSTRAINT spaces_space_code_key UNIQUE (space_code);
    END IF;
END $$;
