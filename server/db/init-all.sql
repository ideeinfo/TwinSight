-- ========================================
-- Tandem 数据库完整初始化脚本
-- 基于本地数据库导出的实际表结构
-- 生成日期: 2026-01-02
-- ========================================

-- 0. 创建扩展和函数
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 1. model_files (基础表，其他表依赖它)
-- ========================================
CREATE TABLE IF NOT EXISTS model_files (
    id SERIAL PRIMARY KEY,
    file_code VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    original_name VARCHAR(500),
    file_path VARCHAR(1000),
    file_size BIGINT,
    status VARCHAR(20) DEFAULT 'uploaded',
    is_active BOOLEAN DEFAULT FALSE,
    extracted_path VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_files_status ON model_files(status);
CREATE INDEX IF NOT EXISTS idx_model_files_active ON model_files(is_active);

-- ========================================
-- 2. asset_specs (资产规格表)
-- ========================================
CREATE TABLE IF NOT EXISTS asset_specs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER,
    spec_code VARCHAR(500) NOT NULL,
    spec_name VARCHAR(500),
    classification_code VARCHAR(200),
    classification_desc VARCHAR(500),
    category VARCHAR(500),
    family VARCHAR(500),
    type VARCHAR(500),
    manufacturer VARCHAR(500),
    address VARCHAR(500),
    phone VARCHAR(50),
    uuid UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT specs_file_spec_unique UNIQUE (file_id, spec_code)
);

