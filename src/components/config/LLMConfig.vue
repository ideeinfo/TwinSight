<template>
  <div class="config-form">
    <!-- LLM 提供商 -->
    <div class="form-item">
      <label class="form-label">{{ t('system.config.llm.provider') }}</label>
      <el-select
        v-model="config.provider"
        :placeholder="t('system.config.llm.providerPlaceholder')"
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
      <label class="form-label">{{ t('system.config.llm.baseUrl') }}</label>
      <el-input
        v-model="config.baseUrl"
        placeholder="OpenAI Compatible API Endpoint"
        readonly
        autocomplete="off"
        name="llm-base-url"
      />
      <span class="form-hint">{{ t('system.config.llm.baseUrlHint') }}</span>
    </div>
    
    <!-- API Key -->
    <div class="form-item">
      <label class="form-label">{{ t('system.config.llm.apiKey') }}</label>
      <div class="input-with-action">
        <el-input
          v-model="config.apiKey"
          type="password"
          show-password
          :placeholder="hasApiKey ? t('system.config.llm.apiKeyConfigured') : t('system.config.llm.apiKeyPlaceholder')"
          autocomplete="new-password"
          name="llm-api-key"
        />
        <el-button
          type="primary"
          :loading="loadingModels"
          :disabled="!config.apiKey && !hasApiKey"
          @click="handleFetchModels"
        >
          {{ t('system.config.llm.fetchModels') }}
        </el-button>
      </div>
    </div>
    
    <!-- 模型选择 -->
    <div class="form-item">
      <label class="form-label">{{ t('system.config.llm.model') }}</label>
      <el-select
        v-model="config.model"
        :placeholder="t('system.config.llm.modelPlaceholder')"
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
      <span v-if="models && models.length > 0" class="form-hint">
        {{ t('system.config.llm.availableModels', { count: models.length }) }}
      </span>
      <span v-else-if="config.model" class="form-hint">
        {{ t('system.config.llm.currentModel', { model: config.model }) }}
      </span>
    </div>
    
    <!-- 测试结果 -->
    <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
      <component :is="testResult.success ? CircleCheck : CircleClose" class="icon" />
      <span>{{ testResult.message }}</span>
    </div>

    <div class="config-actions">
        <el-button 
            type="primary" 
            :loading="testing" 
            :disabled="!config.model"
            @click="handleTest"
        >
            {{ t('common.testConnection') }}
        </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { CircleCheck, CircleClose } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../../stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();
const API_BASE = '/api/v1';

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  hasApiKey: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const config = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const providers = ref([]);
const models = ref([]);
const loadingModels = ref(false);
const testResult = ref(null);
const testing = ref(false);

const displayModels = computed(() => {
  const list = [...models.value];
  if (config.value.model && !list.find(m => m.id === config.value.model)) {
    list.unshift({ id: config.value.model, name: config.value.model });
  }
  return list;
});

// Load providers on mount
onMounted(async () => {
    try {
        const headers = { 'Content-Type': 'application/json' };
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    const response = await fetch(`${API_BASE}/system-config/llm/providers`, { headers });
        const result = await response.json();
        if (result.success) {
            providers.value = result.data;
             // Ensure baseUrl is set if empty
            if (!config.value.baseUrl && config.value.provider) {
                const p = providers.value.find(pr => pr.id === config.value.provider);
                if (p) config.value.baseUrl = p.baseUrl;
            }
        }
    } catch (e) {
        console.error('Failed to load LLM providers', e);
    }
});

function handleProviderChange(providerId) {
  const provider = providers.value.find(p => p.id === providerId);
  if (provider) {
    config.value.baseUrl = provider.baseUrl;
    models.value = [];
    config.value.model = '';
    testResult.value = null;
  }
}

async function handleFetchModels() {
  loadingModels.value = true;
  testResult.value = null;
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    const response = await fetch(`${API_BASE}/system-config/llm/models`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: config.value.provider,
        apiKey: config.value.apiKey || '',
        baseUrl: config.value.baseUrl
      })
    });
    
    const result = await response.json();
    if (result.success) {
      models.value = result.data;
      ElMessage.success(t('system.config.llm.availableModels', { count: models.value.length }));
    } else {
      ElMessage.error(result.error || t('common.saveFailed')); // Using generic fail message if fetchModels fail keys not present
    }
  } catch (error) {
    ElMessage.error(t('common.saveFailed'));
  } finally {
    loadingModels.value = false;
  }
}

async function handleTest() {
  testing.value = true;
  testResult.value = null;
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    const response = await fetch(`${API_BASE}/system-config/llm/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: config.value.provider,
        apiKey: config.value.apiKey || '',
        baseUrl: config.value.baseUrl,
        model: config.value.model
      })
    });
    
    const result = await response.json();
    if (result.success) {
      testResult.value = { success: true, message: result.message || t('common.testSuccess') };
    } else {
      testResult.value = { success: false, message: result.error || t('common.testFailed') };
    }
  } catch (error) {
    testResult.value = { success: false, message: error.message || t('common.testFailed') };
  } finally {
    testing.value = false;
  }
}
</script>

<style scoped>
/* Styles moved to src/assets/styles/config-form.css */
</style>
