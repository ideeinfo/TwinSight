-- 系统配置表 (存储 API 密钥等敏感信息)
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description VARCHAR(255),
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

-- 插入默认配置 (API Key 需要手动设置)
INSERT INTO system_config (config_key, config_value, description, is_encrypted)
VALUES 
    ('GEMINI_API_KEY', '', 'Google Gemini Pro API Key', TRUE),
    ('N8N_WEBHOOK_URL', 'http://localhost:5678', 'n8n Webhook 基础 URL', FALSE)
ON CONFLICT (config_key) DO NOTHING;
