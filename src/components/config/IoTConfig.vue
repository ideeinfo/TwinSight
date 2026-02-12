<template>
  <div class="iot-config">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="title-section">
        <h3>{{ t('system.config.iot.title') }}</h3>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="Plus" @click="handleCreate">
          {{ t('system.config.iot.create') }}
        </el-button>
        <el-button :icon="Refresh" @click="fetchTriggers" :loading="loading" circle />
      </div>
    </div>

    <!-- Table -->
    <el-card shadow="never" class="table-card">
      <el-table :data="triggers" v-loading="loading" style="width: 100%">
        <el-table-column prop="name" :label="t('system.config.iot.name')" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="fw-medium">{{ row.name }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="type" :label="t('system.config.iot.type')" width="110">
          <template #default="{ row }">
            <el-tag effect="light" type="info">{{ getTypeName(row.type) }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column :label="t('system.config.iot.condition')" min-width="160">
          <template #default="{ row }">
            <code class="condition-code">{{ row.condition_field }} {{ getOperatorSymbol(row.condition_operator) }} {{ row.condition_value }}</code>
          </template>
        </el-table-column>
        
        <el-table-column :label="t('system.config.iot.analysis')" width="130">
          <template #default="{ row }">
            <el-tag v-if="row.analysis_engine === 'n8n'" type="warning" effect="plain" class="engine-tag">
              <span class="dot warning"></span> n8n
            </el-tag>
            <el-tag v-else type="success" effect="plain" class="engine-tag">
              <span class="dot success"></span> Built-in
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="severity" :label="t('system.config.iot.severity')" width="100">
          <template #default="{ row }">
            <div class="severity-indicator" :class="row.severity">
              <span class="indicator-dot"></span>
              {{ row.severity === 'critical' ? t('system.config.iot.critical') : t('system.config.iot.warning') }}
            </div>
          </template>
        </el-table-column>
        
        <el-table-column :label="t('system.config.iot.status')" width="80">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              size="small"
              @change="handleStatusChange(row)"
              style="--el-switch-on-color: var(--el-color-success)"
            />
          </template>
        </el-table-column>
        
        <el-table-column :label="t('system.config.iot.actions')" width="100" align="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)" />
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? t('system.config.iot.edit') : t('system.config.iot.create')"
      width="520px"
      append-to-body
      destroy-on-close
      class="custom-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" label-position="left">
        <el-form-item :label="t('system.config.iot.name')" prop="name">
          <el-input v-model="form.name" :placeholder="t('system.config.iot.namePlaceholder')" />
        </el-form-item>
        
        <el-form-item :label="t('system.config.iot.type')" prop="type">
          <el-select v-model="form.type" :placeholder="t('system.config.iot.typePlaceholder')" style="width: 100%">
            <el-option
              v-for="(config, key) in triggerTypes"
              :key="key"
              :label="config.name"
              :value="key"
            />
          </el-select>
        </el-form-item>
        
        <div class="form-row">
          <el-form-item :label="t('system.config.iot.conditionField')" prop="conditionField" class="half-width">
            <el-select v-model="form.conditionField" :disabled="!form.type" style="width: 100%">
              <el-option
                v-for="field in currentTypeFields"
                :key="field"
                :label="field"
                :value="field"
              />
            </el-select>
          </el-form-item>
          
          <el-form-item label-width="0" prop="conditionOperator" class="quarter-width">
             <el-select v-model="form.conditionOperator" :disabled="!form.type" style="width: 100%">
                <el-option label=">" value="gt" />
                <el-option label="<" value="lt" />
                <el-option label="=" value="eq" />
                <el-option label=">=" value="gte" />
                <el-option label="<=" value="lte" />
              </el-select>
          </el-form-item>

          <el-form-item label-width="0" prop="conditionValue" class="quarter-width">
             <el-input-number v-model="form.conditionValue" :precision="1" :step="0.5" style="width: 100%" :controls="false" />
          </el-form-item>
        </div>
        
        <el-divider content-position="left" class="form-divider">{{ t('system.config.iot.analysis') }}</el-divider>
        
        <el-form-item :label="t('system.config.iot.analysis')" prop="analysisEngine">
          <el-radio-group v-model="form.analysisEngine">
            <el-radio-button label="builtin">{{ t('system.config.iot.builtin') }}</el-radio-button>
            <el-radio-button label="n8n">n8n</el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <template v-if="form.analysisEngine === 'n8n'">
          <el-form-item :label="t('system.config.iot.workflow')" prop="n8nWorkflowId">
            <div class="workflow-selector">
              <el-select 
                v-model="form.n8nWorkflowId" 
                :placeholder="t('system.config.iot.workflowPlaceholder')" 
                style="width: 100%"
                filterable
                :loading="loadingWorkflows"
                @change="handleWorkflowChange"
              >
                <el-option
                  v-for="wf in n8nWorkflows"
                  :key="wf.id"
                  :label="wf.name"
                  :value="wf.id"
                />
              </el-select>
              <el-button :icon="Refresh" circle @click="fetchN8nWorkflows" class="ml-2" />
            </div>
            <div class="form-hint" v-if="n8nWorkflows.length === 0 && !loadingWorkflows">
               {{ t('system.config.iot.workflowHint') }}
            </div>
            <div class="form-hint" v-if="form.n8nWebhookPath">
               Webhook: <code class="webhook-path">{{ form.n8nWebhookPath }}</code>
            </div>
          </el-form-item>
        </template>
        
        <el-divider content-position="left" class="form-divider">Attributes</el-divider>
        
        <el-form-item :label="t('system.config.iot.severity')" prop="severity">
          <el-select v-model="form.severity" style="width: 100%">
            <el-option :label="t('system.config.iot.warning')" value="warning">
               <span class="severity-option warning"></span> {{ t('system.config.iot.warning') }}
            </el-option>
            <el-option :label="t('system.config.iot.critical')" value="critical">
               <span class="severity-option critical"></span> {{ t('system.config.iot.critical') }}
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item :label="t('system.config.iot.autoOpenChat')" prop="autoOpenChat">
          <el-switch v-model="form.autoOpenChat" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="submitForm" :loading="submitting">{{ t('common.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Edit, Delete } from '@element-plus/icons-vue';

const { t } = useI18n();

const API_BASE = '/api/iot-triggers';
const loading = ref(false);
const triggers = ref([]);
const triggerTypes = ref({});

// Dialog & Form
const dialogVisible = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const formRef = ref(null);

const form = ref({
  id: null,
  name: '',
  type: '',
  enabled: true,
  conditionField: '',
  conditionOperator: 'gt',
  conditionValue: 0,
  analysisEngine: 'builtin',
  n8nWorkflowId: '',
  n8nWebhookPath: '',
  severity: 'warning',
  autoOpenChat: true
});

const rules = computed(() => ({
  name: [{ required: true, message: t('common.required'), trigger: 'blur' }],
  type: [{ required: true, message: t('common.required'), trigger: 'change' }],
  conditionField: [{ required: true, message: t('common.required'), trigger: 'change' }],
  conditionValue: [{ required: true, message: t('common.required'), trigger: 'blur' }]
}));

// n8n
const loadingWorkflows = ref(false);
const n8nWorkflows = ref([]);

// Computed
const currentTypeFields = computed(() => {
  if (!form.value.type || !triggerTypes.value[form.value.type]) return [];
  return triggerTypes.value[form.value.type].fields;
});

// Lifecycle
onMounted(async () => {
  await fetchTriggerTypes();
  await fetchTriggers();
});

watch(() => form.value.analysisEngine, (newVal) => {
  if (newVal === 'n8n' && n8nWorkflows.value.length === 0) {
    fetchN8nWorkflows();
  }
});

// APIs
async function fetchTriggerTypes() {
  try {
    const res = await fetch(`${API_BASE}/types`);
    const result = await res.json();
    if (result.success) triggerTypes.value = result.data;
  } catch (err) {
    console.error('Failed to fetch types', err);
  }
}

async function fetchTriggers() {
  loading.value = true;
  try {
    const res = await fetch(API_BASE);
    const result = await res.json();
    if (result.success) triggers.value = result.data;
  } catch (err) {
    ElMessage.error(t('common.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function fetchN8nWorkflows() {
  loadingWorkflows.value = true;
  try {
    const res = await fetch(`${API_BASE}/n8n/workflows`);
    const result = await res.json();
    if (result.success) {
      n8nWorkflows.value = result.data;
      if (result.data.length === 0) {
        ElMessage.warning(t('system.config.iot.noWorkflows'));
      } else {
        ElMessage.success(t('system.config.iot.workflowCount', { count: result.data.length }));
      }
    } else {
      ElMessage.error(result.error || t('system.config.iot.workflowHint'));
    }
  } catch (err) {
    ElMessage.error(t('common.loadFailed'));
  } finally {
    loadingWorkflows.value = false;
  }
}

// Handlers
function handleCreate() {
  isEdit.value = false;
  form.value = {
    id: null,
    name: '',
    type: 'temperature',
    enabled: true,
    conditionField: 'temperature',
    conditionOperator: 'gt',
    conditionValue: 26,
    analysisEngine: 'builtin',
    n8nWorkflowId: '',
    n8nWebhookPath: '',
    severity: 'warning',
    autoOpenChat: true
  };
  dialogVisible.value = true;
}

function handleEdit(row) {
  isEdit.value = true;
  form.value = {
    id: row.id,
    name: row.name,
    type: row.type,
    enabled: row.enabled,
    conditionField: row.condition_field,
    conditionOperator: row.condition_operator,
    conditionValue: Number(row.condition_value),
    analysisEngine: row.analysis_engine || 'builtin',
    n8nWorkflowId: row.n8n_workflow_id,
    n8nWebhookPath: row.n8n_webhook_path,
    severity: row.severity || 'warning',
    autoOpenChat: row.auto_open_chat
  };
  dialogVisible.value = true;
  if (form.value.analysisEngine === 'n8n') {
    fetchN8nWorkflows();
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      t('system.config.iot.confirmDelete'), 
      t('system.config.iot.delete'), 
      { type: 'warning' }
    );
    const res = await fetch(`${API_BASE}/${row.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      ElMessage.success(t('system.config.iot.deleteSuccess')); // Using generic or add key
      fetchTriggers();
    } else {
      ElMessage.error(result.error);
    }
  } catch (err) {
    // Cancelled
  }
}

async function handleStatusChange(row) {
  try {
    await fetch(`${API_BASE}/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: row.enabled })
    });
    ElMessage.success(t('common.success'));
  } catch (err) {
    row.enabled = !row.enabled;
    ElMessage.error(t('common.saveFailed'));
  }
}

function handleWorkflowChange(workflowId) {
  const wf = n8nWorkflows.value.find(w => w.id === workflowId);
  if (wf) {
    form.value.n8nWebhookPath = wf.webhookPath;
  }
}

async function submitForm() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        const url = isEdit.value ? `${API_BASE}/${form.value.id}` : API_BASE;
        const method = isEdit.value ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form.value)
        });
        
        const result = await res.json();
        if (result.success) {
          ElMessage.success(t('common.saveSuccess'));
          dialogVisible.value = false;
          fetchTriggers();
        } else {
          ElMessage.error(result.error || t('common.saveFailed'));
        }
      } catch (err) {
        ElMessage.error(t('common.saveFailed'));
      } finally {
        submitting.value = false;
      }
    }
  });
}

