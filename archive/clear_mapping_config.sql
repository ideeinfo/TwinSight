-- 清除特定文件的映射配置，以便使用新的默认配置
-- 替换 <file_id> 为您的文件ID

-- 查看当前的映射配置
SELECT * FROM mapping_config WHERE file_id = <file_id>;

-- 删除旧的映射配置（这样系统会使用新的默认配置）
DELETE FROM mapping_config WHERE file_id = <file_id>;

-- 或者：清除所有文件的映射配置（谨慎使用！）
-- DELETE FROM mapping_config;
