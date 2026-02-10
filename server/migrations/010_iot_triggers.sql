-- Migration: 010_iot_triggers.sql
-- Description: IoT 触发器配置表

-- IoT 触发器表
CREATE TABLE IF NOT EXISTS iot_triggers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,               -- 类型: temperature, humidity, energy
    enabled BOOLEAN DEFAULT true,
    
    -- 触发条件
    condition_field VARCHAR(50) NOT NULL,     -- 监控字段
    condition_operator VARCHAR(20) NOT NULL,  -- gt, lt, eq, gte, lte
    condition_value DECIMAL(10,2) NOT NULL,   -- 阈值
    
    -- 分析配置
    analysis_engine VARCHAR(20) DEFAULT 'builtin',  -- builtin | n8n
    n8n_workflow_id VARCHAR(100),             -- n8n 工作流 ID
    n8n_webhook_path VARCHAR(200),            -- n8n webhook 路径
    
    -- UI 配置
    severity VARCHAR(20) DEFAULT 'warning',   -- warning | critical
    auto_open_chat BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_iot_triggers_type ON iot_triggers(type);
CREATE INDEX IF NOT EXISTS idx_iot_triggers_enabled ON iot_triggers(enabled);

-- 默认触发器
INSERT INTO iot_triggers (name, type, condition_field, condition_operator, condition_value, severity, analysis_engine)
VALUES 
    ('高温报警', 'temperature', 'temperature', 'gt', 26, 'warning', 'builtin'),
    ('低温报警', 'temperature', 'temperature', 'lt', 10, 'warning', 'builtin')
ON CONFLICT DO NOTHING;

-- 添加 N8N_API_KEY 到系统配置
INSERT INTO system_config (config_key, config_value, description, category, label, config_type, is_encrypted, sort_order)
VALUES ('N8N_API_KEY', '', 'n8n API Key for fetching workflows', 'ai', 'n8n API Key', 'secret', true, 9)
ON CONFLICT (config_key) DO NOTHING;
