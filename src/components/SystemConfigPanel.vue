<template>
  <el-dialog
    v-model="visible"
    :title="t('system.config.title')"
    width="800px"
    class="custom-dialog system-config-dialog"
    :close-on-click-modal="false"
    destroy-on-close
    append-to-body
  >
    <!-- Access Denied -->
    <div v-if="!canAccessConfig" class="access-denied">
      <el-result
        icon="warning"
        :title="t('system.config.accessDenied')"
        :sub-title="t('system.config.accessDeniedMessage')"
      >
        <template #extra>
          <el-button type="primary" @click="visible = false">{{ t('common.close') }}</el-button>
        </template>
      </el-result>
    </div>

    <!-- Main Content -->
    <div v-else class="config-container">
      <el-tabs v-model="activeTab" tab-position="left" class="config-tabs" style="height: 500px">
        
        <!-- InfluxDB -->
        <el-tab-pane :label="t('system.config.tabs.influxdb')" name="influxdb">
          <div class="tab-content">
            <h3 class="tab-title">{{ t('system.config.tabs.influxdb') }}</h3>
            <InfluxConfig 
              v-model="influxForm" 
              :has-token="influxHasToken" 
            />
          </div>
        </el-tab-pane>
        
        <!-- LLM Config -->
        <el-tab-pane :label="t('system.config.tabs.llm')" name="llm">
          <div class="tab-content">
            <h3 class="tab-title">{{ t('system.config.tabs.llm') }}</h3>
            <LLMConfig 
              v-model="aiForm" 
              :has-api-key="aiHasApiKey" 
            />
          </div>
        </el-tab-pane>
        
        <!-- Knowledge Base -->
        <el-tab-pane :label="t('system.config.tabs.knowledge')" name="knowledge">
          <div class="tab-content">
            <h3 class="tab-title">{{ t('system.config.tabs.knowledge') }}</h3>
             <KnowledgeBaseConfig 
              v-model="aiForm" 
              :has-api-key="openwebuiHasApiKey"
            />
          </div>
        </el-tab-pane>
        
        <!-- Workflow -->
        <el-tab-pane :label="t('system.config.tabs.workflow')" name="workflow">
          <div class="tab-content">
            <h3 class="tab-title">{{ t('system.config.tabs.workflow') }}</h3>
            <WorkflowConfig 
              v-model="aiForm" 
              :has-api-key="n8nHasApiKey"
            />
          </div>
        </el-tab-pane>
        
        <!-- IoT Triggers -->
        <el-tab-pane :label="t('system.config.tabs.iot')" name="iot">
           <div class="tab-content full-width">
            <IoTConfig />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ t('common.save') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

// Child Components
import InfluxConfig from './config/InfluxConfig.vue';
import LLMConfig from './config/LLMConfig.vue';
import KnowledgeBaseConfig from './config/KnowledgeBaseConfig.vue';
import WorkflowConfig from './config/WorkflowConfig.vue';
import IoTConfig from './config/IoTConfig.vue';

const { t } = useI18n();
const authStore = useAuthStore();

// Props & Emits
const props = defineProps({
  modelValue: Boolean
});
const emit = defineEmits(['update:modelValue']);

// State
const visible = ref(props.modelValue);
const activeTab = ref('influxdb');
const saving = ref(false);

const canAccessConfig = computed(() => authStore.hasPermission('system:admin'));

// Forms
const influxForm = ref({
  url: '',
  org: '',
  bucket: '',
  token: '',
  enabled: true
});
const influxHasToken = ref(false);

const aiForm = ref({
  provider: 'qwen',
  baseUrl: '',
  apiKey: '',
  model: '',
  openwebuiUrl: '',
  openwebuiApiKey: '',
  n8nWebhookUrl: '',
  n8nApiKey: ''
});
const aiHasApiKey = ref(false);
const openwebuiHasApiKey = ref(false);
const n8nHasApiKey = ref(false);

const API_BASE = '/api/v1';

// Watchers
watch(() => props.modelValue, (val) => { 
    visible.value = val; 
    if (val && canAccessConfig.value) loadConfigs();
});
watch(visible, (val) => { emit('update:modelValue', val); });

