/**
 * 系统配置 API 路由
 * 用于管理 LLM 等系统级配置
 */
import { Router } from 'express';
import pool from '../../db/index.js';
import { getConfig, setConfig, getAllConfigs, clearConfigCache } from '../../services/config-service.js';

const router = Router();

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
        const { provider, apiKey, baseUrl } = req.body;

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
        const { provider, apiKey, baseUrl, model } = req.body;

        if (!apiKey || !model) {
            return res.status(400).json({ success: false, error: '请提供 API Key 和模型' });
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
