<template>
  <el-dialog
    v-model="visible"
    title="系统配置"
    width="720px"
    class="custom-dialog system-config-dialog"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-tabs v-model="activeTab" class="config-tabs">
      <!-- InfluxDB 配置 -->
      <el-tab-pane label="时序数据库" name="influxdb">
        <div class="config-form">
          <div class="form-item">
            <label class="form-label">服务器地址</label>
            <el-input
              v-model="influxForm.url"
              placeholder="http://localhost"
            />
          </div>
          
          <div class="form-row">
            <div class="form-item half">
              <label class="form-label">端口</label>
              <el-input-number
                v-model="influxForm.port"
                :min="1"
                :max="65535"
                controls-position="right"
                style="width: 100%"
              />
            </div>
            <div class="form-item half">
              <label class="form-label">组织</label>
              <el-input
                v-model="influxForm.org"
                placeholder="demo"
              />
            </div>
          </div>
          
          <div class="form-item">
            <label class="form-label">Bucket 名称</label>
            <el-input
              v-model="influxForm.bucket"
              placeholder="twinsight"
            />
            <span class="form-hint">全局 Bucket，所有模型数据通过 Tag 区分</span>
          </div>
          
          <div class="form-item">
            <label class="form-label">API Token</label>
            <el-input
              v-model="influxForm.token"
              type="password"
              show-password
              :placeholder="influxHasToken ? '已配置，留空保持不变' : '请输入 Token'"
            />
          </div>
          
          <div class="form-item">
            <el-switch
              v-model="influxForm.enabled"
              active-text="启用时序数据"
            />
          </div>
          
          <!-- 测试结果 -->
          <div v-if="influxTestResult" class="test-result" :class="influxTestResult.success ? 'success' : 'error'">
            <el-icon>
              <CircleCheck v-if="influxTestResult.success" />
              <CircleClose v-else />
            </el-icon>
            <span>{{ influxTestResult.message }}</span>
          </div>
        </div>
      </el-tab-pane>
      
      <!-- LLM 模型配置 -->
      <el-tab-pane label="LLM 模型" name="llm">
        <div class="config-form">
          <!-- LLM 提供商 -->
          <div class="form-item">
            <label class="form-label">服务提供商</label>
            <el-select
              v-model="aiForm.provider"
              placeholder="选择服务提供商"
              style="width: 100%"
              @change="handleProviderChange"
            >
              <el-option
                v-for="provider in providers"
                :key="provider.id"
                :value="provider.id"
                :label="provider.name"
              />
            </el-select>
          </div>
          
          <!-- API 基础 URL -->
          <div class="form-item">
            <label class="form-label">API 基础 URL</label>
            <el-input
              v-model="aiForm.baseUrl"
              placeholder="OpenAI 兼容 API 端点"
              readonly
            />
            <span class="form-hint">根据提供商自动填充，不可修改</span>
          </div>
          
          <!-- API Key -->
          <div class="form-item">
            <label class="form-label">API Key</label>
            <div class="input-with-action">
              <el-input
                v-model="aiForm.apiKey"
                type="password"
                show-password
                :placeholder="aiHasApiKey ? '已配置，留空保持不变' : '请输入 API Key'"
              />
              <el-button
                type="primary"
                :loading="loadingModels"
                :disabled="!aiForm.apiKey && !aiHasApiKey"
                @click="handleFetchModels"
              >
                获取模型
              </el-button>
            </div>
          </div>
          
          <!-- 模型选择 -->
          <div class="form-item">
            <label class="form-label">模型选择</label>
            <el-select
              v-model="aiForm.model"
              placeholder="请先获取模型列表"
              style="width: 100%"
              filterable
              allow-create
              default-first-option
            >
              <el-option
                v-for="model in displayModels"
                :key="model.id"
                :value="model.id"
                :label="model.name"
              />
            </el-select>
            <span v-if="models.length > 0" class="form-hint">
              共 {{ models.length }} 个可用模型
            </span>
            <span v-else-if="aiForm.model" class="form-hint">
              当前使用: {{ aiForm.model }}
            </span>
          </div>
          
          <!-- 测试结果 -->
          <div v-if="aiTestResult" class="test-result" :class="aiTestResult.success ? 'success' : 'error'">
            <el-icon>
              <CircleCheck v-if="aiTestResult.success" />
              <CircleClose v-else />
            </el-icon>
            <span>{{ aiTestResult.message }}</span>
          </div>
        </div>
      </el-tab-pane>
      
      <!-- 知识库 (Open WebUI) -->
      <el-tab-pane label="知识库" name="knowledge">
        <div class="config-form">
          <div class="section-desc">
            <p>Open WebUI 用于管理知识库和文档，实现 RAG 检索增强生成。</p>
          </div>
          
          <!-- Open WebUI URL -->
          <div class="form-item">
            <label class="form-label">Open WebUI 地址</label>
            <el-input
              v-model="aiForm.openwebuiUrl"
              placeholder="http://localhost:8080"
            />
          </div>
          
          <!-- Open WebUI API Key -->
          <div class="form-item">
            <label class="form-label">API Key</label>
            <el-input
              v-model="aiForm.openwebuiApiKey"
              type="password"
              show-password
              :placeholder="openwebuiHasApiKey ? '已配置，留空保持不变' : '请输入 API Key'"
            />
          </div>
          
          <!-- 测试结果 -->
          <div v-if="openwebuiTestResult" class="test-result" :class="openwebuiTestResult.success ? 'success' : 'error'">
            <el-icon>
              <CircleCheck v-if="openwebuiTestResult.success" />
              <CircleClose v-else />
            </el-icon>
            <span>{{ openwebuiTestResult.message }}</span>
          </div>
        </div>
      </el-tab-pane>
      
      <!-- AI 工作流 (n8n) -->
      <el-tab-pane label="AI 工作流" name="workflow">
        <div class="config-form">
          <div class="section-desc">
            <p>n8n 工作流用于自动化处理 AI 任务，如文档分析、智能分类等。</p>
          </div>
          
          <!-- n8n Switch -->
          <div class="form-item">
            <el-switch
              v-model="aiForm.useN8n"
              active-text="启用 n8n 工作流"
            />
          </div>
          
          <!-- n8n Webhook URL -->
          <div class="form-item">
            <label class="form-label">Webhook 地址</label>
            <el-input
              v-model="aiForm.n8nWebhookUrl"
              placeholder="http://localhost:5678"
              :disabled="!aiForm.useN8n"
            />
            <span class="form-hint">n8n 的 Webhook 触发器 URL</span>
          </div>
          
          <!-- 测试结果 -->
          <div v-if="n8nTestResult" class="test-result" :class="n8nTestResult.success ? 'success' : 'error'">
            <el-icon>
              <CircleCheck v-if="n8nTestResult.success" />
              <CircleClose v-else />
            </el-icon>
            <span>{{ n8nTestResult.message }}</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button
          v-if="activeTab === 'influxdb'"
          :loading="testingInflux"
          @click="handleTestInflux"
        >
          测试连接
        </el-button>
        <el-button
          v-if="activeTab === 'llm'"
          :loading="testingAi"
          :disabled="!aiForm.model"
          @click="handleTestAi"
        >
          测试连接
        </el-button>
        <el-button
          v-if="activeTab === 'knowledge'"
          :loading="testingOpenwebui"
          :disabled="!aiForm.openwebuiUrl"
          @click="handleTestOpenwebui"
        >
          测试连接
        </el-button>
        <el-button
          v-if="activeTab === 'workflow'"
          :loading="testingN8n"
          :disabled="!aiForm.n8nWebhookUrl || !aiForm.useN8n"
          @click="handleTestN8n"
        >
          测试连接
        </el-button>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存配置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { CircleCheck, CircleClose } from '@element-plus/icons-vue';

