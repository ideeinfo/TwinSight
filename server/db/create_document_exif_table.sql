-- EXIF 信息表
-- 用于存储图像文件的 EXIF 元数据

CREATE TABLE IF NOT EXISTS document_exif (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    -- 文件组 (File)
    date_time TIMESTAMP,           -- 拍摄时间
    image_width INTEGER,           -- 图像宽度
    image_height INTEGER,          -- 图像高度
    
    -- 照相机组 (Camera)
    equip_model VARCHAR(255),      -- 照相机型号
    f_number DECIMAL(5,2),         -- 光圈值 (如 f/2.8)
    exposure_time VARCHAR(50),     -- 曝光时间 (如 1/125s)
    iso_speed INTEGER,             -- ISO速度
    focal_length DECIMAL(10,2),    -- 焦距 (mm)
    
    -- GPS组
    gps_longitude DECIMAL(12,8),   -- GPS经度
    gps_latitude DECIMAL(11,8),    -- GPS纬度
    gps_altitude DECIMAL(10,2),    -- GPS高度 (米)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(document_id)  -- 一个文档只有一条 EXIF 记录
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_document_exif_document_id ON document_exif(document_id);
CREATE INDEX IF NOT EXISTS idx_document_exif_date_time ON document_exif(date_time);

-- 添加注释
COMMENT ON TABLE document_exif IS '图像文件 EXIF 元数据';
COMMENT ON COLUMN document_exif.date_time IS '拍摄时间';
COMMENT ON COLUMN document_exif.image_width IS '图像宽度';
COMMENT ON COLUMN document_exif.image_height IS '图像高度';
COMMENT ON COLUMN document_exif.equip_model IS '照相机型号';
COMMENT ON COLUMN document_exif.f_number IS '光圈值';
COMMENT ON COLUMN document_exif.exposure_time IS '曝光时间';
COMMENT ON COLUMN document_exif.iso_speed IS 'ISO速度';
COMMENT ON COLUMN document_exif.focal_length IS '焦距(mm)';
COMMENT ON COLUMN document_exif.gps_longitude IS 'GPS经度';
COMMENT ON COLUMN document_exif.gps_latitude IS 'GPS纬度';
COMMENT ON COLUMN document_exif.gps_altitude IS 'GPS高度(米)';
