-- 检查和修复空间映射配置

-- 1. 查看 file_id=9 的所有空间映射配置
SELECT id, file_id, field_name, category, property
FROM mapping_configs
WHERE file_id = 9 AND config_type = 'space'
ORDER BY field_name;

-- 2. 查看所有文件的 area 和 perimeter 配置
SELECT file_id, field_name, category, property
FROM mapping_configs
WHERE config_type = 'space' 
  AND field_name IN ('area', 'perimeter', 'floor')
ORDER BY file_id, field_name;

-- 3. 如果file_id=9已有area和perimeter但属性是英文，更新为中文
UPDATE mapping_configs
SET category = '尺寸标注',
    property = '面积',
    updated_at = NOW()
WHERE file_id = 9 
  AND config_type = 'space' 
  AND field_name = 'area';

UPDATE mapping_configs
SET category = '尺寸标注',
    property = '周长',
    updated_at = NOW()
WHERE file_id = 9 
  AND config_type = 'space' 
  AND field_name = 'perimeter';

-- 4. 如果file_id=9根本没有area和perimeter记录，手动添加
INSERT INTO mapping_configs (file_id, config_type, field_name, category, property, created_at, updated_at)
SELECT 9, 'space', 'area', '尺寸标注', '面积', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM mapping_configs 
    WHERE file_id = 9 AND config_type = 'space' AND field_name = 'area'
);

INSERT INTO mapping_configs (file_id, config_type, field_name, category, property, created_at, updated_at)
SELECT 9, 'space', 'perimeter', '尺寸标注', '周长', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM mapping_configs 
    WHERE file_id = 9 AND config_type = 'space' AND field_name = 'perimeter'
);

-- 5. 修复所有文件的英文属性名为中文
-- Area -> 面积
UPDATE mapping_configs
SET property = '面积',
    updated_at = NOW()
WHERE config_type = 'space' 
  AND field_name = 'area'
  AND property != '面积';

-- Perimeter -> 周长  
UPDATE mapping_configs
SET property = '周长',
    updated_at = NOW()
WHERE config_type = 'space' 
  AND field_name = 'perimeter'
  AND property != '周长';

-- Floor -> 标高
UPDATE mapping_configs
SET category = '约束',
    property = '标高',
    updated_at = NOW()
WHERE config_type = 'space' 
  AND field_name = 'floor'
  AND property != '标高';

-- 6. 验证最终结果
SELECT file_id, field_name, category, property
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
