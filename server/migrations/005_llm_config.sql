-- LLM 配置扩展
-- 为 system_config 表添加 LLM 相关配置项

INSERT INTO system_config (config_key, config_value, description, is_encrypted)
VALUES 
    ('LLM_PROVIDER', 'gemini', 'LLM 服务提供商 (gemini/qwen/deepseek)', FALSE),
    ('LLM_API_KEY', '', 'LLM API Key', TRUE),
    ('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/', 'OpenAI 兼容 API 基础 URL', FALSE),
    ('LLM_MODEL', 'gemini-2.0-flash', '选择的模型名称', FALSE)
ON CONFLICT (config_key) DO NOTHING;

-- 清理旧的 GEMINI_API_KEY（如果存在），迁移到新的 LLM_API_KEY
-- 注意：这是一个可选的迁移步骤，可以手动执行
-- UPDATE system_config SET config_value = (SELECT config_value FROM system_config WHERE config_key = 'GEMINI_API_KEY') WHERE config_key = 'LLM_API_KEY';
