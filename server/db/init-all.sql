-- ========================================
-- Tandem 数据库完整初始化脚本
-- 按正确顺序创建所有表
-- ========================================

-- 0. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. 模型文件表（基础表，其他表依赖它）
CREATE TABLE IF NOT EXISTS model_files (
    id SERIAL PRIMARY KEY,
    file_code VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    original_name VARCHAR(500),
    file_path VARCHAR(1000),
    file_size BIGINT,
    status VARCHAR(20) DEFAULT 'uploaded',
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    extracted_path VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_model_files_status ON model_files(status);
CREATE INDEX IF NOT EXISTS idx_model_files_active ON model_files(is_active);

-- 2. 分类编码表
CREATE TABLE IF NOT EXISTS classifications (
    id SERIAL PRIMARY KEY,
    classification_code VARCHAR(100) NOT NULL,
    classification_desc VARCHAR(500),
    classification_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(classification_code, classification_type)
);
CREATE INDEX IF NOT EXISTS idx_classifications_code ON classifications(classification_code);
CREATE INDEX IF NOT EXISTS idx_classifications_type ON classifications(classification_type);

-- 3. 资产规格表
CREATE TABLE IF NOT EXISTS asset_specs (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() NOT NULL,
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    spec_code VARCHAR(100) NOT NULL,
    spec_name VARCHAR(200),
    classification_code VARCHAR(100),
    classification_desc VARCHAR(500),
    category VARCHAR(200),
    family VARCHAR(200),
    type VARCHAR(200),
    manufacturer VARCHAR(200),
    address VARCHAR(500),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (file_id, spec_code)
);
CREATE INDEX IF NOT EXISTS idx_asset_specs_name ON asset_specs(spec_name);
CREATE INDEX IF NOT EXISTS idx_asset_specs_file_id ON asset_specs(file_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_specs_uuid ON asset_specs(uuid);

-- 4. 资产表
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() NOT NULL,
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    asset_code VARCHAR(100) NOT NULL,
    spec_code VARCHAR(100),
    name VARCHAR(200),
    floor VARCHAR(100),
    room VARCHAR(200),
    db_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (file_id, asset_code)
);
CREATE INDEX IF NOT EXISTS idx_assets_spec_code ON assets(spec_code);
CREATE INDEX IF NOT EXISTS idx_assets_file_id ON assets(file_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_uuid ON assets(uuid);

-- 5. 空间表
CREATE TABLE IF NOT EXISTS spaces (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() NOT NULL,
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    space_code VARCHAR(100) NOT NULL,
    name VARCHAR(200),
    classification_code VARCHAR(100),
    classification_desc VARCHAR(500),
    floor VARCHAR(100),
    area DECIMAL(15, 4),
    perimeter DECIMAL(15, 4),
    db_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (file_id, space_code)
);
CREATE INDEX IF NOT EXISTS idx_spaces_file_id ON spaces(file_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_uuid ON spaces(uuid);

-- 6. InfluxDB 配置表
CREATE TABLE IF NOT EXISTS influx_configs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER UNIQUE REFERENCES model_files(id) ON DELETE CASCADE,
    influx_url VARCHAR(500) NOT NULL,
    influx_port INTEGER DEFAULT 8086,
    influx_org VARCHAR(200) NOT NULL,
    influx_bucket VARCHAR(200) NOT NULL,
    influx_token TEXT,
    influx_user VARCHAR(200),
    influx_password TEXT,
    use_basic_auth BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_influx_configs_file_id ON influx_configs(file_id);

-- 7. 视图表
CREATE TABLE IF NOT EXISTS views (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES model_files(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    thumbnail TEXT,
    camera_state JSONB,
    isolation_state JSONB,
    selection_state JSONB,
    theming_state JSONB,
    environment VARCHAR(100),
    cutplanes JSONB,
    explode_scale FLOAT,
    render_options JSONB,
    other_settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_views_file_name UNIQUE(file_id, name)
);
CREATE INDEX IF NOT EXISTS idx_views_file_id ON views(file_id);

-- 8. 文档表
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),
    mime_type VARCHAR(100),
    asset_code VARCHAR(100),
    space_code VARCHAR(100),
    spec_code VARCHAR(100),
    view_id INTEGER REFERENCES views(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_asset ON documents(asset_code);
CREATE INDEX IF NOT EXISTS idx_documents_space ON documents(space_code);
CREATE INDEX IF NOT EXISTS idx_documents_spec ON documents(spec_code);
CREATE INDEX IF NOT EXISTS idx_documents_view_id ON documents(view_id);

-- 9. 文档EXIF信息表
CREATE TABLE IF NOT EXISTS document_exif (
    id SERIAL PRIMARY KEY,
    document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    date_time TIMESTAMP,
    image_width INTEGER,
    image_height INTEGER,
    equip_model VARCHAR(200),
    f_number DECIMAL(10, 2),
    exposure_time VARCHAR(50),
    iso_speed INTEGER,
    focal_length DECIMAL(10, 2),
    gps_longitude DECIMAL(15, 10),
    gps_latitude DECIMAL(15, 10),
    gps_altitude DECIMAL(15, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_document_exif_document_id ON document_exif(document_id);

-- 10. 映射配置表
CREATE TABLE IF NOT EXISTS mapping_configs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    config_type VARCHAR(50) NOT NULL,
    config_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, config_type)
);
CREATE INDEX IF NOT EXISTS idx_mapping_configs_file_id ON mapping_configs(file_id);

-- 11. 知识库表
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    kb_name VARCHAR(255) NOT NULL,
    openwebui_kb_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_file_id ON knowledge_bases(file_id);

-- 12. 知识库文档关联表
CREATE TABLE IF NOT EXISTS kb_documents (
    id SERIAL PRIMARY KEY,
    kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    openwebui_kb_id VARCHAR(100),
    openwebui_file_id VARCHAR(100),
    sync_status VARCHAR(50) DEFAULT 'pending',
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(kb_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_kb_documents_kb_id ON kb_documents(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_document_id ON kb_documents(document_id);

-- 13. 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 完成提示
-- ========================================
SELECT 'Database initialization completed!' as status;
