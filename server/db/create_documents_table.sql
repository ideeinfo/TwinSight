-- 创建文档管理表
-- 支持与资产、空间、规格关联的文档

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50),
  mime_type VARCHAR(100),
  
  -- 关联字段（三选一）
  asset_code VARCHAR(100),
  space_code VARCHAR(100),
  spec_code VARCHAR(100),
  
  -- 注意：不使用外键约束，因为code字段不是主键
  -- 应用层需要保证数据一致性
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 确保只关联一个对象
  CONSTRAINT chk_single_relation CHECK (
    (asset_code IS NOT NULL AND space_code IS NULL AND spec_code IS NULL) OR
    (asset_code IS NULL AND space_code IS NOT NULL AND spec_code IS NULL) OR
    (asset_code IS NULL AND space_code IS NULL AND spec_code IS NOT NULL)
  )
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_documents_asset ON documents(asset_code);
CREATE INDEX IF NOT EXISTS idx_documents_space ON documents(space_code);
CREATE INDEX IF NOT EXISTS idx_documents_spec ON documents(spec_code);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);

-- 添加注释
COMMENT ON TABLE documents IS '文档管理表，存储与资产、空间、规格关联的文档';
COMMENT ON COLUMN documents.title IS '文档标题（可编辑）';
COMMENT ON COLUMN documents.file_name IS '原始文件名';
COMMENT ON COLUMN documents.file_path IS '服务器存储路径';
COMMENT ON COLUMN documents.file_size IS '文件大小（字节）';
COMMENT ON COLUMN documents.file_type IS '文件扩展名（如pdf, jpg）';
COMMENT ON COLUMN documents.mime_type IS 'MIME类型';
COMMENT ON COLUMN documents.asset_code IS '关联的资产编码';
COMMENT ON COLUMN documents.space_code IS '关联的空间编码';
COMMENT ON COLUMN documents.spec_code IS '关联的规格编码';
