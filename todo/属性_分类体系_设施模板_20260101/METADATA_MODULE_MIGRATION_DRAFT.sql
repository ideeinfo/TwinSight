-- Metadata module migration draft
-- Target: TwinSight property library / classification schemas / facility templates
-- Note: This is a draft for review. Convert into timestamped files under server/migrations before execution.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Property categories
-- ============================================================
CREATE TABLE IF NOT EXISTS sys_property_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sys_property_categories_name UNIQUE (name)
);

-- ============================================================
-- 2. Properties
-- ============================================================
CREATE TABLE IF NOT EXISTS sys_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_key VARCHAR(200) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id UUID NULL REFERENCES sys_property_categories(id) ON DELETE SET NULL,
    context VARCHAR(32) NOT NULL,
    description TEXT NULL,
    data_type VARCHAR(32) NOT NULL,
    unit_code VARCHAR(50) NULL,
    precision INTEGER NULL,
    constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sys_properties_property_key UNIQUE (property_key),
    CONSTRAINT chk_sys_properties_context
        CHECK (context IN ('Element', 'Specification')),
    CONSTRAINT chk_sys_properties_data_type
        CHECK (data_type IN ('Text', 'Integer', 'Number', 'Boolean', 'DateTime', 'Link', 'Tag')),
    CONSTRAINT chk_sys_properties_precision_non_negative
        CHECK (precision IS NULL OR precision >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sys_properties_category_id ON sys_properties(category_id);
CREATE INDEX IF NOT EXISTS idx_sys_properties_context ON sys_properties(context);
CREATE INDEX IF NOT EXISTS idx_sys_properties_data_type ON sys_properties(data_type);
CREATE INDEX IF NOT EXISTS idx_sys_properties_name ON sys_properties(name);

-- ============================================================
-- 3. Property value options
-- ============================================================
CREATE TABLE IF NOT EXISTS sys_property_value_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES sys_properties(id) ON DELETE CASCADE,
    value VARCHAR(500) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sys_property_value_options UNIQUE (property_id, value)
);

CREATE INDEX IF NOT EXISTS idx_sys_property_value_options_property_id
    ON sys_property_value_options(property_id);

-- ============================================================
-- 4. Classification schemas
-- ============================================================
CREATE TABLE IF NOT EXISTS sys_classification_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'Draft',
    source_file_name VARCHAR(255) NULL,
    source_file_path VARCHAR(500) NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sys_classification_schemas_status
        CHECK (status IN ('Draft', 'Published', 'Archived')),
    CONSTRAINT uq_sys_classification_schemas_name_version UNIQUE (name, version_no)
);

CREATE INDEX IF NOT EXISTS idx_sys_classification_schemas_status
    ON sys_classification_schemas(status);

-- ============================================================
-- 5. Classification nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS sys_classification_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_id UUID NOT NULL REFERENCES sys_classification_schemas(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    level INTEGER NOT NULL,
    parent_id UUID NULL REFERENCES sys_classification_nodes(id) ON DELETE CASCADE,
    path VARCHAR(2000) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    source_row_no INTEGER NULL,
    is_leaf BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sys_classification_nodes_schema_code UNIQUE (schema_id, code),
    CONSTRAINT chk_sys_classification_nodes_level_positive CHECK (level > 0)
);

CREATE INDEX IF NOT EXISTS idx_sys_classification_nodes_schema_id
    ON sys_classification_nodes(schema_id);
CREATE INDEX IF NOT EXISTS idx_sys_classification_nodes_parent_id
    ON sys_classification_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_sys_classification_nodes_schema_path
    ON sys_classification_nodes(schema_id, path);

-- ============================================================
-- 6. Facility templates
-- ============================================================
CREATE TABLE IF NOT EXISTS sys_facility_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    classification_schema_id UUID NOT NULL REFERENCES sys_classification_schemas(id) ON DELETE RESTRICT,
    version_no INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'Draft',
    source_template_id UUID NULL REFERENCES sys_facility_templates(id) ON DELETE SET NULL,
    applied_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sys_facility_templates_status
        CHECK (status IN ('Draft', 'Published', 'Archived'))
);

