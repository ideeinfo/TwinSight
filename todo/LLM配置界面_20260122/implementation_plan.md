# LLM API Key 统一配置界面 实施计划

## 1. 目标与背景

### 目标
创建一个统一的 LLM 配置界面，支持：
1. **预置提供商选择**：下拉列表选择 Gemini / Qwen / DeepSeek
2. **自动填充 URL**：根据选择自动显示对应的 OpenAI 兼容 API 基础 URL
3. **动态模型列表**：输入 API Key 后从服务商获取可用模型列表
4. **仅支持 OpenAI 兼容格式**：统一使用 `/v1/chat/completions` 端点

### 预置提供商信息

| 提供商 | OpenAI 兼容 API 基础 URL |
|--------|---------------------------|
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |

## 2. 设计规范检查

- [x] **Token 使用**: 使用语义化 Token
- [x] **组件选择**: 使用 Element Plus 组件
- [x] **主题支持**: 支持深色和浅色模式

## 3. 变更计划

---

### 后端服务

#### [NEW] [system-config.js](file:///d:/TwinSIght/antigravity/twinsight/server/routes/v1/system-config.js)

系统配置 API 路由：
- `GET /api/v1/system-config/llm` - 获取 LLM 配置
- `PUT /api/v1/system-config/llm` - 更新 LLM 配置
- `POST /api/v1/system-config/llm/models` - 获取模型列表（传入 provider、apiKey、baseUrl）

#### [MODIFY] [index.js](file:///d:/TwinSIght/antigravity/twinsight/server/routes/v1/index.js)

注册 `system-config` 路由。

#### [NEW] [005_llm_config.sql](file:///d:/TwinSIght/antigravity/twinsight/server/migrations/005_llm_config.sql)

```sql
INSERT INTO system_config (config_key, config_value, description, is_encrypted)
VALUES 
    ('LLM_PROVIDER', 'gemini', 'LLM 服务提供商 (gemini/qwen/deepseek)', FALSE),
    ('LLM_API_KEY', '', 'LLM API Key', TRUE),
    ('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/', 'OpenAI 兼容 API 基础 URL', FALSE),
    ('LLM_MODEL', '', '选择的模型名称', FALSE)
ON CONFLICT (config_key) DO NOTHING;
```

#### [MODIFY] [gemini-service.js → llm-service.js](file:///d:/TwinSIght/antigravity/twinsight/server/services/gemini-service.js)

重构为通用 LLM 服务，使用 OpenAI 兼容格式调用任意配置的 LLM。

---

### 前端组件

#### [NEW] [LLMConfigPanel.vue](file:///d:/TwinSIght/antigravity/twinsight/src/components/LLMConfigPanel.vue)

**UI 结构**：
```
┌─────────────────────────────────────┐
│ AI 服务配置                          │
├─────────────────────────────────────┤
│ 服务提供商: [Gemini ▼]              │
│                                     │
│ API 基础 URL:                       │
│ [https://generative...  ] [只读]   │
│                                     │
│ API Key:                            │
│ [••••••••••••••••] [获取模型↻]     │
│                                     │
│ 模型选择:                           │
│ [gemini-2.0-flash ▼]               │
│                                     │
│ [测试连接]              [保存配置] │
└─────────────────────────────────────┘
```

**交互逻辑**：
1. 切换提供商 → 自动更新 API 基础 URL
2. 输入 API Key + 点击"获取模型" → 请求后端获取模型列表
3. 选择模型 → 记录选择
4. 点击保存 → 保存所有配置

#### [NEW] [llm-config.ts](file:///d:/TwinSIght/antigravity/twinsight/src/api/llm-config.ts)

前端 API：
- `getLLMConfig()` - 获取配置
- `updateLLMConfig(config)` - 保存配置
- `fetchModels(provider, apiKey, baseUrl)` - 获取模型列表

#### [MODIFY] [UserDropdown.vue](file:///d:/TwinSIght/antigravity/twinsight/src/components/UserDropdown.vue)

添加 "AI 设置" 入口按钮。

---

## 4. 验证计划

### 手动验证

1. **配置界面**：切换提供商验证 URL 自动更新
2. **模型获取**：输入正确 API Key 后能获取模型列表
3. **保存配置**：保存后刷新页面配置仍存在
4. **AI 分析**：触发温度异常后使用配置的 LLM 正常返回结果

> [!NOTE]
> Open WebUI 和 n8n 的 LLM 配置需要在各自界面中单独修改。
