-- ========================================
-- RDS 电源功能网络图表结构
-- 创建日期: 2026-02-05
-- 说明: 电源功能 (===) 使用图结构替代树结构，支持复杂拓扑
-- ========================================

-- 1. 电源网络节点表
-- 存储所有电源网络中的节点（变电站、母线、馈线柜、设备等）
CREATE TABLE IF NOT EXISTS rds_power_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    object_id UUID REFERENCES rds_objects(id) ON DELETE SET NULL, -- 关联物理设备 (可空，纯逻辑节点无关联)
    
    full_code VARCHAR(255) NOT NULL,       -- 完整编码 (===DY1.AH1.H01)
    short_code VARCHAR(50) NOT NULL,       -- 自身短码 (H01)
    parent_code VARCHAR(255),              -- 父级编码 (===DY1.AH1)，用于快速查询
    label VARCHAR(255),                    -- 显示名称 (如 "AH5柜出线")
    level INTEGER NOT NULL DEFAULT 1,      -- 层级深度 (1=根节点)
    node_type VARCHAR(50) DEFAULT 'device', -- 节点分类: 'source'(电源) | 'bus'(母线) | 'feeder'(馈线柜) | 'device'(终端设备)
    
    properties JSONB,                      -- 扩展属性 (额定电流、电压等级、设备型号等)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(file_id, full_code)             -- 同一文件内编码唯一
);

-- 添加表注释
COMMENT ON TABLE rds_power_nodes IS '电源网络节点表，存储电源功能图的所有节点';
COMMENT ON COLUMN rds_power_nodes.full_code IS '完整 IEC 电源编码，如 ===DY1.AH1.H01';
COMMENT ON COLUMN rds_power_nodes.short_code IS '节点自身短码，如 H01';
COMMENT ON COLUMN rds_power_nodes.parent_code IS '父级编码，用于快速构建层级关系';
COMMENT ON COLUMN rds_power_nodes.node_type IS '节点分类: source=电源/变压器, bus=母线, feeder=馈线柜, device=终端设备';
COMMENT ON COLUMN rds_power_nodes.properties IS '扩展属性 JSON，如 {"voltage": "10kV", "rated_current": "630A"}';

-- 2. 电源网络边表 (关系)
-- 存储节点之间的各种关系
CREATE TABLE IF NOT EXISTS rds_power_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    source_node_id UUID REFERENCES rds_power_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES rds_power_nodes(id) ON DELETE CASCADE,
    
    relation_type VARCHAR(50) NOT NULL DEFAULT 'hierarchy', 
    -- 关系类型：
    -- 'hierarchy': 编码层级关系 (DY1 -> DY1.AH1)，源于 RDS 编码结构
    -- 'powers':    实际供电关系 (馈线柜 -> 水泵)，源于电气连接
    -- 'backup':    备用供电关系 (用于双路供电)
    
    properties JSONB,                      -- 边属性 (电缆规格、回路编号、开关状态等)
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(source_node_id, target_node_id, relation_type)
);

-- 添加表注释
COMMENT ON TABLE rds_power_edges IS '电源网络边表，存储节点间的层级和供电关系';
COMMENT ON COLUMN rds_power_edges.relation_type IS '关系类型: hierarchy=编码层级, powers=供电连接, backup=备用电源';
COMMENT ON COLUMN rds_power_edges.properties IS '边属性 JSON，如 {"cable_spec": "YJV-3x95", "circuit_no": "1"}';


-- ========================================
-- 创建索引以优化查询性能
-- ========================================

-- rds_power_nodes 索引
CREATE INDEX IF NOT EXISTS idx_power_nodes_file_id ON rds_power_nodes(file_id);
CREATE INDEX IF NOT EXISTS idx_power_nodes_full_code ON rds_power_nodes(full_code);
CREATE INDEX IF NOT EXISTS idx_power_nodes_parent_code ON rds_power_nodes(parent_code);
CREATE INDEX IF NOT EXISTS idx_power_nodes_object_id ON rds_power_nodes(object_id);
CREATE INDEX IF NOT EXISTS idx_power_nodes_level ON rds_power_nodes(level);
CREATE INDEX IF NOT EXISTS idx_power_nodes_type ON rds_power_nodes(node_type);
-- 复合索引：按文件和层级查询
CREATE INDEX IF NOT EXISTS idx_power_nodes_file_level ON rds_power_nodes(file_id, level);

-- rds_power_edges 索引
CREATE INDEX IF NOT EXISTS idx_power_edges_file_id ON rds_power_edges(file_id);
CREATE INDEX IF NOT EXISTS idx_power_edges_source ON rds_power_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_power_edges_target ON rds_power_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_power_edges_type ON rds_power_edges(relation_type);
-- 复合索引：按源节点和关系类型查询（追溯下游）
CREATE INDEX IF NOT EXISTS idx_power_edges_source_type ON rds_power_edges(source_node_id, relation_type);
-- 复合索引：按目标节点和关系类型查询（追溯上游）
CREATE INDEX IF NOT EXISTS idx_power_edges_target_type ON rds_power_edges(target_node_id, relation_type);


-- ========================================
-- 触发器：自动更新 updated_at
-- ========================================

-- rds_power_nodes 更新触发器
DROP TRIGGER IF EXISTS update_rds_power_nodes_updated_at ON rds_power_nodes;
CREATE TRIGGER update_rds_power_nodes_updated_at
    BEFORE UPDATE ON rds_power_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ========================================
-- 完成
-- ========================================
SELECT 'RDS Power Graph tables created successfully' as status;