// Props & Emits
const props = defineProps({
  modelValue: Boolean
});
const emit = defineEmits(['update:modelValue']);

// 对话框显示状态
const visible = ref(props.modelValue);
watch(() => props.modelValue, (val) => { visible.value = val; });
watch(visible, (val) => { emit('update:modelValue', val); });

// Tab 状态
const activeTab = ref('influxdb');

// InfluxDB 表单
const influxForm = ref({
  url: '',
  port: 8086,
  org: '',
  bucket: '',
  token: '',
  enabled: true
});
const influxHasToken = ref(false);
const influxTestResult = ref(null);
const testingInflux = ref(false);

// AI 表单
const aiForm = ref({
  provider: 'qwen',
  baseUrl: '',
  apiKey: '',
  model: '',
  openwebuiUrl: '',
  openwebuiApiKey: '',
  useN8n: false,
  n8nWebhookUrl: ''
});
const aiHasApiKey = ref(false);
const openwebuiHasApiKey = ref(false);
const aiTestResult = ref(null);
const testingAi = ref(false);
const loadingModels = ref(false);
const models = ref([]);

// Open WebUI 测试
const openwebuiTestResult = ref(null);
const testingOpenwebui = ref(false);

// n8n 测试
const n8nTestResult = ref(null);
const testingN8n = ref(false);

// LLM 提供商列表
const providers = ref([]);

// 保存状态
const saving = ref(false);

// API 基础 URL
const API_BASE = '/api/v1';

// 显示的模型列表（包含已保存的模型）
const displayModels = computed(() => {
  const list = [...models.value];
  // 如果已保存的模型不在列表中，添加到开头
  if (aiForm.value.model && !list.find(m => m.id === aiForm.value.model)) {
    list.unshift({ id: aiForm.value.model, name: aiForm.value.model });
  }
  return list;
});

