<template>
  <div class="config-form">
    <div class="form-item">
      <label class="form-label">{{ t('system.config.influx.url') }}</label>
      <el-input
        v-model="config.url"
        placeholder="http://localhost:8086"
        autocomplete="off"
        name="influx-url"
      />
    </div>
    
    <div class="form-item">
      <label class="form-label">{{ t('system.config.influx.org') }}</label>
      <el-input
        v-model="config.org"
        placeholder="demo"
        autocomplete="off"
        name="influx-org"
      />
    </div>
    
    <div class="form-item">
      <label class="form-label">{{ t('system.config.influx.bucket') }}</label>
      <el-input
        v-model="config.bucket"
        placeholder="twinsight"
        autocomplete="off"
        name="influx-bucket"
      />
      <span class="form-hint">{{ t('system.config.influx.bucketHint') }}</span>
    </div>
    
    <div class="form-item">
      <label class="form-label">{{ t('system.config.influx.token') }}</label>
      <el-input
        v-model="config.token"
        type="password"
        show-password
        :placeholder="hasToken ? t('system.config.influx.tokenConfigured') : t('system.config.influx.tokenPlaceholder')"
        autocomplete="new-password"
        name="influx-token"
      />
    </div>
    
    <div class="form-item">
      <el-switch
        v-model="config.enabled"
        :active-text="t('system.config.influx.enabled')"
      />
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
            @click="handleTest"
        >
            {{ t('common.testConnection') }}
        </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CircleCheck, CircleClose } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../../stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  hasToken: {
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

const API_BASE = '/api/v1';

async function handleTest() {
  testing.value = true;
  testResult.value = null;
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    const response = await fetch(`${API_BASE}/system-config/test-influx`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: config.value.url,
        org: config.value.org,
        bucket: config.value.bucket,
        token: config.value.token || undefined
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
