-- 迁移脚本：添加 file_id 列到 classifications 表
-- 在 Railway PostgreSQL 上运行此脚本

-- 添加 file_id 列
ALTER TABLE classifications ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_classifications_file_id ON classifications(file_id);

-- 删除旧的唯一约束并添加新的（如果存在）
-- 注意：如果旧约束不存在，这里的 DROP 会报错，可以忽略
-- ALTER TABLE classifications DROP CONSTRAINT IF EXISTS classifications_classification_code_classification_type_key;
-- ALTER TABLE classifications ADD CONSTRAINT classifications_file_code_type_unique UNIQUE (file_id, classification_code, classification_type);

SELECT 'Migration completed: file_id column added to classifications table' as status;