CREATE INDEX IF NOT EXISTS idx_asset_specs_name ON asset_specs(spec_name);
CREATE INDEX IF NOT EXISTS idx_asset_specs_file_id ON asset_specs(file_id);
CREATE INDEX IF NOT EXISTS idx_asset_specs_category ON asset_specs(category);
CREATE INDEX IF NOT EXISTS idx_asset_specs_family ON asset_specs(family);
CREATE INDEX IF NOT EXISTS idx_asset_specs_classification ON asset_specs(classification_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_specs_uuid ON asset_specs(uuid);

-- ========================================
-- 3. assets (资产表)
-- ========================================
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    file_id INTEGER,
    asset_code VARCHAR(500) NOT NULL,
    spec_code VARCHAR(500),
    name VARCHAR(500),
    floor VARCHAR(200),
    room VARCHAR(500),
    db_id INTEGER,
    uuid UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT assets_file_asset_unique UNIQUE (file_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_assets_spec_code ON assets(spec_code);
CREATE INDEX IF NOT EXISTS idx_assets_file_id ON assets(file_id);
CREATE INDEX IF NOT EXISTS idx_assets_floor ON assets(floor);
CREATE INDEX IF NOT EXISTS idx_assets_room ON assets(room);
CREATE INDEX IF NOT EXISTS idx_assets_db_id ON assets(db_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_uuid ON assets(uuid);

-- ========================================
-- 4. classifications (分类编码表)
-- ========================================
CREATE TABLE IF NOT EXISTS classifications (
    id SERIAL PRIMARY KEY,
    file_id INTEGER,
    classification_code VARCHAR(200) NOT NULL,
    classification_desc VARCHAR(500),
    classification_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT class_file_code_unique UNIQUE (file_id, classification_code)
);

CREATE INDEX IF NOT EXISTS idx_classifications_code ON classifications(classification_code);
CREATE INDEX IF NOT EXISTS idx_classifications_type ON classifications(classification_type);
CREATE INDEX IF NOT EXISTS idx_classifications_file_id ON classifications(file_id);

-- ========================================
-- 5. spaces (空间表)
-- ========================================
CREATE TABLE IF NOT EXISTS spaces (
    id SERIAL PRIMARY KEY,
    file_id INTEGER,
    space_code VARCHAR(500) NOT NULL,
    name VARCHAR(500),
    classification_code VARCHAR(200),
    classification_desc VARCHAR(500),
    floor VARCHAR(200),
    area NUMERIC(15, 4),
    perimeter NUMERIC(15, 4),
    db_id INTEGER,
    uuid UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT spaces_file_space_unique UNIQUE (file_id, space_code)
);

CREATE INDEX IF NOT EXISTS idx_spaces_file_id ON spaces(file_id);
CREATE INDEX IF NOT EXISTS idx_spaces_floor ON spaces(floor);
CREATE INDEX IF NOT EXISTS idx_spaces_classification ON spaces(classification_code);
CREATE INDEX IF NOT EXISTS idx_spaces_db_id ON spaces(db_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_uuid ON spaces(uuid);

-- ========================================
-- 6. influx_configs (InfluxDB 配置表)
-- ========================================
CREATE TABLE IF NOT EXISTS influx_configs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER UNIQUE,
    influx_url VARCHAR(500) NOT NULL,
    influx_port INTEGER DEFAULT 8086,
    influx_org VARCHAR(200) NOT NULL,
    influx_bucket VARCHAR(200) NOT NULL,
    influx_token TEXT,
    influx_user VARCHAR(200),
    influx_password TEXT,
    use_basic_auth BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_influx_configs_file_id ON influx_configs(file_id);

-- ========================================
-- 7. views (视图表)
-- ========================================
CREATE TABLE IF NOT EXISTS views (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    thumbnail TEXT,
    camera_state JSONB,
    isolation_state JSONB,
    selection_state JSONB,
    theming_state JSONB,
    environment VARCHAR(100),
    cutplanes JSONB,
    explode_scale DOUBLE PRECISION,
    render_options JSONB,
    other_settings JSONB,
    viewer_state JSONB,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_views_file_name UNIQUE (file_id, name)
);

CREATE INDEX IF NOT EXISTS idx_views_file_id ON views(file_id);
CREATE INDEX IF NOT EXISTS idx_views_name ON views(name);
CREATE INDEX IF NOT EXISTS idx_views_created ON views(created_at DESC);

-- ========================================
-- 8. documents (文档表)
-- ========================================
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
    view_id INTEGER,
    openwebui_file_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_asset ON documents(asset_code);
CREATE INDEX IF NOT EXISTS idx_documents_space ON documents(space_code);
CREATE INDEX IF NOT EXISTS idx_documents_spec ON documents(spec_code);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);

-- ========================================
-- 9. document_exif (文档EXIF信息表)
-- ========================================
CREATE TABLE IF NOT EXISTS document_exif (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL UNIQUE,
    date_time TIMESTAMP,
    image_width INTEGER,
    image_height INTEGER,
    equip_model VARCHAR(255),
    f_number NUMERIC(5, 2),
    exposure_time VARCHAR(50),
    iso_speed INTEGER,
    focal_length NUMERIC(10, 2),
    gps_longitude NUMERIC(12, 8),
    gps_latitude NUMERIC(11, 8),
    gps_altitude NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_exif_document_id ON document_exif(document_id);
CREATE INDEX IF NOT EXISTS idx_document_exif_date_time ON document_exif(date_time);

-- ========================================
-- 10. mapping_configs (映射配置表)
-- ========================================
CREATE TABLE IF NOT EXISTS mapping_configs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    config_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    category VARCHAR(200),
    property VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT mapping_configs_file_id_config_type_field_name_key UNIQUE (file_id, config_type, field_name)
);

CREATE INDEX IF NOT EXISTS idx_mapping_configs_file_id ON mapping_configs(file_id);
CREATE INDEX IF NOT EXISTS idx_mapping_configs_type ON mapping_configs(config_type);

-- ========================================
-- 11. knowledge_bases (知识库表) - UUID 主键
-- ========================================
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id INTEGER NOT NULL UNIQUE,
    openwebui_kb_id VARCHAR(255) NOT NULL,
    kb_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_file_id ON knowledge_bases(file_id);

-- ========================================
-- 12. kb_documents (知识库文档关联表) - UUID 主键
-- ========================================
CREATE TABLE IF NOT EXISTS kb_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kb_id UUID NOT NULL,
    document_id INTEGER,
    openwebui_kb_id VARCHAR(255),
    openwebui_file_id VARCHAR(255),
    sync_status VARCHAR(20) DEFAULT 'pending',
    sync_error TEXT,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kb_documents_kb_document_unique UNIQUE (kb_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_kb_id ON kb_documents(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_document_id ON kb_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_sync_status ON kb_documents(sync_status);

-- ========================================
-- 13. system_config (系统配置表)
-- ========================================
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description VARCHAR(255),
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 触发器 (自动更新 updated_at)
-- ========================================
DO $$
BEGIN
    -- model_files
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_model_files_updated_at') THEN
        CREATE TRIGGER update_model_files_updated_at BEFORE UPDATE ON model_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    -- asset_specs
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_asset_specs_updated_at') THEN
        CREATE TRIGGER update_asset_specs_updated_at BEFORE UPDATE ON asset_specs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    -- assets
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_assets_updated_at') THEN
        CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    -- classifications
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_classifications_updated_at') THEN
        CREATE TRIGGER update_classifications_updated_at BEFORE UPDATE ON classifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    -- spaces
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_spaces_updated_at') THEN
        CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    -- influx_configs
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_influx_configs_updated_at') THEN
        CREATE TRIGGER update_influx_configs_updated_at BEFORE UPDATE ON influx_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    -- knowledge_bases
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_knowledge_bases_updated_at') THEN
        CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ========================================
-- 外键约束
-- ========================================
DO $$
BEGIN
    -- asset_specs -> model_files
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_specs_file_id_fkey_cascade') THEN
        ALTER TABLE asset_specs ADD CONSTRAINT asset_specs_file_id_fkey_cascade FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
    -- assets -> model_files
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_file_id_fkey_cascade') THEN
        ALTER TABLE assets ADD CONSTRAINT assets_file_id_fkey_cascade FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
    -- spaces -> model_files
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spaces_file_id_fkey_cascade') THEN
        ALTER TABLE spaces ADD CONSTRAINT spaces_file_id_fkey_cascade FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
    -- influx_configs -> model_files
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'influx_configs_file_id_fkey') THEN
        ALTER TABLE influx_configs ADD CONSTRAINT influx_configs_file_id_fkey FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
    -- views -> model_files
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'views_file_id_fkey') THEN
        ALTER TABLE views ADD CONSTRAINT views_file_id_fkey FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
    -- documents -> views
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_view_id_fkey') THEN
        ALTER TABLE documents ADD CONSTRAINT documents_view_id_fkey FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE SET NULL;
    END IF;
    -- document_exif -> documents
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_exif_document_id_fkey') THEN
        ALTER TABLE document_exif ADD CONSTRAINT document_exif_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
    END IF;
    -- mapping_configs -> model_files
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mapping_configs_model_file') THEN
        ALTER TABLE mapping_configs ADD CONSTRAINT fk_mapping_configs_model_file FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
    -- knowledge_bases -> model_files
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_bases_file_id_fkey') THEN
        ALTER TABLE knowledge_bases ADD CONSTRAINT knowledge_bases_file_id_fkey FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE CASCADE;
    END IF;
    -- kb_documents -> knowledge_bases
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kb_documents_kb_id_fkey') THEN
        ALTER TABLE kb_documents ADD CONSTRAINT kb_documents_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE;
    END IF;
    -- kb_documents -> documents
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kb_documents_document_id_fkey') THEN
        ALTER TABLE kb_documents ADD CONSTRAINT kb_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ========================================
-- 完成提示
-- ========================================
SELECT 'Database initialization completed!' as status;