// Helpers
function getTypeName(type) {
  return triggerTypes.value[type]?.name || type;
}

function getOperatorSymbol(op) {
  const map = { gt: '>', lt: '<', eq: '=', gte: '>=', lte: '<=' };
  return map[op] || op;
}
</script>

<style scoped>
.iot-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 4px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.title-section h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.table-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.table-card :deep(.el-card__body) {
  padding: 0;
}

.table-card :deep(.el-table__inner-wrapper::before) {
  display: none; /* Remove bottom border of table */
}

/* Typography */
.fw-medium {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.condition-code {
  font-family: var(--el-font-family-monospace, monospace);
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

/* Engine Tag */
.engine-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 0;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.dot.warning { background-color: var(--el-color-warning); }
.dot.success { background-color: var(--el-color-success); }

/* Severity */
.severity-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.severity-indicator.warning { color: var(--el-color-warning); }
.severity-indicator.warning .indicator-dot { background-color: var(--el-color-warning); }

.severity-indicator.critical { color: var(--el-color-danger); }
.severity-indicator.critical .indicator-dot { background-color: var(--el-color-danger); }

/* Form */
.form-row {
  display: flex;
  gap: 12px;
}

.half-width { flex: 2; }
.quarter-width { flex: 1; }

.form-divider {
  margin: 24px 0 16px;
}

.workflow-selector {
  display: flex;
  align-items: center;
  width: 100%;
}

.ml-2 { margin-left: 8px; }

.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 6px;
}

.webhook-path {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 2px 4px;
  border-radius: 4px;
}

.severity-option {
  width: 8px; 
  height: 8px; 
  display: inline-block; 
  margin-right: 8px;
  border-radius: 50%;
}
.severity-option.warning { background-color: var(--el-color-warning); }
.severity-option.critical { background-color: var(--el-color-danger); }
</style>
