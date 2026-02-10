/**
 * 系统配置 API 路由
 * 用于管理 LLM、InfluxDB 等系统级配置
 */
import { Router } from 'express';
import pool from '../../db/index.js';
import { getConfig, setConfig, getAllConfigs, getConfigRaw, batchSetConfigs, clearConfigCache } from '../../services/config-service.js';

const router = Router();

/**
 * GET /api/v1/system-config
 * 获取所有配置（按分类分组）
 */
router.get('/', async (req, res) => {
    try {
        const configs = await getAllConfigs();

        // 按分类分组
        const grouped = {};
        for (const config of configs) {
            const category = config.category || 'general';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            // 对于加密字段，只返回脱敏值
            grouped[category].push({
                key: config.config_key,
                value: config.config_value,
                label: config.label,
                description: config.description,
                type: config.config_type || 'string',
                isEncrypted: config.is_encrypted,
                sortOrder: config.sort_order
            });
        }

        res.json({ success: true, data: grouped });
    } catch (error) {
        console.error('获取系统配置失败:', error);
        res.status(500).json({ success: false, error: '获取配置失败' });
    }
});

/**
 * GET /api/v1/system-config/:category
 * 获取指定分类的配置
 */
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;

        // 如果是 llm 分类，使用原有的特殊处理
        if (category === 'llm') {
            return router.handle(req, res, () => { });
        }

        const configs = await getAllConfigs(category);

        const data = configs.map(config => ({
            key: config.config_key,
            value: config.config_value,
            label: config.label,
            description: config.description,
            type: config.config_type || 'string',
            isEncrypted: config.is_encrypted,
            sortOrder: config.sort_order
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error('获取系统配置失败:', error);
        res.status(500).json({ success: false, error: '获取配置失败' });
    }
});

/**
 * POST /api/v1/system-config
 * 批量更新配置
 */
router.post('/', async (req, res) => {
    try {
        const { configs } = req.body;

        if (!configs || !Array.isArray(configs)) {
            return res.status(400).json({ success: false, error: '请提供配置数组' });
        }

        const success = await batchSetConfigs(configs);

        if (success) {
            res.json({ success: true, message: '配置已更新' });
        } else {
            res.status(500).json({ success: false, error: '更新配置失败' });
        }
    } catch (error) {
        console.error('批量更新配置失败:', error);
        res.status(500).json({ success: false, error: '更新配置失败' });
    }
});

/**
 * POST /api/v1/system-config/test-influx
 * 测试 InfluxDB 连接
 */