// 加载配置
async function loadConfigs() {
  try {
    // 加载所有配置
    const response = await fetch(`${API_BASE}/system-config`);
    const result = await response.json();
    
    if (result.success) {
      const { influxdb, ai } = result.data;
      
      // InfluxDB 配置
      if (influxdb) {
        for (const cfg of influxdb) {
          switch (cfg.key) {
            case 'INFLUXDB_URL':
              influxForm.value.url = cfg.value || '';
              break;
            case 'INFLUXDB_PORT':
              influxForm.value.port = parseInt(cfg.value) || 8086;
              break;
            case 'INFLUXDB_ORG':
              influxForm.value.org = cfg.value || '';
              break;
            case 'INFLUXDB_BUCKET':
              influxForm.value.bucket = cfg.value || '';
              break;
            case 'INFLUXDB_TOKEN':
              influxHasToken.value = cfg.isEncrypted && cfg.value !== '';
              break;
            case 'INFLUXDB_ENABLED':
              influxForm.value.enabled = cfg.value === 'true';
              break;
          }
        }
      }
      
      // AI 配置
      if (ai) {
        for (const cfg of ai) {
          switch (cfg.key) {
            case 'LLM_PROVIDER':
              aiForm.value.provider = cfg.value || 'qwen';
              break;
            case 'LLM_BASE_URL':
              aiForm.value.baseUrl = cfg.value || '';
              break;
            case 'LLM_API_KEY':
              aiHasApiKey.value = cfg.isEncrypted && cfg.value !== '';
              break;
            case 'LLM_MODEL':
              aiForm.value.model = cfg.value || '';
              break;
            case 'OPENWEBUI_URL':
              aiForm.value.openwebuiUrl = cfg.value || '';
              break;
            case 'OPENWEBUI_API_KEY':
              openwebuiHasApiKey.value = cfg.isEncrypted && cfg.value !== '';
              break;
            case 'N8N_WEBHOOK_URL':
              aiForm.value.n8nWebhookUrl = cfg.value || '';
              break;
            case 'USE_N8N':
              aiForm.value.useN8n = cfg.value === 'true';
              break;
          }
        }
      }
    }
    
    // 加载 LLM 提供商
    const providersRes = await fetch(`${API_BASE}/system-config/llm/providers`);
    const providersResult = await providersRes.json();
    if (providersResult.success) {
      providers.value = providersResult.data;
      
      // 设置默认 baseUrl
      if (!aiForm.value.baseUrl && providers.value.length > 0) {
        const defaultProvider = providers.value.find(p => p.id === aiForm.value.provider);
        if (defaultProvider) {
          aiForm.value.baseUrl = defaultProvider.baseUrl;
        }
      }
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    ElMessage.error('加载配置失败');
  }
}

// 切换提供商
function handleProviderChange(providerId) {
  const provider = providers.value.find(p => p.id === providerId);
  if (provider) {
    aiForm.value.baseUrl = provider.baseUrl;
    models.value = [];
    aiForm.value.model = '';
    aiTestResult.value = null;
  }
}

// 获取模型列表
async function handleFetchModels() {
  loadingModels.value = true;
  aiTestResult.value = null;
  
  try {
    const response = await fetch(`${API_BASE}/system-config/llm/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: aiForm.value.provider,
        apiKey: aiForm.value.apiKey || '',
        baseUrl: aiForm.value.baseUrl
      })
    });
    
    const result = await response.json();
    if (result.success) {
      models.value = result.data;
      ElMessage.success(`成功获取 ${models.value.length} 个模型`);
    } else {
      ElMessage.error(result.error || '获取模型列表失败');
    }
  } catch (error) {
    ElMessage.error('获取模型列表失败');
  } finally {
    loadingModels.value = false;
  }
}

// 测试 InfluxDB 连接
async function handleTestInflux() {
  testingInflux.value = true;
  influxTestResult.value = null;
  
  try {
    const response = await fetch(`${API_BASE}/system-config/test-influx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: influxForm.value.url,
        port: influxForm.value.port,
        org: influxForm.value.org,
        bucket: influxForm.value.bucket,
        token: influxForm.value.token || undefined
      })
    });
    
    const result = await response.json();
    if (result.success) {
      influxTestResult.value = {
        success: true,
        message: `连接成功 (版本: ${result.data?.version || 'unknown'})`
      };
    } else {
      influxTestResult.value = {
        success: false,
        message: result.error || '连接失败'
      };
    }
  } catch (error) {
    influxTestResult.value = {
      success: false,
      message: error.message || '连接测试失败'
    };
  } finally {
    testingInflux.value = false;
  }
}