CREATE INDEX IF NOT EXISTS idx_sys_facility_templates_schema_id
    ON sys_facility_templates(classification_schema_id);
CREATE INDEX IF NOT EXISTS idx_sys_facility_templates_status
    ON sys_facility_templates(status);

-- ============================================================
-- 7. Direct property assignment only
-- ============================================================
CREATE TABLE IF NOT EXISTS rel_template_node_properties (
    template_id UUID NOT NULL REFERENCES sys_facility_templates(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES sys_classification_nodes(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES sys_properties(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (template_id, node_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_rel_template_node_properties_property_id
    ON rel_template_node_properties(property_id);
CREATE INDEX IF NOT EXISTS idx_rel_template_node_properties_node_id
    ON rel_template_node_properties(node_id);

-- ============================================================
-- 8. Facility application relation (reserved for phase 4/5)
-- ============================================================
CREATE TABLE IF NOT EXISTS rel_facility_template_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id INTEGER NOT NULL,
    template_id UUID NOT NULL REFERENCES sys_facility_templates(id) ON DELETE RESTRICT,
    applied_version_no INTEGER NOT NULL,
    sync_status VARCHAR(32) NOT NULL DEFAULT 'SYNCED',
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rel_facility_template_applications_sync_status
        CHECK (sync_status IN ('SYNCED', 'OUTDATED', 'PENDING', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_rel_facility_template_applications_facility_id
    ON rel_facility_template_applications(facility_id);
CREATE INDEX IF NOT EXISTS idx_rel_facility_template_applications_template_id
    ON rel_facility_template_applications(template_id);

-- ============================================================
-- 9. updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_metadata_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sys_property_categories_updated_at ON sys_property_categories;
CREATE TRIGGER trg_sys_property_categories_updated_at
    BEFORE UPDATE ON sys_property_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_updated_at_column();

DROP TRIGGER IF EXISTS trg_sys_properties_updated_at ON sys_properties;
CREATE TRIGGER trg_sys_properties_updated_at
    BEFORE UPDATE ON sys_properties
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_updated_at_column();

DROP TRIGGER IF EXISTS trg_sys_property_value_options_updated_at ON sys_property_value_options;
CREATE TRIGGER trg_sys_property_value_options_updated_at
    BEFORE UPDATE ON sys_property_value_options
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_updated_at_column();

DROP TRIGGER IF EXISTS trg_sys_classification_schemas_updated_at ON sys_classification_schemas;
CREATE TRIGGER trg_sys_classification_schemas_updated_at
    BEFORE UPDATE ON sys_classification_schemas
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_updated_at_column();

DROP TRIGGER IF EXISTS trg_sys_classification_nodes_updated_at ON sys_classification_nodes;
CREATE TRIGGER trg_sys_classification_nodes_updated_at
    BEFORE UPDATE ON sys_classification_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_updated_at_column();

DROP TRIGGER IF EXISTS trg_sys_facility_templates_updated_at ON sys_facility_templates;
CREATE TRIGGER trg_sys_facility_templates_updated_at
    BEFORE UPDATE ON sys_facility_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_updated_at_column();

DROP TRIGGER IF EXISTS trg_rel_template_node_properties_updated_at ON rel_template_node_properties;
CREATE TRIGGER trg_rel_template_node_properties_updated_at
    BEFORE UPDATE ON rel_template_node_properties
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_updated_at_column();

DROP TRIGGER IF EXISTS trg_rel_facility_template_applications_updated_at ON rel_facility_template_applications;
CREATE TRIGGER trg_rel_facility_template_applications_updated_at
    BEFORE UPDATE ON rel_facility_template_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_updated_at_column();

