<template>
  <div class="config-form">
    <div class="section-desc">
      <p>{{ t('system.config.workflow.description') }}</p>
    </div>
    
    <!-- n8n URL -->
    <div class="form-item">
      <label class="form-label">{{ t('system.config.workflow.url') }}</label>
      <el-input
        v-model="config.n8nWebhookUrl"
        placeholder="http://localhost:5678"
        autocomplete="off"
        name="n8n-webhook-url"
      />
      <span class="form-hint">{{ t('system.config.workflow.urlHint') }}</span>
    </div>
    
    <!-- n8n API Key -->
    <div class="form-item">
      <label class="form-label">{{ t('system.config.workflow.apiKey') }}</label>
      <el-input
        v-model="config.n8nApiKey"
        type="password"
        show-password
        :placeholder="hasApiKey ? t('system.config.workflow.apiKeyConfigured') : t('system.config.workflow.apiKeyPlaceholder')"
        autocomplete="new-password"
        name="n8n-api-key"
      />
      <span class="form-hint">{{ t('system.config.workflow.apiKeyHint') }}</span>
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
            :disabled="!config.n8nWebhookUrl"
            @click="handleTest"
        >
            {{ t('common.testConnection') }}
        </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
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

const testResult = ref(null);
const testing = ref(false);

async function handleTest() {
  testing.value = true;
  testResult.value = null;
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    const response = await fetch(`${API_BASE}/system-config/test-n8n`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        webhookUrl: config.value.n8nWebhookUrl,
        apiKey: config.value.n8nApiKey || undefined
      })
    });
    
    const result = await response.json();
    if (result.success) {
      testResult.value = {
        success: true,
        message: result.message || t('common.testSuccess')
      };
    } else {
      testResult.value = {
        success: false,
        message: result.error || t('common.testFailed')
      };
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: error.message || t('common.testFailed')
    };
  } finally {
    testing.value = false;
  }
}
</script>

<style scoped>
/* Styles moved to src/assets/styles/config-form.css */
</style>
