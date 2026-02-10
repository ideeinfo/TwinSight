<!--
  @deprecated 此组件已弃用，请使用 SystemConfigPanel.vue
  LLM 配置已整合到系统配置中心。此文件保留用于参考，将在后续版本中删除。
-->
<template>
  <el-dialog
    v-model="visible"
    title="AI 服务配置"
    width="500px"
    class="custom-dialog llm-config-dialog"
    :close-on-click-modal="false"
  >
    <div class="llm-config-form">
      <!-- 服务提供商 -->
      <div class="form-item">
        <label class="form-label">服务提供商</label>
        <el-select
          v-model="formData.provider"
          placeholder="选择服务提供商"
          class="form-select"
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
          v-model="formData.baseUrl"
          placeholder="OpenAI 兼容 API 端点"
          class="form-input"
          readonly
        />
        <span class="form-hint">根据提供商自动填充，不可修改</span>
      </div>

      <!-- API Key -->
      <div class="form-item">
        <label class="form-label">API Key</label>
        <div class="input-with-action">
          <el-input
            v-model="formData.apiKey"
            :type="showApiKey ? 'text' : 'password'"
            :placeholder="config?.apiKeyMasked || '请输入 API Key'"
            class="form-input"
          >
            <template #suffix>
              <el-icon class="eye-icon" @click="showApiKey = !showApiKey">
                <View v-if="!showApiKey" />
                <Hide v-else />
              </el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            :loading="loadingModels"
            :disabled="!formData.apiKey && !config?.hasApiKey"
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
          v-model="formData.model"
          placeholder="请先获取模型列表"
          class="form-select"
          :disabled="models.length === 0"
          filterable
        >
          <el-option
            v-for="model in models"
            :key="model.id"
            :value="model.id"
            :label="model.name"
          />
        </el-select>
        <span v-if="models.length > 0" class="form-hint">
          共 {{ models.length }} 个可用模型
        </span>
      </div>

      <!-- 测试结果 -->
      <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
        <el-icon>
          <CircleCheck v-if="testResult.success" />
          <CircleClose v-else />
        </el-icon>
        <span>{{ testResult.message }}</span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          :loading="testingConnection"
          :disabled="!formData.model"
          @click="handleTestConnection"
        >
          测试连接
        </el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存配置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { View, Hide, CircleCheck, CircleClose } from '@element-plus/icons-vue';
import {
  getLLMProviders,
  getLLMConfig,
  updateLLMConfig,
  fetchLLMModels,
  testLLMConnection,
  type LLMProvider,
  type LLMConfig,
  type LLMModel
} from '../api/llm-config';

// Props & Emits
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

// 对话框显示状态
const visible = ref(props.modelValue);
watch(() => props.modelValue, (val) => { visible.value = val; });
watch(visible, (val) => { emit('update:modelValue', val); });

// 数据状态
const providers = ref<LLMProvider[]>([]);
const config = ref<LLMConfig | null>(null);
const models = ref<LLMModel[]>([]);

// 表单数据
const formData = ref({
  provider: 'gemini',
  baseUrl: '',
  apiKey: '',
  model: ''
});

// UI 状态
const showApiKey = ref(false);
const loadingModels = ref(false);
const testingConnection = ref(false);
const saving = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// 加载提供商列表
async function loadProviders() {
  try {
    providers.value = await getLLMProviders();
  } catch (error) {
    console.error('加载提供商列表失败:', error);
  }
}

// 加载当前配置
async function loadConfig() {
  try {
    config.value = await getLLMConfig();
    formData.value.provider = config.value.provider || 'gemini';
    formData.value.baseUrl = config.value.baseUrl;
    formData.value.model = config.value.model;
    // API Key 不加载实际值，用户需要重新输入才会更新
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 切换提供商
function handleProviderChange(providerId: string) {
  const provider = providers.value.find(p => p.id === providerId);
  if (provider) {
    formData.value.baseUrl = provider.baseUrl;
    // 切换提供商后清空模型列表
    models.value = [];
    formData.value.model = '';
    testResult.value = null;
  }
}

// 获取模型列表
async function handleFetchModels() {
  const apiKey = formData.value.apiKey || (config.value?.hasApiKey ? '__USE_SAVED__' : '');
  if (!apiKey) {
    ElMessage.warning('请先输入 API Key');
    return;
  }

  loadingModels.value = true;
  testResult.value = null;

  try {
    // 如果用户没有输入新的 API Key，使用保存的
    const effectiveApiKey = formData.value.apiKey || '';
    models.value = await fetchLLMModels(
      formData.value.provider,
      effectiveApiKey,
      formData.value.baseUrl
    );
    if (models.value.length > 0) {
      ElMessage.success(`成功获取 ${models.value.length} 个模型`);
      // 如果之前有选中的模型且仍在列表中，保持选中
      if (formData.value.model && !models.value.find(m => m.id === formData.value.model)) {
        formData.value.model = '';
      }
    } else {
      ElMessage.warning('未找到可用模型');
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取模型列表失败');
  } finally {
    loadingModels.value = false;
  }
}

// 测试连接
async function handleTestConnection() {
  if (!formData.value.model) {
    ElMessage.warning('请先选择模型');
    return;
  }

  testingConnection.value = true;
  testResult.value = null;

  try {
    const result = await testLLMConnection(
      formData.value.provider,
      formData.value.apiKey,
      formData.value.baseUrl,
      formData.value.model
    );
    testResult.value = { success: true, message: result.message };
  } catch (error: any) {
    testResult.value = { success: false, message: error.message || '连接失败' };
  } finally {
    testingConnection.value = false;
  }
}

// 保存配置
async function handleSave() {
  saving.value = true;

  try {
    const updateData: Parameters<typeof updateLLMConfig>[0] = {
      provider: formData.value.provider,
      baseUrl: formData.value.baseUrl,
      model: formData.value.model
    };
    
    // 只有用户输入了新的 API Key 才更新
    if (formData.value.apiKey) {
      updateData.apiKey = formData.value.apiKey;
    }

    await updateLLMConfig(updateData);
    ElMessage.success('配置已保存');
    
    // 重新加载配置
    await loadConfig();
    
    visible.value = false;
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

// 初始化
onMounted(async () => {
  await loadProviders();
  await loadConfig();
  
  // 设置默认 baseUrl
  if (!formData.value.baseUrl && providers.value.length > 0) {
    const defaultProvider = providers.value.find(p => p.id === formData.value.provider);
    if (defaultProvider) {
      formData.value.baseUrl = defaultProvider.baseUrl;
    }
  }
});
</script>

<style scoped>
.llm-config-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.form-select,
.form-input {
  width: 100%;
}

.form-hint {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.input-with-action {
  display: flex;
  gap: 8px;
}

.input-with-action .form-input {
  flex: 1;
}

.eye-icon {
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
  transition: color 0.2s;
}

.eye-icon:hover {
  color: var(--md-sys-color-primary);
}

.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
}

.test-result.success {
  background: color-mix(in srgb, var(--md-sys-color-primary) 15%, transparent);
  color: var(--md-sys-color-primary);
}

.test-result.error {
  background: color-mix(in srgb, var(--md-sys-color-error) 15%, transparent);
  color: var(--md-sys-color-error);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