// 测试 AI 连接
async function handleTestAi() {
  testingAi.value = true;
  aiTestResult.value = null;
  
  try {
    const response = await fetch(`${API_BASE}/system-config/llm/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: aiForm.value.provider,
        apiKey: aiForm.value.apiKey || '',
        baseUrl: aiForm.value.baseUrl,
        model: aiForm.value.model
      })
    });
    
    const result = await response.json();
    if (result.success) {
      aiTestResult.value = { success: true, message: result.message };
    } else {
      aiTestResult.value = { success: false, message: result.error || '连接失败' };
    }
  } catch (error) {
    aiTestResult.value = { success: false, message: error.message || '连接测试失败' };
  } finally {
    testingAi.value = false;
  }
}

// 测试 Open WebUI 连接
async function handleTestOpenwebui() {
  testingOpenwebui.value = true;
  openwebuiTestResult.value = null;
  
  try {
    const response = await fetch(`${API_BASE}/system-config/test-openwebui`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: aiForm.value.openwebuiUrl,
        apiKey: aiForm.value.openwebuiApiKey || undefined
      })
    });
    
    const result = await response.json();
    if (result.success) {
      openwebuiTestResult.value = {
        success: true,
        message: '连接成功'
      };
    } else {
      openwebuiTestResult.value = {
        success: false,
        message: result.error || '连接失败'
      };
    }
  } catch (error) {
    openwebuiTestResult.value = {
      success: false,
      message: error.message || '连接测试失败'
    };
  } finally {
    testingOpenwebui.value = false;
  }
}

// 测试 n8n 连接
async function handleTestN8n() {
  testingN8n.value = true;
  n8nTestResult.value = null;
  
  try {
    const response = await fetch(`${API_BASE}/system-config/test-n8n`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: aiForm.value.n8nWebhookUrl
      })
    });
    
    const result = await response.json();
    if (result.success) {
      n8nTestResult.value = {
        success: true,
        message: '连接成功'
      };
    } else {
      n8nTestResult.value = {
        success: false,
        message: result.error || '连接失败'
      };
    }
  } catch (error) {
    n8nTestResult.value = {
      success: false,
      message: error.message || '连接测试失败'
    };
  } finally {
    testingN8n.value = false;
  }
}

// 保存配置
async function handleSave() {
  saving.value = true;
  
  try {
    const configs = [];
    
    // InfluxDB 配置
    configs.push({ key: 'INFLUXDB_URL', value: influxForm.value.url });
    configs.push({ key: 'INFLUXDB_PORT', value: String(influxForm.value.port) });
    configs.push({ key: 'INFLUXDB_ORG', value: influxForm.value.org });
    configs.push({ key: 'INFLUXDB_BUCKET', value: influxForm.value.bucket });
    configs.push({ key: 'INFLUXDB_ENABLED', value: String(influxForm.value.enabled) });
    
    if (influxForm.value.token) {
      configs.push({ key: 'INFLUXDB_TOKEN', value: influxForm.value.token });
    }
    
    // LLM 配置
    configs.push({ key: 'LLM_PROVIDER', value: aiForm.value.provider });
    configs.push({ key: 'LLM_BASE_URL', value: aiForm.value.baseUrl });
    configs.push({ key: 'LLM_MODEL', value: aiForm.value.model });
    
    if (aiForm.value.apiKey) {
      configs.push({ key: 'LLM_API_KEY', value: aiForm.value.apiKey });
    }
    
    // Open WebUI 配置
    configs.push({ key: 'OPENWEBUI_URL', value: aiForm.value.openwebuiUrl });
    if (aiForm.value.openwebuiApiKey) {
      configs.push({ key: 'OPENWEBUI_API_KEY', value: aiForm.value.openwebuiApiKey });
    }
    
    // n8n 配置
    configs.push({ key: 'USE_N8N', value: String(aiForm.value.useN8n) });
    configs.push({ key: 'N8N_WEBHOOK_URL', value: aiForm.value.n8nWebhookUrl });
    
    const response = await fetch(`${API_BASE}/system-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs })
    });
    
    const result = await response.json();
    if (result.success) {
      ElMessage.success('配置已保存');
      visible.value = false;
    } else {
      ElMessage.error(result.error || '保存失败');
    }
  } catch (error) {
    ElMessage.error('保存配置失败');
  } finally {
    saving.value = false;
  }
}

// 初始化
onMounted(() => {
  loadConfigs();
});
</script>

<style scoped>
.config-tabs {
  margin-top: -10px;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 16px 4px 8px 4px;
}

.section-desc {
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 4px;
}

.section-desc p {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-item.half {
  flex: 1;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.input-with-action {
  display: flex;
  gap: 10px;
}

.input-with-action .el-input {
  flex: 1;
}

.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
}

.test-result.success {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.test-result.error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 确保 Select 下拉框正常显示 */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-select .el-input__wrapper) {
  width: 100%;
}

:deep(.el-select .el-select__selected-item) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
