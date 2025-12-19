-- ========================================
-- 增加字段长度以支持更长的值
-- ========================================

-- 资产表字段扩展
ALTER TABLE assets ALTER COLUMN asset_code TYPE VARCHAR(500);
ALTER TABLE assets ALTER COLUMN spec_code TYPE VARCHAR(500);
ALTER TABLE assets ALTER COLUMN name TYPE VARCHAR(500);
ALTER TABLE assets ALTER COLUMN floor TYPE VARCHAR(200);
ALTER TABLE assets ALTER COLUMN room TYPE VARCHAR(500);

-- 资产规格表字段扩展
ALTER TABLE asset_specs ALTER COLUMN spec_code TYPE VARCHAR(500);
ALTER TABLE asset_specs ALTER COLUMN spec_name TYPE VARCHAR(500);
ALTER TABLE asset_specs ALTER COLUMN classification_code TYPE VARCHAR(200);
ALTER TABLE asset_specs ALTER COLUMN category TYPE VARCHAR(500);
ALTER TABLE asset_specs ALTER COLUMN family TYPE VARCHAR(500);
ALTER TABLE asset_specs ALTER COLUMN type TYPE VARCHAR(500);
ALTER TABLE asset_specs ALTER COLUMN manufacturer TYPE VARCHAR(500);

-- 空间表字段扩展
ALTER TABLE spaces ALTER COLUMN space_code TYPE VARCHAR(500);
ALTER TABLE spaces ALTER COLUMN name TYPE VARCHAR(500);
ALTER TABLE spaces ALTER COLUMN classification_code TYPE VARCHAR(200);
ALTER TABLE spaces ALTER COLUMN floor TYPE VARCHAR(200);

-- 分类编码表字段扩展
ALTER TABLE classifications ALTER COLUMN classification_code TYPE VARCHAR(200);
