-- =============================================================================
-- 文档管理模块 P1 迁移脚本
-- 创建日期: 2026-01-09
-- 内容: 
--   1. 创建 document_associations 表 (多对多关联)
--   2. 创建 document_folders 表 (文件夹管理)
--   3. 创建 document_metadata 表 (替代 document_exif)
--   4. 迁移现有关联数据
--   5. 移除 chk_single_relation 约束
-- =============================================================================

-- 1. 创建文档关联表 (多对多)
CREATE TABLE IF NOT EXISTS document_associations (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    object_type VARCHAR(20) NOT NULL CHECK (object_type IN ('asset', 'space', 'spec', 'view')),
    object_code VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, object_type, object_code)
);

-- 关联表索引
CREATE INDEX IF NOT EXISTS idx_doc_assoc_document ON document_associations(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_assoc_object ON document_associations(object_type, object_code);

COMMENT ON TABLE document_associations IS '文档多对多关联表';
COMMENT ON COLUMN document_associations.object_type IS '关联对象类型: asset/space/spec/view';
COMMENT ON COLUMN document_associations.object_code IS '关联对象编码';

-- 2. 创建文件夹表
CREATE TABLE IF NOT EXISTS document_folders (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES document_folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1000),  -- 完整路径,便于查询
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_folders_parent ON document_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_path ON document_folders(path);

COMMENT ON TABLE document_folders IS '文档文件夹表';

-- 3. 创建元数据表 (JSONB 存储)
CREATE TABLE IF NOT EXISTS document_metadata (
    document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    common_attrs JSONB DEFAULT '{}',  -- 通用属性 (尺寸/时长等)
    exif_data JSONB DEFAULT '{}',     -- EXIF 数据 (兼容现有)
    ai_analysis JSONB DEFAULT '{}',   -- AI 分析结果缓存
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE document_metadata IS '文档元数据表 (JSONB 存储)';

-- 4. 给 documents 表添加 folder_id 和 business_type 字段
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES document_folders(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS business_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_business_type ON documents(business_type);

COMMENT ON COLUMN documents.folder_id IS '所属文件夹ID';
COMMENT ON COLUMN documents.business_type IS '业务类型 (panorama/bim/cad/office等)';

-- 5. 迁移现有关联数据到新表
INSERT INTO document_associations (document_id, object_type, object_code)
SELECT id, 'asset', asset_code FROM documents WHERE asset_code IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO document_associations (document_id, object_type, object_code)
SELECT id, 'space', space_code FROM documents WHERE space_code IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO document_associations (document_id, object_type, object_code)
SELECT id, 'spec', spec_code FROM documents WHERE spec_code IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO document_associations (document_id, object_type, object_code)
SELECT id, 'view', view_id::text FROM documents WHERE view_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6. 迁移 EXIF 数据到 document_metadata
INSERT INTO document_metadata (document_id, exif_data)
SELECT document_id, jsonb_build_object(
    'dateTime', date_time,
    'imageWidth', image_width,
    'imageHeight', image_height,
    'equipModel', equip_model,
    'fNumber', f_number,
    'exposureTime', exposure_time,
    'isoSpeed', iso_speed,
    'focalLength', focal_length,
    'gpsLongitude', gps_longitude,
    'gpsLatitude', gps_latitude,
    'gpsAltitude', gps_altitude
) FROM document_exif
ON CONFLICT (document_id) DO UPDATE SET
    exif_data = EXCLUDED.exif_data,
    updated_at = CURRENT_TIMESTAMP;

-- 7. 移除单一关联约束 (允许多对多)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_single_relation;

-- 注意: 暂时保留 asset_code, space_code, spec_code, view_id 字段以保持向后兼容
-- 后续版本可删除这些字段
