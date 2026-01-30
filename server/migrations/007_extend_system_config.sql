-- 系统配置表扩展 - 添加分类和类型支持
-- 用于统一管理 InfluxDB、LLM 等配置

-- 添加新字段
ALTER TABLE system_config 
ADD COLUMN IF NOT EXISTS config_type VARCHAR(20) DEFAULT 'string',
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general',
ADD COLUMN IF NOT EXISTS label VARCHAR(100),
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 更新现有 AI 配置的 category、label 和 sort_order
UPDATE system_config SET 
    category = 'ai', 
    label = 'Google Gemini API Key', 
    config_type = CASE WHEN is_encrypted THEN 'secret' ELSE 'string' END,
    sort_order = 10 
WHERE config_key = 'GEMINI_API_KEY';

UPDATE system_config SET 
    category = 'ai', 
    label = 'n8n Webhook 地址', 
    config_type = 'string',
    sort_order = 7 
WHERE config_key = 'N8N_WEBHOOK_URL';

UPDATE system_config SET 
    category = 'ai', 
    label = 'LLM 提供商', 
    config_type = 'string',
    sort_order = 1 
WHERE config_key = 'LLM_PROVIDER';

UPDATE system_config SET 
    category = 'ai', 
    label = 'API Key', 
    config_type = 'secret',
    sort_order = 3 
WHERE config_key = 'LLM_API_KEY';

UPDATE system_config SET 
    category = 'ai', 
    label = 'API 基础 URL', 
    config_type = 'string',
    sort_order = 2 
WHERE config_key = 'LLM_BASE_URL';

UPDATE system_config SET 
    category = 'ai', 
    label = '默认模型', 
    config_type = 'string',
    sort_order = 4 
WHERE config_key = 'LLM_MODEL';

-- 插入 InfluxDB 配置项
INSERT INTO system_config (config_key, config_value, config_type, category, label, description, is_encrypted, sort_order) VALUES
('INFLUXDB_URL', 'http://localhost', 'string', 'influxdb', '服务器地址', 'InfluxDB 服务器 URL', false, 1),
('INFLUXDB_PORT', '8086', 'number', 'influxdb', '端口', 'InfluxDB 服务器端口', false, 2),
('INFLUXDB_ORG', 'demo', 'string', 'influxdb', '组织', 'InfluxDB 组织名称', false, 3),
('INFLUXDB_BUCKET', 'twinsight', 'string', 'influxdb', 'Bucket 名称', '全局 Bucket 名称，所有模型共用', false, 4),
('INFLUXDB_TOKEN', '', 'secret', 'influxdb', 'API Token', 'InfluxDB 认证 Token', true, 5),
('INFLUXDB_ENABLED', 'true', 'boolean', 'influxdb', '启用时序数据', '是否启用时序数据功能', false, 6)
ON CONFLICT (config_key) DO NOTHING;

-- 插入其他 AI 配置项（如果不存在）
INSERT INTO system_config (config_key, config_value, config_type, category, label, description, is_encrypted, sort_order) VALUES
('OPENWEBUI_URL', '', 'string', 'ai', 'Open WebUI 地址', 'Open WebUI 服务地址', false, 5),
('OPENWEBUI_API_KEY', '', 'secret', 'ai', 'Open WebUI API Key', 'Open WebUI 认证密钥', true, 6),
('USE_N8N', 'false', 'boolean', 'ai', '启用 n8n 工作流', '是否使用 n8n 工作流处理', false, 8)
ON CONFLICT (config_key) DO NOTHING;

-- 创建分类索引
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);
