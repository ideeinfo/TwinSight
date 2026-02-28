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

// Config Declaration
const configMappings = [
  // InfluxDB
  { key: 'INFLUXDB_URL', form: influxForm, prop: 'url' },
  { key: 'INFLUXDB_ORG', form: influxForm, prop: 'org' },
  { key: 'INFLUXDB_BUCKET', form: influxForm, prop: 'bucket' },
  { key: 'INFLUXDB_ENABLED', form: influxForm, prop: 'enabled', type: 'boolean' },
  { key: 'INFLUXDB_TOKEN', form: influxForm, prop: 'token', secretRef: influxHasToken },
  
  // AI - LLM
  { key: 'LLM_PROVIDER', form: aiForm, prop: 'provider', default: 'qwen' },
  { key: 'LLM_BASE_URL', form: aiForm, prop: 'baseUrl' },
  { key: 'LLM_MODEL', form: aiForm, prop: 'model' },
  { key: 'LLM_API_KEY', form: aiForm, prop: 'apiKey', secretRef: aiHasApiKey },
  
  // AI - Open WebUI
  { key: 'OPENWEBUI_URL', form: aiForm, prop: 'openwebuiUrl' },
  { key: 'OPENWEBUI_API_KEY', form: aiForm, prop: 'openwebuiApiKey', secretRef: openwebuiHasApiKey },
  
  // AI - n8n
  { key: 'N8N_WEBHOOK_URL', form: aiForm, prop: 'n8nWebhookUrl' },
  { key: 'N8N_API_KEY', form: aiForm, prop: 'n8nApiKey', secretRef: n8nHasApiKey }
];

// Load Configs
async function loadConfigs() {
  try {
    const headers = {};
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    const response = await fetch(`${API_BASE}/system-config`, { headers });
    const result = await response.json();
    
    if (result.success) {
      const { influxdb, ai } = result.data;
      const allConfigs = [...(influxdb || []), ...(ai || [])];
      
      // Create a map for O(1) lookup
      const configMap = new Map(allConfigs.map(c => [c.key, c]));

      configMappings.forEach(mapping => {
        const cfg = configMap.get(mapping.key);
        if (cfg) {
          if (mapping.secretRef) {
            // For secrets, we don't load the value (it's masked), just update the status
            mapping.secretRef.value = cfg.isEncrypted && !!cfg.value;
          } else if (mapping.type === 'boolean') {
            mapping.form.value[mapping.prop] = cfg.value === 'true';
          } else {
            mapping.form.value[mapping.prop] = cfg.value || mapping.default || '';
          }
        } else if (mapping.default) {
           mapping.form.value[mapping.prop] = mapping.default;
        }
      });
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
    
    configMappings.forEach(mapping => {
       const val = mapping.form.value[mapping.prop];
       
       if (mapping.secretRef) {
         // Only save secrets if user has entered a new value
         if (val) {
           configs.push({ key: mapping.key, value: val });
         }
       } else if (mapping.type === 'boolean') {
         configs.push({ key: mapping.key, value: String(val) });
       } else {
         // Perform simple undefined check
         if (val !== undefined) {
           configs.push({ key: mapping.key, value: val });
         }
       }
    });
    
    const headers = { 'Content-Type': 'application/json' };
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    const response = await fetch(`${API_BASE}/system-config`, {
      method: 'POST',
      headers,
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
