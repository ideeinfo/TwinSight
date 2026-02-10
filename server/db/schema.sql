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
    uuid UUID DEFAULT gen_random_uuid() NOT NULL,    -- 唯一标识符
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
    uuid UUID DEFAULT gen_random_uuid() NOT NULL,   -- 唯一标识符
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
    uuid UUID DEFAULT gen_random_uuid() NOT NULL,   -- 唯一标识符
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_specs_uuid ON asset_specs(uuid);

-- 资产表索引
CREATE INDEX IF NOT EXISTS idx_assets_spec_code ON assets(spec_code);
CREATE INDEX IF NOT EXISTS idx_assets_floor ON assets(floor);
CREATE INDEX IF NOT EXISTS idx_assets_room ON assets(room);
CREATE INDEX IF NOT EXISTS idx_assets_db_id ON assets(db_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_uuid ON assets(uuid);

-- 空间表索引
CREATE INDEX IF NOT EXISTS idx_spaces_classification ON spaces(classification_code);
CREATE INDEX IF NOT EXISTS idx_spaces_floor ON spaces(floor);
CREATE INDEX IF NOT EXISTS idx_spaces_db_id ON spaces(db_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_uuid ON spaces(uuid);

-- 5. InfluxDB 配置表
-- 存储每个模型的时序数据库连接配置
CREATE TABLE IF NOT EXISTS influx_configs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER UNIQUE REFERENCES model_files(id) ON DELETE CASCADE,
    influx_url VARCHAR(500) NOT NULL,           -- InfluxDB 地址
    influx_port INTEGER DEFAULT 8086,           -- 端口
    influx_org VARCHAR(200) NOT NULL,           -- 组织
    influx_bucket VARCHAR(200) NOT NULL,        -- 容器/存储桶
    influx_token TEXT,                          -- API Token
    influx_user VARCHAR(200),                   -- 用户名（Basic认证）
    influx_password TEXT,                       -- 密码（Basic认证）
    use_basic_auth BOOLEAN DEFAULT false,       -- 是否使用 Basic 认证
    is_enabled BOOLEAN DEFAULT true,            -- 是否启用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- InfluxDB 配置表索引
CREATE INDEX IF NOT EXISTS idx_influx_configs_file_id ON influx_configs(file_id);

-- ========================================
-- 6. 系统配置表
-- 存储 API 密钥等敏感信息及系统全局配置
-- ========================================
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description VARCHAR(255),
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表索引
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);


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

DROP TRIGGER IF EXISTS update_influx_configs_updated_at ON influx_configs;
CREATE TRIGGER update_influx_configs_updated_at
    BEFORE UPDATE ON influx_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_config_updated_at ON system_config;
CREATE TRIGGER update_system_config_updated_at
    BEFORE UPDATE ON system_config
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

COMMENT ON TABLE influx_configs IS 'InfluxDB配置表：存储每个模型的时序数据库连接配置';
COMMENT ON COLUMN influx_configs.file_id IS '关联的模型文件ID，一对一关系';
COMMENT ON COLUMN influx_configs.influx_url IS 'InfluxDB服务器地址';
COMMENT ON COLUMN influx_configs.influx_port IS '端口号，默认8086';
COMMENT ON COLUMN influx_configs.influx_org IS 'InfluxDB组织名称';
COMMENT ON COLUMN influx_configs.influx_bucket IS 'InfluxDB存储桶名称';
COMMENT ON COLUMN influx_configs.influx_token IS 'API Token用于认证';
COMMENT ON COLUMN influx_configs.use_basic_auth IS '是否使用Basic认证而非Token';

COMMENT ON TABLE system_config IS '系统配置表：存储及动态管理系统全局参数';

-- ========================================
-- 初始化数据
-- ========================================

-- 初始化系统配置默认值
INSERT INTO system_config (config_key, config_value, description, is_encrypted)
VALUES 
    -- 基础 AI 配置
    ('N8N_WEBHOOK_URL', 'http://localhost:5678', 'n8n Webhook 基础 URL', FALSE),
    -- LLM 配置 (v1.1)
    ('LLM_PROVIDER', 'gemini', 'LLM 服务提供商 (gemini/qwen/deepseek)', FALSE),
    ('LLM_API_KEY', '', 'LLM API Key', TRUE),
    ('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/', 'OpenAI 兼容 API 基础 URL', FALSE),
    ('LLM_MODEL', 'gemini-2.0-flash', '选择的模型名称', FALSE)
ON CONFLICT (config_key) DO NOTHING;