router.post('/test-influx', async (req, res) => {
    try {
        const { url, port, org, bucket, token } = req.body;

        // 使用传入的值或从数据库获取
        const influxUrl = url || await getConfigRaw('INFLUXDB_URL');
        const influxPort = port || await getConfigRaw('INFLUXDB_PORT');
        const influxOrg = org || await getConfigRaw('INFLUXDB_ORG');
        const influxToken = token || await getConfigRaw('INFLUXDB_TOKEN');

        if (!influxUrl || !influxToken) {
            return res.status(400).json({
                success: false,
                error: '请提供 InfluxDB URL 和 Token'
            });
        }

        // 构建完整 URL
        const baseUrl = influxPort ? `${influxUrl}:${influxPort}` : influxUrl;

        // 使用 /api/v2/buckets 端点测试，该端点需要有效认证
        const testUrl = `${baseUrl}/api/v2/buckets?limit=1`;

        console.log(`🧪 测试 InfluxDB 连接 (验证 Token): ${testUrl}`);

        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${influxToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ InfluxDB 连接测试成功，找到', data.buckets?.length || 0, '个 Bucket');
            res.json({
                success: true,
                message: '连接成功',
                data: {
                    status: 'healthy',
                    bucketsFound: data.buckets?.length || 0
                }
            });
        } else {
            const errorText = await response.text();
            console.error('❌ InfluxDB 连接测试失败:', response.status, errorText);

            // 提供更友好的错误信息
            let errorMsg = `连接失败: ${response.status}`;
            if (response.status === 401) {
                errorMsg = 'Token 无效或权限不足';
            } else if (response.status === 403) {
                errorMsg = 'Token 权限不足，无法访问 Buckets';
            }

            res.status(response.status).json({
                success: false,
                error: errorMsg
            });
        }
    } catch (error) {
        console.error('❌ InfluxDB 连接测试异常:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/system-config/test-openwebui
 * 测试 Open WebUI 连接
 */
router.post('/test-openwebui', async (req, res) => {
    try {
        const { url, apiKey: providedApiKey } = req.body;

        // 使用传入的值或从数据库获取
        const openwebuiUrl = url || await getConfigRaw('OPENWEBUI_URL');
        let apiKey = providedApiKey;
        if (!apiKey) {
            apiKey = await getConfigRaw('OPENWEBUI_API_KEY');
        }

        if (!openwebuiUrl) {
            return res.status(400).json({
                success: false,
                error: '请提供 Open WebUI 地址'
            });
        }

        // 使用 /health 端点检查连接（无需认证）
        const baseUrl = openwebuiUrl.replace(/\/$/, '');
        const testUrl = `${baseUrl}/health`;

        console.log(`🧪 测试 Open WebUI 连接: ${testUrl}`);

        const response = await fetch(testUrl, {
            method: 'GET'
        });

        if (response.ok) {
            const text = await response.text();
            console.log('✅ Open WebUI 连接测试成功:', text);
            res.json({
                success: true,
                message: '连接成功',
                data: {
                    status: text === 'true' ? 'healthy' : text
                }
            });
        } else {
            const errorText = await response.text();
            console.error('❌ Open WebUI 连接测试失败:', response.status, errorText);
            res.status(response.status).json({
                success: false,
                error: `连接失败: ${response.status}`
            });
        }
    } catch (error) {
        console.error('❌ Open WebUI 连接测试异常:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/system-config/test-n8n
 * 测试 n8n Webhook 连接
 */
router.post('/test-n8n', async (req, res) => {
    try {
        const { webhookUrl, apiKey: providedApiKey } = req.body;

        // 使用传入的值或从数据库获取
        const n8nUrl = webhookUrl || await getConfigRaw('N8N_WEBHOOK_URL');
        let apiKey = providedApiKey;
        if (!apiKey) {
            apiKey = await getConfigRaw('N8N_API_KEY');
        }

        if (!n8nUrl) {
            return res.status(400).json({
                success: false,
                error: '请提供 n8n Webhook 地址'
            });
        }

        const baseUrl = n8nUrl.replace(/\/$/, '');

        // 如果提供了 API Key，尝试验证 API 权限
        if (apiKey) {
            const userUrl = `${baseUrl}/api/v1/users`;
            console.log(`🧪 测试 n8n API 连接: ${userUrl}`);

            const response = await fetch(userUrl, {
                method: 'GET',
                headers: {
                    'X-N8N-API-KEY': apiKey
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ n8n API Key 验证成功');
                return res.json({
                    success: true,
                    message: '连接成功 (API Key 有效)',
                    data: { status: 'authenticated' }
                });
            } else {
                console.warn('⚠️ n8n API Key 验证失败，尝试仅检查服务健康状态...');
            }
        }

        // 回退到健康检查
        const healthUrl = `${baseUrl}/healthz`;
        console.log(`🧪 测试 n8n 服务健康状态: ${healthUrl}`);

        const response = await fetch(healthUrl, { method: 'GET' });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ n8n 服务连接成功:', data);
            res.json({
                success: true,
                message: apiKey
                    ? '服务连接成功 (但 API Key 可能无效)'
                    : '服务连接成功 (未配置 API Key，无法获取工作流列表)',
                data: {
                    status: data.status || 'ok',
                    apiKeyValid: false
                }
            });
        } else {
            const errorText = await response.text();
            console.error('❌ n8n 连接测试失败:', response.status, errorText);
            res.status(response.status).json({
                success: false,
                error: `连接失败: ${response.status}`
            });
        }
    } catch (error) {
        console.error('❌ n8n 连接测试异常:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 预置 LLM 提供商配置
const LLM_PROVIDERS = {
    gemini: {
        name: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        modelsEndpoint: '/models'
    },
    qwen: {
        name: '通义千问 (Qwen)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        modelsEndpoint: '/models'
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        modelsEndpoint: '/models'
    }
};

/**
 * GET /api/v1/system-config/llm/providers
 * 获取预置的 LLM 提供商列表
 */
router.get('/llm/providers', (req, res) => {
    const providers = Object.entries(LLM_PROVIDERS).map(([key, value]) => ({
        id: key,
        name: value.name,
        baseUrl: value.baseUrl
    }));
    res.json({ success: true, data: providers });
});

/**
 * GET /api/v1/system-config/llm
 * 获取 LLM 配置（API Key 只返回是否已配置）
 */
router.get('/llm', async (req, res) => {
    try {
        const provider = await getConfig('LLM_PROVIDER', 'gemini');
        const apiKey = await getConfig('LLM_API_KEY', '');
        const baseUrl = await getConfig('LLM_BASE_URL', LLM_PROVIDERS.gemini.baseUrl);
        const model = await getConfig('LLM_MODEL', '');

        res.json({
            success: true,
            data: {
                provider,
                hasApiKey: !!apiKey,
                apiKeyMasked: apiKey ? '••••••••' + apiKey.slice(-4) : '',
                baseUrl,
                model
            }
        });
    } catch (error) {
        console.error('获取 LLM 配置失败:', error);
        res.status(500).json({ success: false, error: '获取配置失败' });
    }
});

/**
 * PUT /api/v1/system-config/llm
 * 更新 LLM 配置
 */
router.put('/llm', async (req, res) => {
    try {
        const { provider, apiKey, baseUrl, model } = req.body;

        if (provider) {
            await setConfig('LLM_PROVIDER', provider, 'LLM 服务提供商');
        }
        if (apiKey !== undefined) {
            await setConfig('LLM_API_KEY', apiKey, 'LLM API Key');
        }
        if (baseUrl) {
            await setConfig('LLM_BASE_URL', baseUrl, 'OpenAI 兼容 API 基础 URL');
        }
        if (model !== undefined) {
            await setConfig('LLM_MODEL', model, '选择的模型名称');
        }

        // 清除缓存
        clearConfigCache();

        res.json({ success: true, message: 'LLM 配置已更新' });
    } catch (error) {
        console.error('更新 LLM 配置失败:', error);
        res.status(500).json({ success: false, error: '更新配置失败' });
    }
});

/**
 * POST /api/v1/system-config/llm/models
 * 获取指定提供商的模型列表
 */
router.post('/llm/models', async (req, res) => {
    try {
        const { provider, apiKey: providedApiKey, baseUrl } = req.body;

        // 如果没有提供 API Key，从数据库读取
        let apiKey = providedApiKey;
        if (!apiKey) {
            apiKey = await getConfigRaw('LLM_API_KEY');
        }

        if (!apiKey) {
            return res.status(400).json({ success: false, error: '请提供 API Key' });
        }

        const effectiveBaseUrl = baseUrl || (LLM_PROVIDERS[provider]?.baseUrl);
        if (!effectiveBaseUrl) {
            return res.status(400).json({ success: false, error: '无效的提供商或 URL' });
        }

        // 构建模型列表 API URL
        const modelsUrl = effectiveBaseUrl.replace(/\/$/, '') + '/models';

        console.log(`📡 获取模型列表: ${modelsUrl}`);

        const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('获取模型列表失败:', response.status, errorText);
            return res.status(response.status).json({
                success: false,
                error: `获取模型列表失败: ${response.status}`
            });
        }

        const result = await response.json();

        // 解析模型列表（OpenAI 格式）
        let models = [];
        if (result.data && Array.isArray(result.data)) {
            models = result.data.map(m => ({
                id: m.id,
                name: m.id,
                owned_by: m.owned_by || provider
            }));
        } else if (result.models && Array.isArray(result.models)) {
            // Gemini 格式
            models = result.models.map(m => ({
                id: m.name || m.id,
                name: m.displayName || m.name || m.id,
                owned_by: 'google'
            }));
        }

        // 过滤出适合聊天的模型
        const chatModels = models.filter(m => {
            const id = m.id.toLowerCase();
            // 排除 embedding、vision-only 等非聊天模型
            return !id.includes('embedding') &&
                !id.includes('whisper') &&
                !id.includes('tts') &&
                !id.includes('dall-e');
        });

        res.json({ success: true, data: chatModels });
    } catch (error) {
        console.error('获取模型列表异常:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/system-config/llm/test
 * 测试 LLM 连接
 */
router.post('/llm/test', async (req, res) => {
    try {
        const { provider, apiKey: providedApiKey, baseUrl, model } = req.body;

        if (!model) {
            return res.status(400).json({ success: false, error: '请提供模型名称' });
        }

        // 如果没有提供 API Key，从数据库读取
        let apiKey = providedApiKey;
        if (!apiKey) {
            apiKey = await getConfigRaw('LLM_API_KEY');
        }

        if (!apiKey) {
            return res.status(400).json({ success: false, error: '请提供 API Key' });
        }

        const effectiveBaseUrl = baseUrl || (LLM_PROVIDERS[provider]?.baseUrl);
        if (!effectiveBaseUrl) {
            return res.status(400).json({ success: false, error: '无效的提供商或 URL' });
        }

        // 构建聊天 API URL
        const chatUrl = effectiveBaseUrl.replace(/\/$/, '') + '/chat/completions';

        console.log(`🧪 测试 LLM 连接: ${chatUrl}, 模型: ${model}`);

        const response = await fetch(chatUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LLM 连接测试失败:', response.status, errorText);
            return res.status(response.status).json({
                success: false,
                error: `连接测试失败: ${response.status}`
            });
        }

        const result = await response.json();
        console.log('✅ LLM 连接测试成功');

        res.json({
            success: true,
            message: '连接测试成功',
            response: result.choices?.[0]?.message?.content || '(无响应内容)'
        });
    } catch (error) {
        console.error('LLM 连接测试异常:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
