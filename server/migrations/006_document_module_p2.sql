-- =============================================================================
-- 文档管理模块 P2 迁移脚本 - 智能增强
-- 创建日期: 2026-01-26
-- 内容: 
--   1. 创建 document_tags 标签表
--   2. 创建 document_tag_relations 标签关联表
--   3. 添加 thumbnail_path 缩略图字段
--   4. 添加 auto_detected_type 自动识别类型字段
-- =============================================================================

-- 1. 创建标签表
CREATE TABLE IF NOT EXISTS document_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#409EFF',  -- 标签颜色
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_tags_name ON document_tags(name);

COMMENT ON TABLE document_tags IS '文档标签表';
COMMENT ON COLUMN document_tags.name IS '标签名称';
COMMENT ON COLUMN document_tags.color IS '标签颜色 (十六进制)';

-- 2. 创建标签关联表 (多对多)
CREATE TABLE IF NOT EXISTS document_tag_relations (
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES document_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_tag_rel_document ON document_tag_relations(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_tag_rel_tag ON document_tag_relations(tag_id);

COMMENT ON TABLE document_tag_relations IS '文档-标签关联表';

-- 3. 给 documents 表添加缩略图路径字段
ALTER TABLE documents ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(500);

COMMENT ON COLUMN documents.thumbnail_path IS '缩略图文件路径';

-- 4. 给 documents 表添加自动识别类型字段
ALTER TABLE documents ADD COLUMN IF NOT EXISTS auto_detected_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_documents_auto_detected_type ON documents(auto_detected_type);

COMMENT ON COLUMN documents.auto_detected_type IS '自动识别的文档类型 (panorama/photo/bim/cad/etc)';

-- 5. 预置常用标签
INSERT INTO document_tags (name, color, description) VALUES
    ('重要', '#F56C6C', '重要文档'),
    ('待审核', '#E6A23C', '待审核的文档'),
    ('已归档', '#909399', '已归档的文档'),
    ('全景图', '#67C23A', '360度全景图'),
    ('设备手册', '#409EFF', '设备操作手册'),
    ('维护记录', '#409EFF', '维护保养记录'),
    ('竣工图', '#409EFF', '竣工图纸'),
    ('合同', '#E6A23C', '合同文档')
ON CONFLICT (name) DO NOTHING;
