-- ========================================
-- Tandem 数据库表结构定义
-- PostgreSQL 16
-- ========================================

-- 1. 分类编码表
-- 存储资产和空间的分类编码信息
CREATE TABLE IF NOT EXISTS classifications (
    id SERIAL PRIMARY KEY,
    classification_code VARCHAR(100) NOT NULL,      -- 分类编码：资产取 Classification.OmniClass.21.Number，空间取 Classification.Space.Number
    classification_desc VARCHAR(500),               -- 分类描述：资产取 Classification.OmniClass.21.Description，空间取 Classification.Space.Description
    classification_type VARCHAR(20) NOT NULL,       -- 分类类型：'asset' 或 'space'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(classification_code, classification_type)
);

-- 2. 资产规格表
-- 存储资产构件的规格（类型）信息
CREATE TABLE IF NOT EXISTS asset_specs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,  -- 关联的模型文件ID
    spec_code VARCHAR(100) NOT NULL,                -- 规格编码：类型注释
    spec_name VARCHAR(200),                         -- 规格名称：类型名称
    classification_code VARCHAR(100),               -- 分类编码：OmniClass 21 编号
    classification_desc VARCHAR(500),               -- 分类描述：OmniClass 21 描述
    category VARCHAR(200),                          -- 类别
    family VARCHAR(200),                            -- 族
    type VARCHAR(200),                              -- 类型
    manufacturer VARCHAR(200),                      -- 制造商
    address VARCHAR(500),                           -- 地址
    phone VARCHAR(50),                              -- 电话
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (file_id, spec_code)
);

-- 3. 资产表
-- 存储资产构件的数据
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,  -- 关联的模型文件ID
    asset_code VARCHAR(100) NOT NULL,               -- 编码（主键）：MC编码
    spec_code VARCHAR(100),                         -- 规格编码（外键引用资产规格表的"规格编码"字段）：类型注释
    name VARCHAR(200),                              -- 名称：名称（标识分组下）
    floor VARCHAR(100),                             -- 楼层
    room VARCHAR(200),                              -- 房间：名称（房间分组下）
    db_id INTEGER,                                  -- Viewer 中的 dbId，用于关联
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (file_id, asset_code)
);

-- 4. 空间表
-- 存储房间构件的数据
CREATE TABLE IF NOT EXISTS spaces (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,  -- 关联的模型文件ID
    space_code VARCHAR(100) NOT NULL,               -- 空间编码：编号
    name VARCHAR(200),                              -- 名称
    classification_code VARCHAR(100),               -- 分类编码：Classification.Space.Number
    classification_desc VARCHAR(500),               -- 分类描述：Classification.Space.Description
    floor VARCHAR(100),                             -- 楼层：标高
    area DECIMAL(15, 4),                            -- 面积
    perimeter DECIMAL(15, 4),                       -- 周长
    db_id INTEGER,                                  -- Viewer 中的 dbId，用于关联
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (file_id, space_code)
);

-- ========================================
-- 创建索引以提高查询性能
-- ========================================

-- 分类编码表索引
CREATE INDEX IF NOT EXISTS idx_classifications_code ON classifications(classification_code);
CREATE INDEX IF NOT EXISTS idx_classifications_type ON classifications(classification_type);

-- 资产规格表索引
CREATE INDEX IF NOT EXISTS idx_asset_specs_name ON asset_specs(spec_name);
CREATE INDEX IF NOT EXISTS idx_asset_specs_classification ON asset_specs(classification_code);
CREATE INDEX IF NOT EXISTS idx_asset_specs_category ON asset_specs(category);
CREATE INDEX IF NOT EXISTS idx_asset_specs_family ON asset_specs(family);

-- 资产表索引
CREATE INDEX IF NOT EXISTS idx_assets_spec_code ON assets(spec_code);
CREATE INDEX IF NOT EXISTS idx_assets_floor ON assets(floor);
CREATE INDEX IF NOT EXISTS idx_assets_room ON assets(room);
CREATE INDEX IF NOT EXISTS idx_assets_db_id ON assets(db_id);

-- 空间表索引
CREATE INDEX IF NOT EXISTS idx_spaces_classification ON spaces(classification_code);
CREATE INDEX IF NOT EXISTS idx_spaces_floor ON spaces(floor);
CREATE INDEX IF NOT EXISTS idx_spaces_db_id ON spaces(db_id);

-- ========================================
-- 创建更新时间触发器函数
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为各表创建更新触发器
DROP TRIGGER IF EXISTS update_classifications_updated_at ON classifications;
CREATE TRIGGER update_classifications_updated_at
    BEFORE UPDATE ON classifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_asset_specs_updated_at ON asset_specs;
CREATE TRIGGER update_asset_specs_updated_at
    BEFORE UPDATE ON asset_specs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_spaces_updated_at ON spaces;
CREATE TRIGGER update_spaces_updated_at
    BEFORE UPDATE ON spaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 添加注释
-- ========================================

COMMENT ON TABLE classifications IS '分类编码表：存储资产和空间的OmniClass分类信息';
COMMENT ON TABLE asset_specs IS '资产规格表：存储资产构件的类型规格信息';
COMMENT ON TABLE assets IS '资产表：存储资产构件的基本信息';
COMMENT ON TABLE spaces IS '空间表：存储房间构件的基本信息';

COMMENT ON COLUMN classifications.classification_code IS '分类编码：资产取Classification.OmniClass.21.Number，空间取Classification.Space.Number';
COMMENT ON COLUMN classifications.classification_desc IS '分类描述：资产取Classification.OmniClass.21.Description，空间取Classification.Space.Description';
COMMENT ON COLUMN classifications.classification_type IS '分类类型：asset表示资产分类，space表示空间分类';

COMMENT ON COLUMN asset_specs.spec_code IS '规格编码：取自构件的类型注释属性';
COMMENT ON COLUMN asset_specs.spec_name IS '规格名称：取自构件的类型名称属性';
COMMENT ON COLUMN asset_specs.classification_code IS '分类编码：取自OmniClass 21 编号';
COMMENT ON COLUMN asset_specs.classification_desc IS '分类描述：取自OmniClass 21 描述';

COMMENT ON COLUMN assets.asset_code IS '资产编码：取自MC编码，是资产的唯一标识';
COMMENT ON COLUMN assets.spec_code IS '规格编码：引用资产规格表，取自类型注释';
COMMENT ON COLUMN assets.name IS '资产名称：取自标识分组下的名称属性';
COMMENT ON COLUMN assets.room IS '所在房间：取自房间分组下的名称属性';

COMMENT ON COLUMN spaces.space_code IS '空间编码：取自编号属性';
COMMENT ON COLUMN spaces.classification_code IS '分类编码：取自Classification.Space.Number';
COMMENT ON COLUMN spaces.classification_desc IS '分类描述：取自Classification.Space.Description';
