-- 迁移脚本：为所有数据表添加 file_id 字段
-- 用于按文件区分数据

-- 1. 给 asset_specs 表添加 file_id
ALTER TABLE asset_specs ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;

-- 2. 给 assets 表添加 file_id
ALTER TABLE assets ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;

-- 3. 给 spaces 表添加 file_id
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;

-- 4. 给 classifications 表添加 file_id
ALTER TABLE classifications ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;

-- 5. 修改唯一约束（asset_code + file_id 组合唯一）
-- 5. 修改唯一约束（asset_code + file_id 组合唯一）
-- 先删除旧的唯一约束
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_code_key CASCADE;
-- 删除可能已存在的新约束，确保脚本可重复执行
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_file_asset_unique;
ALTER TABLE assets ADD CONSTRAINT assets_file_asset_unique UNIQUE (file_id, asset_code);

-- 空间表同样处理
ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_space_code_key CASCADE;
ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_file_space_unique;
ALTER TABLE spaces ADD CONSTRAINT spaces_file_space_unique UNIQUE (file_id, space_code);

-- 规格表同样处理
ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS asset_specs_spec_code_key CASCADE;
ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS specs_file_spec_unique;
ALTER TABLE asset_specs ADD CONSTRAINT specs_file_spec_unique UNIQUE (file_id, spec_code);

-- 分类表同样处理
ALTER TABLE classifications DROP CONSTRAINT IF EXISTS classifications_classification_code_key CASCADE;
ALTER TABLE classifications DROP CONSTRAINT IF EXISTS classifications_classification_code_classification_type_key CASCADE;
ALTER TABLE classifications DROP CONSTRAINT IF EXISTS class_file_code_unique;
ALTER TABLE classifications ADD CONSTRAINT class_file_code_unique UNIQUE (file_id, classification_code);

-- 6. 创建索引
CREATE INDEX IF NOT EXISTS idx_assets_file_id ON assets(file_id);
CREATE INDEX IF NOT EXISTS idx_spaces_file_id ON spaces(file_id);
CREATE INDEX IF NOT EXISTS idx_asset_specs_file_id ON asset_specs(file_id);
CREATE INDEX IF NOT EXISTS idx_classifications_file_id ON classifications(file_id);

-- 添加注释
COMMENT ON COLUMN assets.file_id IS '关联的模型文件ID';
COMMENT ON COLUMN spaces.file_id IS '关联的模型文件ID';
COMMENT ON COLUMN asset_specs.file_id IS '关联的模型文件ID';
COMMENT ON COLUMN classifications.file_id IS '关联的模型文件ID';
