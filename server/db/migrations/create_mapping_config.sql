-- 创建映射配置表
CREATE TABLE IF NOT EXISTS mapping_configs (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL,
  config_type VARCHAR(50) NOT NULL, -- 'asset', 'asset_spec', 'space'
  field_name VARCHAR(100) NOT NULL,
  category VARCHAR(200),
  property VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, config_type, field_name)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_mapping_configs_file_id ON mapping_configs(file_id);
CREATE INDEX IF NOT EXISTS idx_mapping_configs_type ON mapping_configs(config_type);

-- 添加注释
COMMENT ON TABLE mapping_configs IS '模型文件的字段映射配置';
COMMENT ON COLUMN mapping_configs.file_id IS '关联的文件ID';
COMMENT ON COLUMN mapping_configs.config_type IS '配置类型: asset(资产), asset_spec(资产规格), space(空间)';
COMMENT ON COLUMN mapping_configs.field_name IS '字段名称，如 assetCode, specCode 等';
COMMENT ON COLUMN mapping_configs.category IS '模型属性分类';
COMMENT ON COLUMN mapping_configs.property IS '模型属性名称';

-- 注意：如果需要添加外键约束到 files 表，请在 files 表存在后执行：
-- ALTER TABLE mapping_configs ADD CONSTRAINT fk_mapping_configs_file 
--   FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;
