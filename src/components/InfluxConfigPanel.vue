<template>
  <div class="influx-config-modal" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>⚡ {{ t('influxConfig.title') }}</h3>
        <button class="modal-close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <!-- 连接信息 -->
        <div class="form-section">
          <h4>{{ t('influxConfig.connectionInfo') }}</h4>
          
          <div class="form-group">
            <label>{{ t('influxConfig.url') }} <span class="required">*</span></label>
            <input 
              type="text" 
              v-model="form.influxUrl" 
              placeholder="http://localhost 或 /influx"
            />
          </div>
          
          <div class="form-row">
            <div class="form-group half">
              <label>{{ t('influxConfig.port') }}</label>
              <input 
                type="number" 
                v-model.number="form.influxPort" 
                placeholder="8086"
              />
            </div>
            <div class="form-group half">
              <label>{{ t('influxConfig.org') }} <span class="required">*</span></label>
              <input 
                type="text" 
                v-model="form.influxOrg" 
                placeholder="demo"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label>{{ t('influxConfig.bucket') }} <span class="required">*</span></label>
            <input 
              type="text" 
              v-model="form.influxBucket" 
              placeholder="tandem"
            />
          </div>
        </div>

        <!-- 认证方式 -->
        <div class="form-section">
          <h4>{{ t('influxConfig.authentication') }}</h4>
          
          <div class="auth-toggle">
            <label class="toggle-option" :class="{ active: !form.useBasicAuth }">
              <input type="radio" :value="false" v-model="form.useBasicAuth" />
              Token API
            </label>
            <label class="toggle-option" :class="{ active: form.useBasicAuth }">
              <input type="radio" :value="true" v-model="form.useBasicAuth" />
              Basic Auth
            </label>
          </div>

          <div v-if="!form.useBasicAuth" class="form-group">
            <label>API Token</label>
            <input 
              type="password" 
              v-model="form.influxToken" 
              :placeholder="hasToken ? t('influxConfig.keepExisting') : t('influxConfig.enterToken')"
            />
          </div>

          <div v-else class="form-row">
            <div class="form-group half">
              <label>{{ t('influxConfig.username') }}</label>
              <input 
                type="text" 
                v-model="form.influxUser" 
                placeholder="root"
              />
            </div>
            <div class="form-group half">
              <label>{{ t('influxConfig.password') }}</label>
              <input 
                type="password" 
                v-model="form.influxPassword" 
                :placeholder="hasPassword ? t('influxConfig.keepExisting') : t('influxConfig.enterPassword')"
              />
            </div>
          </div>
        </div>

        <!-- 启用状态 -->
        <div class="form-section">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.isEnabled" />
            {{ t('influxConfig.enabled') }}
          </label>
        </div>

        <!-- 连接测试结果 -->
        <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
          <span class="test-icon">{{ testResult.success ? '✓' : '✗' }}</span>
          {{ testResult.message }}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-outline" @click="testConnection" :disabled="isTesting">
          {{ isTesting ? t('influxConfig.testing') : t('influxConfig.testConnection') }}
        </button>
        <div class="footer-right">
          <button class="btn btn-secondary" @click="$emit('close')">
            {{ t('common.cancel') }}
          </button>
          <button class="btn btn-primary" @click="saveConfig" :disabled="isSaving || !isValid">
            {{ isSaving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

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

// 表单验证
const isValid = computed(() => {
  return form.value.influxUrl && form.value.influxOrg && form.value.influxBucket;
});

// 加载现有配置
const loadConfig = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/influx-config/${props.fileId}`);
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
  
  try {
    const response = await fetch(`${API_BASE}/api/influx-config/test/connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form.value,
        fileId: props.fileId
      })
    });
    
    const data = await response.json();
    testResult.value = data.data;
  } catch (error) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
    
    const data = await response.json();
    
    if (data.success) {
      emit('saved', data.data);
      emit('close');
    } else {
      alert(data.error || '保存失败');
    }
  } catch (error) {
    alert('保存失败: ' + error.message);
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

.modal-content {
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #333;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #fff;
}

.modal-close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
}

.modal-close-btn:hover {
  color: #fff;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

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

.footer-right {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #38ABDF;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #0091ea;
}

.btn-secondary {
  background: #444;
  color: #ccc;
}

.btn-secondary:hover:not(:disabled) {
  background: #555;
}

.btn-outline {
  background: transparent;
  border: 1px solid #666;
  color: #ccc;
}

.btn-outline:hover:not(:disabled) {
  border-color: #38ABDF;
  color: #38ABDF;
}
</style>
