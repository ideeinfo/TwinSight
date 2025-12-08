-- ========================================
-- Tandem 数据库表结构定义 V2
-- 新增模型文件管理功能
-- ========================================

-- 0. 模型文件表
-- 存储上传的 SVF 模型文件信息
CREATE TABLE IF NOT EXISTS model_files (
    id SERIAL PRIMARY KEY,
    file_code VARCHAR(100) NOT NULL UNIQUE,           -- 唯一编码（自动生成）
    title VARCHAR(200) NOT NULL,                      -- 文件标题（用户输入）
    original_name VARCHAR(500),                       -- 原始文件名
    file_path VARCHAR(1000),                          -- 存储路径
    file_size BIGINT,                                 -- 文件大小（字节）
    status VARCHAR(20) DEFAULT 'uploaded',            -- 状态: uploaded, extracting, ready, error
    is_active BOOLEAN DEFAULT FALSE,                  -- 是否为当前激活的文件
    extracted_path VARCHAR(1000),                     -- 解压后的路径
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 为 model_files 创建索引
CREATE INDEX IF NOT EXISTS idx_model_files_status ON model_files(status);
CREATE INDEX IF NOT EXISTS idx_model_files_active ON model_files(is_active);

-- 为 model_files 创建更新触发器
DROP TRIGGER IF EXISTS update_model_files_updated_at ON model_files;
CREATE TRIGGER update_model_files_updated_at
    BEFORE UPDATE ON model_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE model_files IS '模型文件表：存储上传的SVF模型文件信息';
COMMENT ON COLUMN model_files.file_code IS '唯一编码：自动生成的编码标识';
COMMENT ON COLUMN model_files.title IS '文件标题：用户输入的显示名称';
COMMENT ON COLUMN model_files.status IS '状态：uploaded-已上传, extracting-解压中, ready-就绪, error-错误';
COMMENT ON COLUMN model_files.is_active IS '是否激活：当前系统加载的模型文件';

-- ========================================
-- 修改现有表，添加文件关联字段
-- ========================================

-- 资产规格表添加文件关联
ALTER TABLE asset_specs ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_asset_specs_file_id ON asset_specs(file_id);

-- 资产表添加文件关联
ALTER TABLE assets ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_assets_file_id ON assets(file_id);

-- 空间表添加文件关联
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_spaces_file_id ON spaces(file_id);

-- 更新唯一约束（允许不同文件有相同编码的资产/空间）
-- 注意：这需要先删除旧的唯一约束再添加新的

-- 资产规格表：spec_code 在同一文件内唯一
ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS asset_specs_spec_code_key;
ALTER TABLE asset_specs ADD CONSTRAINT asset_specs_spec_code_file_unique UNIQUE (spec_code, file_id);

-- 资产表：asset_code 在同一文件内唯一
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_code_key;
ALTER TABLE assets ADD CONSTRAINT assets_asset_code_file_unique UNIQUE (asset_code, file_id);

-- 空间表：space_code 在同一文件内唯一
ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_space_code_key;
ALTER TABLE spaces ADD CONSTRAINT spaces_space_code_file_unique UNIQUE (space_code, file_id);
