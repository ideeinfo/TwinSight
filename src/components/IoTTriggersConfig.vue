<template>
  <div class="iot-triggers-config">
    <div class="toolbar">
      <div class="title">IoT 触发器管理</div>
      <div class="actions">
        <el-button type="primary" :icon="Plus" size="small" @click="handleCreate">
          新增触发器
        </el-button>
        <el-button :icon="Refresh" size="small" @click="fetchTriggers" :loading="loading">
          刷新
        </el-button>
      </div>
    </div>

    <el-table :data="triggers" v-loading="loading" style="width: 100%" size="small" border>
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="type" label="类型" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ getTypeName(row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="触发条件" min-width="180">
        <template #default="{ row }">
          <span>{{ row.condition_field }} {{ getOperatorSymbol(row.condition_operator) }} {{ row.condition_value }}</span>
        </template>
      </el-table-column>
      <el-table-column label="分析引擎" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.analysis_engine === 'n8n'" type="warning" size="small">n8n 工作流</el-tag>
          <el-tag v-else type="success" size="small">内置分析</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="severity" label="严重程度" width="100">
        <template #default="{ row }">
          <el-tag :type="row.severity === 'critical' ? 'danger' : 'warning'" size="small">
            {{ row.severity === 'critical' ? '严重' : '警告' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-switch
            v-model="row.enabled"
            size="small"
            @change="handleStatusChange(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑触发器' : '新增触发器'"
      width="500px"
      append-to-body
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" size="default">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：高温报警" />
        </el-form-item>
        
        <el-form-item label="触发类型" prop="type">
          <el-select v-model="form.type" placeholder="选择类型" style="width: 100%">
            <el-option
              v-for="(config, key) in triggerTypes"
              :key="key"
              :label="config.name"
              :value="key"
            />
          </el-select>
        </el-form-item>
        
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="监控字段" prop="conditionField">
              <el-select v-model="form.conditionField" placeholder="选择字段" :disabled="!form.type">
                <el-option
                  v-for="field in currentTypeFields"
                  :key="field"
                  :label="field"
                  :value="field"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label-width="0" prop="conditionOperator">
              <el-select v-model="form.conditionOperator" placeholder="操作符" :disabled="!form.type">
                <el-option label="大于 (>)" value="gt" />
                <el-option label="小于 (<)" value="lt" />
                <el-option label="等于 (=)" value="eq" />
                <el-option label="大于等于 (>=)" value="gte" />
                <el-option label="小于等于 (<=)" value="lte" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="阈值" prop="conditionValue">
          <el-input-number v-model="form.conditionValue" :precision="1" :step="0.5" style="width: 100%" /> 
        </el-form-item>
        
        <el-divider content-position="left">分析配置</el-divider>
        
        <el-form-item label="分析引擎" prop="analysisEngine">
          <el-radio-group v-model="form.analysisEngine">
            <el-radio label="builtin">内置分析模块</el-radio>
            <el-radio label="n8n">n8n 工作流</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <template v-if="form.analysisEngine === 'n8n'">
          <el-form-item label="工作流" prop="n8nWorkflowId">
            <div class="workflow-selector">
              <el-select 
                v-model="form.n8nWorkflowId" 
                placeholder="选择 n8n 工作流" 
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
              <el-button :icon="Refresh" circle size="small" @click="fetchN8nWorkflows" />
            </div>
            <div class="form-hint" v-if="n8nWorkflows.length === 0 && !loadingWorkflows">
               请先在系统配置中设置 N8N API Key 并确保 n8n 运行中
            </div>
            <div class="form-hint" v-if="form.n8nWebhookPath">
               Webhook: {{ form.n8nWebhookPath }}
            </div>
          </el-form-item>
        </template>
        
        <el-divider content-position="left">UI 行为</el-divider>
        
        <el-form-item label="严重程度" prop="severity">
          <el-select v-model="form.severity" style="width: 100%">
            <el-option label="警告 (Warning)" value="warning" />
            <el-option label="严重 (Critical)" value="critical" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="自动打开对话" prop="autoOpenChat">
          <el-switch v-model="form.autoOpenChat" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Edit, Delete } from '@element-plus/icons-vue';

const API_BASE = '/api/iot-triggers';
const loading = ref(false);
const triggers = ref([]);
const triggerTypes = ref({});

// 编辑相关
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

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  conditionField: [{ required: true, message: '请选择字段', trigger: 'change' }],
  conditionValue: [{ required: true, message: '请输入阈值', trigger: 'blur' }]
};

// n8n 工作流
const loadingWorkflows = ref(false);
const n8nWorkflows = ref([]);

// 计算属性
const currentTypeFields = computed(() => {
  if (!form.value.type || !triggerTypes.value[form.value.type]) return [];
  return triggerTypes.value[form.value.type].fields;
});

// 初始化
onMounted(async () => {
  await fetchTriggerTypes();
  await fetchTriggers();
});

// 监听分析引擎切换，自动加载工作流
watch(() => form.value.analysisEngine, (newVal) => {
  if (newVal === 'n8n' && n8nWorkflows.value.length === 0) {
    fetchN8nWorkflows();
  }
});

// API 调用
async function fetchTriggerTypes() {
  try {
    const res = await fetch(`${API_BASE}/types`);
    const result = await res.json();
    if (result.success) triggerTypes.value = result.data;
  } catch (err) {
    console.error('获取类型失败', err);
  }
}

async function fetchTriggers() {
  loading.value = true;
  try {
    const res = await fetch(API_BASE);
    const result = await res.json();
    if (result.success) triggers.value = result.data;
  } catch (err) {
    ElMessage.error('获取触发器列表失败');
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
        ElMessage.warning('未找到包含 Webhook 的 n8n 工作流');
      } else {
        ElMessage.success(`获取到 ${result.data.length} 个工作流`);
      }
    } else {
      ElMessage.error(result.error || '获取工作流失败，请检查 API Key');
    }
  } catch (err) {
    ElMessage.error('获取工作流失败');
  } finally {
    loadingWorkflows.value = false;
  }
}

// 事件处理
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
  // 如果选择了 n8n，尝试预加载工作流
  // fetchN8nWorkflows(); 
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
    await ElMessageBox.confirm('确定要删除该触发器吗？', '提示', { type: 'warning' });
    const res = await fetch(`${API_BASE}/${row.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      ElMessage.success('删除成功');
      fetchTriggers();
    } else {
      ElMessage.error(result.error);
    }
  } catch (err) {
    // Cancelled or error
  }
}

async function handleStatusChange(row) {
  try {
    await fetch(`${API_BASE}/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: row.enabled })
    });
    ElMessage.success(row.enabled ? '已启用' : '已禁用');
  } catch (err) {
    row.enabled = !row.enabled; // revert
    ElMessage.error('更新状态失败');
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
          ElMessage.success(isEdit.value ? '更新成功' : '创建成功');
          dialogVisible.value = false;
          fetchTriggers();
        } else {
          ElMessage.error(result.error || '操作失败');
        }
      } catch (err) {
        ElMessage.error('请求失败');
      } finally {
        submitting.value = false;
      }
    }
  });
}

// 辅助函数
function getTypeName(type) {
  return triggerTypes.value[type]?.name || type;
}

function getOperatorSymbol(op) {
  const map = { gt: '>', lt: '<', eq: '=', gte: '>=', lte: '<=' };
  return map[op] || op;
}
</script>

<style scoped>
.iot-triggers-config {
  padding: 16px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.actions {
  display: flex;
  gap: 8px;
}
.workflow-selector {
  display: flex;
  gap: 8px;
  width: 100%;
}
.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
