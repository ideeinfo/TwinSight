<!--
  @deprecated 此组件已弃用，请使用 SystemConfigPanel.vue
  InfluxDB 配置已迁移到系统配置中心 (system_config 表)，不再支持按模型单独配置。
  此文件保留用于向后兼容，将在后续版本中删除。
-->
<template>
  <el-dialog
    :model-value="true"
    :title="'⚡ ' + t('influxConfig.title')"
    width="600px"
    :close-on-click-modal="false"
    destroy-on-close
    class="custom-dialog custom-influx-dialog"
    @close="$emit('close')"
  >
    <div class="influx-config-content">
      <!-- 连接信息 -->
      <div class="form-section">
        <h4>{{ t('influxConfig.connectionInfo') }}</h4>
        
        <div class="form-group">
          <label>{{ t('influxConfig.url') }} <span class="required">*</span></label>
          <el-input 
            v-model="form.influxUrl"
            :disabled="!authStore.hasPermission('influx:manage')" 
            placeholder="http://localhost 或 /influx"
            name="influx-url"
            autocomplete="off"
          />
        </div>
        
        <div class="form-row">
          <div class="form-group half">
            <label>{{ t('influxConfig.port') }}</label>
            <el-input 
              v-model.number="form.influxPort" 
              type="number" 
              placeholder="8086"
              name="influx-port"
              autocomplete="off"
            />
          </div>
          <div class="form-group half">
            <label>{{ t('influxConfig.org') }} <span class="required">*</span></label>
            <el-input 
              v-model="form.influxOrg" 
              placeholder="demo"
              name="influx-org"
              autocomplete="off"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>{{ t('influxConfig.bucket') }} <span class="required">*</span></label>
          <el-input 
            v-model="form.influxBucket" 
            placeholder="twinsight"
            name="influx-bucket"
            autocomplete="off"
          />
        </div>
      </div>

      <!-- 认证方式 -->
      <div class="form-section">
        <h4>{{ t('influxConfig.authentication') }}</h4>
        
        <el-radio-group v-model="form.useBasicAuth" style="margin-bottom: 16px;">
          <el-radio :value="false">Token API</el-radio>
          <el-radio :value="true">Basic Auth</el-radio>
        </el-radio-group>

        <div v-if="!form.useBasicAuth" class="form-group">
          <label>API Token</label>
          <el-input 
            v-model="form.influxToken" 
            type="password" 
            show-password
            :placeholder="hasToken ? t('influxConfig.keepExisting') : t('influxConfig.enterToken')"
            name="influx-token"
            autocomplete="new-password"
          />
        </div>

        <div v-else class="form-row">
          <div class="form-group half">
            <label>{{ t('influxConfig.username') }}</label>
            <el-input 
              v-model="form.influxUser" 
              placeholder="root"
              name="influx-user"
              autocomplete="off"
            />
          </div>
          <div class="form-group half">
            <label>{{ t('influxConfig.password') }}</label>
            <el-input 
              v-model="form.influxPassword" 
              type="password" 
              show-password
              :placeholder="hasPassword ? t('influxConfig.keepExisting') : t('influxConfig.enterPassword')"
              name="influx-password"
              autocomplete="new-password"
            />
          </div>
        </div>
      </div>

      <!-- 启用状态 -->
      <div class="form-section">
        <el-checkbox v-model="form.isEnabled">{{ t('influxConfig.enable') }}</el-checkbox>
      </div>

      <!-- 连接测试结果 (移到底部显示) -->
    </div>
      
    <template #footer>
      <div class="dialog-footer-row">
        <div class="footer-left">
          <el-button :loading="isTesting" @click="testConnection">
            {{ isTesting ? t('influxConfig.testing') : t('influxConfig.testConnection') }}
          </el-button>
          <span v-if="testResult" class="test-result-inline" :class="testResult.success ? 'success' : 'error'">
            {{ testResult.success ? '✓' : '✗' }} {{ testResult.message }}
          </span>
        </div>
        <div class="footer-right">
          <el-button @click="$emit('close')">
            {{ t('common.cancel') }}
          </el-button>
          <el-button type="primary" :loading="isSaving" :disabled="!isValid || !canManageInflux" @click="saveConfig">
            {{ isSaving ? t('common.saving') : t('common.save') }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const { t } = useI18n();

const props = defineProps({
  fileId: { type: [Number, String], required: true }
});

const emit = defineEmits(['close', 'saved']);

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

// 表单数据
const form = ref({
  influxUrl: '',
  influxPort: 8086,
  influxOrg: '',
  influxBucket: '',
  influxToken: '',
  influxUser: '',
  influxPassword: '',
  useBasicAuth: false,
  isEnabled: true
});

const isSaving = ref(false);
const isTesting = ref(false);
const testResult = ref(null);
const hasToken = ref(false);
const hasPassword = ref(false);

// 表单验证 (必须在 canManageInflux 之前定义)
const isValid = computed(() => {
  const valid = form.value.influxUrl && form.value.influxOrg && form.value.influxBucket;
  console.log('🔍 [InfluxConfigPanel] isValid 检查:', {
    influxUrl: form.value.influxUrl,
    influxOrg: form.value.influxOrg,
    influxBucket: form.value.influxBucket,
    result: valid
  });
  return valid;
});

// 调试：打印权限状态
const canManageInflux = computed(() => {
  const hasPerm = authStore.hasPermission('influx:manage');
  console.log('[InfluxConfigPanel] 权限检查:', {
    permissions: authStore.permissions,
    hasInfluxManage: hasPerm,
    isValid: isValid.value,
    user: authStore.user
  });
  return hasPerm;
});

// Helper to show alert using ElMessageBox
const showAlert = async (message, title = '') => {
  await ElMessageBox.alert(message, title || t('common.alert'), {
    confirmButtonText: t('common.confirm'),
    type: 'warning'
  });
};

// 加载现有配置
const loadConfig = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/influx-config/${props.fileId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });
    const data = await response.json();
    
    if (data.success && data.data) {
      const config = data.data;
      form.value = {
        influxUrl: config.influx_url || '',
        influxPort: config.influx_port || 8086,
        influxOrg: config.influx_org || '',
        influxBucket: config.influx_bucket || '',
        influxToken: config.influx_token || '',
        influxUser: config.influx_user || '',
        influxPassword: config.influx_password || '',
        useBasicAuth: config.use_basic_auth || false,
        isEnabled: config.is_enabled !== false
      };
      hasToken.value = config.has_token;
      hasPassword.value = config.has_password;
    }
  } catch (error) {
    console.error('加载 InfluxDB 配置失败:', error);
  }
};

