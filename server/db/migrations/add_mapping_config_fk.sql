-- 为映射配置表添加外键约束到 model_files 表

-- 首先检查约束是否已存在，如果存在则先删除
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_mapping_configs_model_file'
  ) THEN
    ALTER TABLE mapping_configs DROP CONSTRAINT fk_mapping_configs_model_file;
  END IF;
END $$;

-- 添加外键约束
ALTER TABLE mapping_configs 
ADD CONSTRAINT fk_mapping_configs_model_file 
FOREIGN KEY (file_id) REFERENCES model_files(id) ON DELETE CASCADE;

-- 验证约束
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'fk_mapping_configs_model_file';
