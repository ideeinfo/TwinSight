<template>
  <el-dialog
    :model-value="true"
    :title="'⚡ ' + t('influxConfig.title')"
    width="600px"
    :close-on-click-modal="false"
    destroy-on-close
    class="custom-dialog"
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
          />
        </div>
        
        <div class="form-row">
          <div class="form-group half">
            <label>{{ t('influxConfig.port') }}</label>
            <el-input 
              v-model.number="form.influxPort" 
              type="number" 
              placeholder="8086"
            />
          </div>
          <div class="form-group half">
            <label>{{ t('influxConfig.org') }} <span class="required">*</span></label>
            <el-input 
              v-model="form.influxOrg" 
              placeholder="demo"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>{{ t('influxConfig.bucket') }} <span class="required">*</span></label>
          <el-input 
            v-model="form.influxBucket" 
            placeholder="tandem"
          />
        </div>
      </div>

      <!-- 认证方式 -->
      <div class="form-section">
        <h4>{{ t('influxConfig.authentication') }}</h4>
        
        <el-radio-group v-model="form.useBasicAuth" style="margin-bottom: 16px;">
          <el-radio :label="false">Token API</el-radio>
          <el-radio :label="true">Basic Auth</el-radio>
        </el-radio-group>

        <div v-if="!form.useBasicAuth" class="form-group">
          <label>API Token</label>
          <el-input 
            v-model="form.influxToken" 
            type="password" 
            show-password
            :placeholder="hasToken ? t('influxConfig.keepExisting') : t('influxConfig.enterToken')"
          />
        </div>

        <div v-else class="form-row">
          <div class="form-group half">
            <label>{{ t('influxConfig.username') }}</label>
            <el-input 
              v-model="form.influxUser" 
              placeholder="root"
            />
          </div>
          <div class="form-group half">
            <label>{{ t('influxConfig.password') }}</label>
            <el-input 
              v-model="form.influxPassword" 
              type="password" 
              show-password
              :placeholder="hasPassword ? t('influxConfig.keepExisting') : t('influxConfig.enterPassword')"
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
          <el-button type="primary" :loading="isSaving" :disabled="!isValid || !authStore.hasPermission('influx:manage')" @click="saveConfig">
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

// Helper to show alert using ElMessageBox
const showAlert = async (message, title = '') => {
  await ElMessageBox.alert(message, title || t('common.alert'), {
    confirmButtonText: t('common.confirm'),
    type: 'warning'
  });
};

// 表单验证
const isValid = computed(() => {
  return form.value.influxUrl && form.value.influxOrg && form.value.influxBucket;
});

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
        influxToken: config.has_token ? '******' : '',
        influxUser: config.influx_user || '',
        influxPassword: config.has_password ? '******' : '',
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
  loadConfig();
});
</script>

<style scoped>
.influx-config-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* 模态框样式移除，使用 el-dialog */
.influx-config-content { padding: 10px; }

/* 底部按钮布局 */
.dialog-footer-row { display: flex; justify-content: space-between; width: 100%; }
.footer-left { display: flex; align-items: center; gap: 8px; }
.footer-right { display: flex; gap: 8px; }

.test-result-inline { font-size: 12px; margin-left: 8px; display: flex; align-items: center; }
.test-result-inline.success { color: #67c23a; }
.test-result-inline.error { color: #f56c6c; }

.form-section {
  margin-bottom: 24px;
}

.form-section h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 6px;
}

.form-group label .required {
  color: #f44336;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"] {
  width: 100%;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 10px 12px;
  color: #fff;
  font-size: 13px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #38ABDF;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-group.half {
  flex: 1;
}

.auth-toggle {
  display: flex;
  background: #2a2a2a;
  border-radius: 6px;
  padding: 4px;
  margin-bottom: 16px;
}

.toggle-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #888;
  font-size: 12px;
  transition: all 0.2s;
}

.toggle-option input {
  display: none;
}

.toggle-option.active {
  background: #38ABDF;
  color: #fff;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #ccc;
  font-size: 13px;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
}

.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-top: 16px;
}

.test-result.success {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.test-result.error {
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.test-icon {
  font-weight: bold;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid #333;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.test-result-inline {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
}

.test-result-inline.success {
  color: #4caf50;
  background: rgba(76, 175, 80, 0.15);
}

.test-result-inline.error {
  color: #f44336;
  background: rgba(244, 67, 54, 0.15);
}

.footer-right {
  display: flex;
  gap: 12px;
}


</style>
