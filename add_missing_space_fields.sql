-- 为所有文件的空间映射配置添加缺失的字段
-- 表结构：每个字段映射是一行记录

-- 1. 先查看当前的空间映射配置
SELECT file_id, config_type, field_name, category, property
FROM mapping_configs
WHERE config_type = 'space'
ORDER BY file_id, field_name;

-- 2. 查找所有有空间映射但缺少 area, perimeter, floor 的文件
SELECT DISTINCT file_id
FROM mapping_configs
WHERE config_type = 'space'
  AND file_id NOT IN (
    SELECT file_id FROM mapping_configs 
    WHERE config_type = 'space' AND field_name = 'area'
  );

-- 3. 为每个文件添加缺失的字段
-- 注意：这会为所有已有空间映射配置的文件添加这三个字段

-- 3.1 添加 area（面积）
INSERT INTO mapping_configs (file_id, config_type, field_name, category, property, created_at, updated_at)
SELECT DISTINCT 
    mc.file_id,
    'space' as config_type,
    'area' as field_name,
    '尺寸标注' as category,
    '面积' as property,
    NOW() as created_at,
    NOW() as updated_at
FROM mapping_configs mc
WHERE mc.config_type = 'space'
  AND NOT EXISTS (
    SELECT 1 FROM mapping_configs 
    WHERE file_id = mc.file_id 
      AND config_type = 'space' 
      AND field_name = 'area'
  );

-- 3.2 添加 perimeter（周长）
INSERT INTO mapping_configs (file_id, config_type, field_name, category, property, created_at, updated_at)
SELECT DISTINCT 
    mc.file_id,
    'space' as config_type,
    'perimeter' as field_name,
    '尺寸标注' as category,
    '周长' as property,
    NOW() as created_at,
    NOW() as updated_at
FROM mapping_configs mc
WHERE mc.config_type = 'space'
  AND NOT EXISTS (
    SELECT 1 FROM mapping_configs 
    WHERE file_id = mc.file_id 
      AND config_type = 'space' 
      AND field_name = 'perimeter'
  );

-- 3.3 添加 floor（楼层）
INSERT INTO mapping_configs (file_id, config_type, field_name, category, property, created_at, updated_at)
SELECT DISTINCT 
    mc.file_id,
    'space' as config_type,
    'floor' as field_name,
    '约束' as category,
    '标高' as property,
    NOW() as created_at,
    NOW() as updated_at
FROM mapping_configs mc
WHERE mc.config_type = 'space'
  AND NOT EXISTS (
    SELECT 1 FROM mapping_configs 
    WHERE file_id = mc.file_id 
      AND config_type = 'space' 
      AND field_name = 'floor'
  );

-- 4. 验证更新结果
SELECT file_id, config_type, field_name, category, property
FROM mapping_configs
WHERE config_type = 'space'
ORDER BY file_id, 
  CASE field_name
    WHEN 'spaceCode' THEN 1
    WHEN 'name' THEN 2
    WHEN 'area' THEN 3
    WHEN 'perimeter' THEN 4
    WHEN 'floor' THEN 5
    WHEN 'classificationCode' THEN 6
    WHEN 'classificationDesc' THEN 7
    ELSE 99
  END;
