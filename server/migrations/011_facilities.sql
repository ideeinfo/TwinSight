BEGIN;

CREATE TABLE IF NOT EXISTS facilities (
    id SERIAL PRIMARY KEY,
    facility_code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address VARCHAR(500),
    cover_image_path VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facilities_status ON facilities(status);
CREATE INDEX IF NOT EXISTS idx_facilities_name ON facilities(name);

ALTER TABLE model_files
    ADD COLUMN IF NOT EXISTS facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL;

ALTER TABLE model_files
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_model_files_facility_id ON model_files(facility_id);
CREATE INDEX IF NOT EXISTS idx_model_files_facility_order ON model_files(facility_id, display_order, id);

DROP TRIGGER IF EXISTS update_facilities_updated_at ON facilities;
CREATE TRIGGER update_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE facilities IS '设施表';
COMMENT ON COLUMN facilities.facility_code IS '设施唯一编码';
COMMENT ON COLUMN facilities.name IS '设施名称';
COMMENT ON COLUMN facilities.description IS '设施描述';
COMMENT ON COLUMN facilities.address IS '设施地址';
COMMENT ON COLUMN facilities.cover_image_path IS '设施封面图路径';
COMMENT ON COLUMN facilities.status IS '设施状态: active, archived';
COMMENT ON COLUMN facilities.metadata IS '设施扩展元数据';

INSERT INTO facilities (
    facility_code,
    name,
    description,
    status,
    metadata
)
SELECT
    'FAC-MF-' || mf.id,
    mf.title,
    '初始化自模型文件: ' || COALESCE(mf.original_name, mf.title),
    'active',
    jsonb_build_object(
        'seededFromModelFileId', mf.id,
        'seedType', 'one-model-one-facility'
    )
FROM model_files mf
WHERE NOT EXISTS (
    SELECT 1
    FROM facilities f
    WHERE f.facility_code = 'FAC-MF-' || mf.id
);

UPDATE model_files mf
SET
    facility_id = f.id,
    display_order = COALESCE(mf.display_order, 0)
FROM facilities f
WHERE f.facility_code = 'FAC-MF-' || mf.id
  AND mf.facility_id IS NULL;

COMMIT;