// Load Configs
async function loadConfigs() {
  try {
    const response = await fetch(`${API_BASE}/system-config`);
    const result = await response.json();
    
    if (result.success) {
      const { influxdb, ai } = result.data;
      
      // Map InfluxDB
      if (influxdb) {
        influxdb.forEach(cfg => {
          if (cfg.key === 'INFLUXDB_URL') influxForm.value.url = cfg.value;
          if (cfg.key === 'INFLUXDB_ORG') influxForm.value.org = cfg.value;
          if (cfg.key === 'INFLUXDB_BUCKET') influxForm.value.bucket = cfg.value;
          if (cfg.key === 'INFLUXDB_TOKEN') influxHasToken.value = cfg.isEncrypted && !!cfg.value;
          if (cfg.key === 'INFLUXDB_ENABLED') influxForm.value.enabled = cfg.value === 'true';
        });
      }
      
      // Map AI
      if (ai) {
        ai.forEach(cfg => {
           if (cfg.key === 'LLM_PROVIDER') aiForm.value.provider = cfg.value || 'qwen';
           if (cfg.key === 'LLM_BASE_URL') aiForm.value.baseUrl = cfg.value;
           if (cfg.key === 'LLM_API_KEY') aiHasApiKey.value = cfg.isEncrypted && !!cfg.value;
           if (cfg.key === 'LLM_MODEL') aiForm.value.model = cfg.value;
           if (cfg.key === 'OPENWEBUI_URL') aiForm.value.openwebuiUrl = cfg.value;
           if (cfg.key === 'OPENWEBUI_API_KEY') openwebuiHasApiKey.value = cfg.isEncrypted && !!cfg.value;
           if (cfg.key === 'N8N_WEBHOOK_URL') aiForm.value.n8nWebhookUrl = cfg.value;
           if (cfg.key === 'N8N_API_KEY') n8nHasApiKey.value = cfg.isEncrypted && !!cfg.value;
        });
      }
    }
  } catch (error) {
    console.error('Failed to load configs', error);
    ElMessage.error(t('common.loadFailed') || 'Failed to load configuration');
  }
}

// Save Configs
async function handleSave() {
  saving.value = true;
  try {
    const configs = [];
    
    // InfluxDB
    configs.push({ key: 'INFLUXDB_URL', value: influxForm.value.url });
    // configs.push({ key: 'INFLUXDB_PORT', value: String(influxForm.value.port) }); // Removed
    configs.push({ key: 'INFLUXDB_ORG', value: influxForm.value.org });
    configs.push({ key: 'INFLUXDB_BUCKET', value: influxForm.value.bucket });
    configs.push({ key: 'INFLUXDB_ENABLED', value: String(influxForm.value.enabled) });
    if (influxForm.value.token) configs.push({ key: 'INFLUXDB_TOKEN', value: influxForm.value.token });
    
    // AI
    configs.push({ key: 'LLM_PROVIDER', value: aiForm.value.provider });
    configs.push({ key: 'LLM_BASE_URL', value: aiForm.value.baseUrl });
    configs.push({ key: 'LLM_MODEL', value: aiForm.value.model });
    if (aiForm.value.apiKey) configs.push({ key: 'LLM_API_KEY', value: aiForm.value.apiKey });
    
    configs.push({ key: 'OPENWEBUI_URL', value: aiForm.value.openwebuiUrl });
    if (aiForm.value.openwebuiApiKey) configs.push({ key: 'OPENWEBUI_API_KEY', value: aiForm.value.openwebuiApiKey });
    
    configs.push({ key: 'N8N_WEBHOOK_URL', value: aiForm.value.n8nWebhookUrl });
    if (aiForm.value.n8nApiKey) configs.push({ key: 'N8N_API_KEY', value: aiForm.value.n8nApiKey });
    
    const response = await fetch(`${API_BASE}/system-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs })
    });
    
    const result = await response.json();
    if (result.success) {
      ElMessage.success(t('common.saveSuccess'));
      visible.value = false;
    } else {
      ElMessage.error(result.error || t('common.saveFailed'));
    }
  } catch (error) {
    ElMessage.error(t('common.saveFailed'));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.custom-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.config-container {
  display: flex;
  height: 500px;
}

.config-tabs {
  width: 100%;
}

.config-tabs :deep(.el-tabs__header) {
  margin-right: 0;
  width: 180px;
  background-color: var(--el-fill-color-light);
  /* border-right removed to avoid double border */
}

.config-tabs :deep(.el-tabs__item) {
  height: 48px;
  line-height: 48px;
  padding: 0 20px;
  justify-content: flex-start;
  text-align: left;
}

.config-tabs :deep(.el-tabs__item.is-active) {
  background-color: var(--el-bg-color);
  font-weight: 500;
}

.config-tabs :deep(.el-tabs__content) {
  height: 100%;
  overflow-y: auto;
  padding: 20px 24px;
}

.tab-title {
  font-size: 18px;
  font-weight: 500;
  margin: 0 0 24px 0;
  color: var(--el-text-color-primary);
}

.tab-content {
  max-width: 600px;
}

.tab-content.full-width {
  height: 100%;
  max-width: 100%; /* Allow full width for table */
  display: flex;
  flex-direction: column;
}
</style>