// 测试连接
const testConnection = async () => {
  isTesting.value = true;
  testResult.value = null;
  
  console.log('🔧 测试连接请求:', { ...form.value, fileId: props.fileId });
  
  try {
    const response = await fetch(`${API_BASE}/api/influx-config/test/connection`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        ...form.value,
        fileId: props.fileId
      })
    });
    
    const data = await response.json();
    console.log('🔧 测试连接响应:', data);
    
    // 处理不同的响应格式
    if (data.data) {
      testResult.value = data.data;
    } else if (data.error) {
      testResult.value = {
        success: false,
        message: data.error
      };
    } else {
      testResult.value = {
        success: data.success || false,
        message: data.message || '未知响应'
      };
    }
    console.log('📊 testResult 已设置为:', testResult.value);
  } catch (error) {
    console.error('❌ 测试连接异常:', error);
    testResult.value = {
      success: false,
      message: '测试请求失败: ' + error.message
    };
  } finally {
    isTesting.value = false;
  }
};

// 保存配置
const saveConfig = async () => {
  if (!isValid.value) return;
  
  isSaving.value = true;
  
  try {
    const response = await fetch(`${API_BASE}/api/influx-config/${props.fileId}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify(form.value)
    });
    
    const data = await response.json();
    
    if (data.success) {
      emit('saved', data.data);
      emit('close');
    } else {
      await showAlert(data.error || t('common.saveFailed'));
    }
  } catch (error) {
    await showAlert(t('common.saveFailed') + ': ' + error.message);
  } finally {
    isSaving.value = false;
  }
};

onMounted(() => {
  console.log('🔍 [InfluxConfigPanel] onMounted 权限调试:', {
    permissions: authStore.permissions,
    hasInfluxManage: authStore.hasPermission('influx:manage'),
    user: authStore.user,
    isAuthenticated: authStore.isAuthenticated
  });
  loadConfig();
});
</script>

<style>
/* 非 Scoped 样式，确保能穿透到 Element Plus 内部组件 */
/* 提升权重：加上 html.light 前缀以覆盖全局样式 */
html.light .custom-influx-dialog .el-input__wrapper {
  background-color: var(--md-sys-color-surface-container-high) !important;
  box-shadow: none !important; 
}

html.light .custom-influx-dialog .el-input__inner {
  background-color: transparent !important;
  color: var(--el-text-color-primary) !important;
}

/* 修复下拉框等可能是 input 的情况 */
html.light .custom-influx-dialog input {
  background-color: transparent !important;
}
</style>

<style scoped>
/* 移除 fixed 定位，让 el-dialog 控制布局 */
/* .influx-config-content { padding: 10px; } */

/* 底部按钮布局 */
.dialog-footer-row { display: flex; justify-content: space-between; width: 100%; }
.footer-left { display: flex; align-items: center; gap: 8px; }
.footer-right { display: flex; gap: 8px; }

.test-result-inline { font-size: 12px; margin-left: 8px; display: flex; align-items: center; }
.test-result-inline.success { color: var(--el-color-success); }
.test-result-inline.error { color: var(--el-color-danger); }

.form-section {
  margin-bottom: 24px;
}

.form-section h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

.form-group label .required {
  color: var(--el-color-danger);
}

/* 使用 Element Plus 输入框样式，移除自定义的硬编码样式 */
:deep(.el-input__wrapper) {
  /* 浅色模式下使用浅灰背景，深色模式下 Element Plus 会自动适配 */
  background-color: var(--md-sys-color-surface-container-high) !important; 
  box-shadow: none !important; /* 浅灰背景下可以移除边框，或者保留看效果 */
}

:deep(.el-input__inner) {
  color: var(--el-text-color-primary);
  background-color: transparent !important; /* 必须强制透明，否则会受全局 input 样式污染导致色差 */
}

/* 降低 placeholder 对比度，自动适应深浅色 */
:deep(.el-input__inner::placeholder) {
  color: var(--el-text-color-placeholder) !important;
  opacity: 0.6; /* 稍微降低不透明度 */
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-group.half {
  flex: 1;
}

/* 移除自定义的 Toggle 样式，直接使用 ElRadio */
:deep(.el-radio) {
  margin-right: 20px;
}

/* Checkbox 样式 */
:deep(.el-checkbox__label) {
  color: var(--el-text-color-regular);
}
</style>
