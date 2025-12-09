-- 为 asset_specs 表添加 spec_name 字段
-- 规格名称：对应构件的类型名称属性

ALTER TABLE asset_specs 
ADD COLUMN IF NOT EXISTS spec_name VARCHAR(200);

-- 添加注释
COMMENT ON COLUMN asset_specs.spec_name IS '规格名称：取自构件的类型名称属性';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_asset_specs_name ON asset_specs(spec_name);
