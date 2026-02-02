-- ========================================
-- IEC 81346-12 工程数据管理系统表结构
-- 创建日期: 2026-02-02
-- 说明: RDS (Reference Designation System) 多维度方面编码管理
-- ========================================

-- 1. 核心对象表 (图节点原型)
-- 存储所有 RDS 对象，可以是设备（asset）或空间（space）
CREATE TABLE IF NOT EXISTS rds_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    object_type VARCHAR(20) NOT NULL DEFAULT 'asset', -- 'asset' 设备 或 'space' 空间
    ref_code VARCHAR(255) NOT NULL,           -- 设备:asset_code, 空间:space_code
    bim_guid VARCHAR(255),                    -- 关联 BIM 模型的 GUID
    name VARCHAR(500),                        -- 对象名称
    metadata JSONB,                           -- 存储 PLC 信号映射等扩展属性
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(file_id, object_type, ref_code)
);

-- 添加表注释
COMMENT ON TABLE rds_objects IS 'RDS 核心对象表，存储设备和空间实体';
COMMENT ON COLUMN rds_objects.object_type IS '对象类型: asset=设备, space=空间';
COMMENT ON COLUMN rds_objects.ref_code IS '引用编码，对应 assets.asset_code 或 spaces.space_code';
COMMENT ON COLUMN rds_objects.bim_guid IS 'BIM 模型中的 GUID，用于模型联动';

-- 2. 多维度方面编码表 (RDS 81346 核心)
-- 存储对象的三种维度编码：功能(=)、位置(++)、电源(===)
CREATE TABLE IF NOT EXISTS rds_aspects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES rds_objects(id) ON DELETE CASCADE,
    aspect_type VARCHAR(20) NOT NULL,         -- 'function'(=), 'location'(++), 'power'(===)
    full_code VARCHAR(512) NOT NULL,          -- 完整代号，如 =TA001.BJ01.GP02
    prefix VARCHAR(5) NOT NULL,               -- 前缀符号 (=, ++, ===)
    parent_code VARCHAR(512),                 -- 父级编码，用于递归构建树
    hierarchy_level INTEGER NOT NULL,         -- 层级深度 (通常 1-10 层)
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(object_id, aspect_type, full_code)
);

-- 添加表注释
COMMENT ON TABLE rds_aspects IS 'RDS 方面编码表，存储对象的多维度编码';
COMMENT ON COLUMN rds_aspects.aspect_type IS '方面类型: function=工艺功能, location=位置, power=电源';
COMMENT ON COLUMN rds_aspects.full_code IS '完整 IEC 编码，如 =TA001.BJ01.PP01';
COMMENT ON COLUMN rds_aspects.prefix IS '编码前缀: = 或 ++ 或 ===';
COMMENT ON COLUMN rds_aspects.parent_code IS '父级编码，用于构建层级树';
COMMENT ON COLUMN rds_aspects.hierarchy_level IS '层级深度，根节点为 1';

-- 3. 拓扑关系表 (图边原型)
-- 存储对象之间的关系，如供电链路、组成关系等
CREATE TABLE IF NOT EXISTS rds_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_obj_id UUID REFERENCES rds_objects(id) ON DELETE CASCADE,
    target_obj_id UUID REFERENCES rds_objects(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,       -- 如 'FEEDS_POWER_TO'(供电), 'PART_OF'(构成)
    metadata JSONB,                           -- 关系附加属性
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_obj_id, target_obj_id, relation_type)
);

-- 添加表注释
COMMENT ON TABLE rds_relations IS 'RDS 拓扑关系表，存储对象间的连接关系';
COMMENT ON COLUMN rds_relations.relation_type IS '关系类型: FEEDS_POWER_TO=供电, PART_OF=构成, LOCATED_IN=位于, CONTROLS=控制';

-- ========================================
-- 创建索引以优化查询性能
-- ========================================

-- rds_objects 索引
CREATE INDEX IF NOT EXISTS idx_rds_objects_file_id ON rds_objects(file_id);
CREATE INDEX IF NOT EXISTS idx_rds_objects_ref_code ON rds_objects(ref_code);
CREATE INDEX IF NOT EXISTS idx_rds_objects_object_type ON rds_objects(object_type);
CREATE INDEX IF NOT EXISTS idx_rds_objects_bim_guid ON rds_objects(bim_guid);

-- rds_aspects 索引（关键性能索引）
CREATE INDEX IF NOT EXISTS idx_rds_aspects_object_id ON rds_aspects(object_id);
CREATE INDEX IF NOT EXISTS idx_rds_aspects_type ON rds_aspects(aspect_type);
CREATE INDEX IF NOT EXISTS idx_rds_aspects_full_code ON rds_aspects(full_code);
CREATE INDEX IF NOT EXISTS idx_rds_aspects_parent_code ON rds_aspects(parent_code);
CREATE INDEX IF NOT EXISTS idx_rds_aspects_level ON rds_aspects(hierarchy_level);
-- 复合索引：按方面类型和层级查询
CREATE INDEX IF NOT EXISTS idx_rds_aspects_type_level ON rds_aspects(aspect_type, hierarchy_level);

-- rds_relations 索引
CREATE INDEX IF NOT EXISTS idx_rds_relations_source ON rds_relations(source_obj_id);
CREATE INDEX IF NOT EXISTS idx_rds_relations_target ON rds_relations(target_obj_id);
CREATE INDEX IF NOT EXISTS idx_rds_relations_type ON rds_relations(relation_type);
-- 复合索引：按关系类型查找源或目标
CREATE INDEX IF NOT EXISTS idx_rds_relations_source_type ON rds_relations(source_obj_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_rds_relations_target_type ON rds_relations(target_obj_id, relation_type);

-- ========================================
-- 触发器：自动更新 updated_at
-- ========================================

-- 确保更新时间戳函数存在
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- rds_objects 更新触发器
DROP TRIGGER IF EXISTS update_rds_objects_updated_at ON rds_objects;
CREATE TRIGGER update_rds_objects_updated_at
    BEFORE UPDATE ON rds_objects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 初始化数据（关系类型枚举参考）
-- ========================================

-- 可选：创建关系类型的注释表
-- CREATE TABLE IF NOT EXISTS rds_relation_type_ref (
--     type_code VARCHAR(50) PRIMARY KEY,
--     type_label VARCHAR(100) NOT NULL,
--     description TEXT
-- );

-- INSERT INTO rds_relation_type_ref VALUES
--     ('FEEDS_POWER_TO', '供电', '电源供应关系，如：变压器 -> 配电柜 -> 设备'),
--     ('PART_OF', '构成', '组成关系，如：零件属于设备'),
--     ('LOCATED_IN', '位于', '空间位置关系，如：设备位于某房间'),
--     ('CONTROLS', '控制', '控制关系，如：PLC 控制某设备')
-- ON CONFLICT (type_code) DO NOTHING;

-- ========================================
-- 完成
-- ========================================
SELECT 'RDS tables created successfully' as status;
