<template>
  <div class="ticket-detail-panel">
    <div class="panel-header">
      <div class="header-copy">
        <div class="panel-title">{{ t('tickets.detailTitle') }}</div>
        <div class="panel-code">{{ ticket?.ticketNo || t('tickets.detailPlaceholder') }}</div>
      </div>
      <TicketStatusTag v-if="ticket" :status="ticket.status" />
    </div>

    <div v-if="!ticket" class="empty-state">
      <strong>{{ t('tickets.detailPlaceholder') }}</strong>
      <p>{{ t('tickets.detailHint') }}</p>
    </div>

    <template v-else>
      <div class="panel-body">
      <section class="detail-group">
        <div class="group-header">{{ t('tickets.infoSectionTitle') }}</div>
        <div class="group-body">
          <div class="row">
            <label>{{ t('tickets.ticketNoLabel') }}</label>
            <div class="val-box">{{ ticket.ticketNo || t('tickets.ticketNoHint') }}</div>
          </div>
          <div class="row">
            <label>{{ t('tickets.titleLabel') }}</label>
            <div class="editor-box">
              <el-input v-model="form.title" maxlength="200" @blur="scheduleAutoSave" />
            </div>
          </div>
          <div class="field-block">
            <div class="field-label">{{ t('tickets.descriptionLabel') }}</div>
            <div class="editor-box">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="5"
                :placeholder="t('tickets.descriptionPlaceholder')"
                @blur="scheduleAutoSave"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="detail-group">
        <div class="group-header">{{ t('tickets.workflowSectionTitle') }}</div>
        <div class="group-body">
          <div class="row">
            <label>{{ t('tickets.spaceLabel') }}</label>
            <div class="editor-box">
              <el-select v-model="form.spaceCode" filterable style="width: 100%;" @change="handleSpaceSelectionChange">
                <el-option
                  v-for="space in sortedSpaces"
                  :key="space.code"
                  :label="`${space.floor || '-'} / ${space.name || space.code}`"
                  :value="space.code"
                />
              </el-select>
            </div>
          </div>
          <div class="row">
            <label>{{ t('tickets.assigneeLabel') }}</label>
            <div class="editor-box">
              <el-select v-model="form.assigneeUserId" clearable filterable style="width: 100%;" @change="scheduleAutoSave">
                <el-option
                  v-for="assignee in assignees"
                  :key="assignee.id"
                  :label="assignee.name"
                  :value="assignee.id"
                />
              </el-select>
            </div>
          </div>
          <div class="row multiline-row">
            <label>{{ t('tickets.assetLabel') }}</label>
            <div class="editor-box">
              <el-select
                v-model="form.assetCodes"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                style="width: 100%;"
                @change="scheduleAutoSave"
              >
                <el-option
                  v-for="asset in availableAssets"
                  :key="asset.mcCode"
                  :label="`${asset.name || asset.mcCode} (${asset.mcCode})`"
                  :value="asset.mcCode"
                />
              </el-select>
              <div class="field-hint">
                {{ t('tickets.assetCascadeHint') }}
              </div>
            </div>
          </div>
          <div class="row">
            <label>{{ t('tickets.priorityLabel') }}</label>
            <div class="editor-box">
              <el-select v-model="form.priority" style="width: 100%;" @change="scheduleAutoSave">
                <el-option :label="t('tickets.priorityLow')" value="low" />
                <el-option :label="t('tickets.priorityMedium')" value="medium" />
                <el-option :label="t('tickets.priorityHigh')" value="high" />
              </el-select>
            </div>
          </div>
          <div class="row">
            <label>{{ t('tickets.statusLabel') }}</label>
            <div class="editor-box">
              <el-select v-model="form.status" style="width: 100%;" @change="scheduleAutoSave">
                <el-option :label="t('tickets.statusNew')" value="new" />
                <el-option :label="t('tickets.statusCompleted')" value="completed" />
                <el-option :label="t('tickets.statusClosed')" value="closed" />
              </el-select>
            </div>
          </div>
        </div>
      </section>

      <section class="detail-group">
        <div class="group-header">{{ t('tickets.timeInfoTitle') }}</div>
        <div class="group-body">
          <div class="row">
            <label>{{ t('tickets.createdByLabel') }}</label>
            <div class="val-box">{{ ticket.creatorName || t('common.none') }}</div>
          </div>
          <div class="row">
            <label>{{ t('tickets.createdAtLabel') }}</label>
            <div class="val-box">{{ formatDateTime(ticket.createdAt) }}</div>
          </div>
          <div class="row">
            <label>{{ t('tickets.updatedAtLabel') }}</label>
            <div class="val-box">{{ formatDateTime(ticket.updatedAt) }}</div>
          </div>
          <div class="row">
            <label>{{ t('tickets.completedAtLabel') }}</label>
            <div class="val-box">{{ formatDateTime(ticket.completedAt) }}</div>
          </div>
          <div class="row">
            <label>{{ t('tickets.closedAtLabel') }}</label>
            <div class="val-box">{{ formatDateTime(ticket.closedAt) }}</div>
          </div>
        </div>
      </section>

      <section class="detail-group">
        <div class="group-header">{{ t('tickets.attachmentLabel') }}</div>
        <div class="group-body">
          <div v-if="ticket.attachments?.length" class="attachment-list">
            <a
              v-for="attachment in ticket.attachments"
              :key="attachment.id"
              class="attachment-item"
              :href="attachment.filePath"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>{{ attachment.originalName }}</strong>
              <span>{{ formatFileSize(attachment.fileSize) }}</span>
            </a>
          </div>
          <div v-else class="val-box multiline-box muted-text">
            {{ t('tickets.noAttachments') }}
          </div>
        </div>
      </section>
      </div>

      <div class="panel-actions">
        <el-button :disabled="submitting || !isDirty" @click="resetForm">
          {{ t('dataExport.mappingConfig.reset') }}
        </el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ t('common.save') }}
        </el-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { matchesAssetToSpace } from '@/utils/ticketAssetSpace';
import TicketStatusTag from './TicketStatusTag.vue';

const props = defineProps({
  ticket: { type: Object, default: null },
  spaces: { type: Array, default: () => [] },
  assets: { type: Array, default: () => [] },
  assignees: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false }
});

const emit = defineEmits(['save-ticket']);
const { t } = useI18n();

const form = ref({
  title: '',
  description: '',
  spaceCode: '',
  assetCodes: [],
  assigneeUserId: null,
  priority: 'medium',
  status: 'new'
});

const initialState = ref('');
let autoSaveTimer = null;

const sortedSpaces = computed(() => (
  [...props.spaces].sort((left, right) => {
    const leftKey = `${left.floor || ''}-${left.name || ''}-${left.code || ''}`;
    const rightKey = `${right.floor || ''}-${right.name || ''}-${right.code || ''}`;
    return leftKey.localeCompare(rightKey, 'zh-Hans-CN');
  })
));

const selectedSpace = computed(() => (
  props.spaces.find((space) => space.code === form.value.spaceCode) || null
));

const availableAssets = computed(() => {
  if (selectedSpace.value) {
    return props.assets.filter((asset) => matchesAssetToSpace(asset, selectedSpace.value));
  }

  const fallbackAssetCodes = new Set(form.value.assetCodes.filter(Boolean));
  if (fallbackAssetCodes.size === 0) {
    return [];
  }

  return props.assets.filter((asset) => fallbackAssetCodes.has(asset.mcCode));
});

const serializeForm = (value) => JSON.stringify({
  title: value.title || '',
  description: value.description || '',
  spaceCode: value.spaceCode || '',
  assetCodes: [...(value.assetCodes || [])].sort(),
  assigneeUserId: value.assigneeUserId || null,
  priority: value.priority || 'medium',
  status: value.status || 'new'
});

const clearAutoSaveTimer = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
};

const applyTicket = () => {
  clearAutoSaveTimer();
  if (!props.ticket) {
    form.value = {
      title: '',
      description: '',
      spaceCode: '',
      assetCodes: [],
      assigneeUserId: null,
      priority: 'medium',
      status: 'new'
    };
    initialState.value = serializeForm(form.value);
    return;
  }

  form.value = {
    title: props.ticket.title || '',
    description: props.ticket.description || '',
    spaceCode: props.ticket.sourceSpaceCode || '',
    assetCodes: (props.ticket.assets || []).map((asset) => asset.assetCode),
    assigneeUserId: props.ticket.assigneeUserId || null,
    priority: props.ticket.priority || 'medium',
    status: props.ticket.status || 'new'
  };
  initialState.value = serializeForm(form.value);
};

watch(
  () => props.ticket,
  () => {
    applyTicket();
  },
  { immediate: true, deep: true }
);

const isDirty = computed(() => serializeForm(form.value) !== initialState.value);

const handleSpaceChange = () => {
  if (!selectedSpace.value) return;
  const availableAssetCodes = new Set(availableAssets.value.map((asset) => asset.mcCode));
  form.value.assetCodes = form.value.assetCodes.filter((assetCode) => availableAssetCodes.has(assetCode));
};

const canSubmit = computed(() => (
  Boolean(props.ticket) &&
  Boolean(form.value.spaceCode) &&
  Boolean(form.value.description.trim())
));

const buildPayload = () => ({
  title: form.value.title.trim(),
  description: form.value.description.trim(),
  spaceCode: form.value.spaceCode,
  assetCodes: form.value.assetCodes,
  assigneeUserId: form.value.assigneeUserId,
  priority: form.value.priority,
  status: form.value.status,
  keepAttachmentIds: (props.ticket?.attachments || []).map((attachment) => attachment.id)
});

const emitSave = (silent = false) => {
  if (!props.ticket) return;
  emit('save-ticket', {
    id: props.ticket.id,
    payload: buildPayload(),
    silent
  });
};

const scheduleAutoSave = () => {
  clearAutoSaveTimer();
  if (!isDirty.value || props.submitting || !canSubmit.value) {
    return;
  }
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    if (!props.submitting && isDirty.value && canSubmit.value) {
      emitSave(true);
    }
  }, 320);
};

const handleSpaceSelectionChange = () => {
  handleSpaceChange();
  scheduleAutoSave();
};

const resetForm = () => {
  clearAutoSaveTimer();
  applyTicket();
};

const submit = () => {
  if (!props.ticket) return;
  if (!form.value.spaceCode) {
    ElMessage.warning(t('tickets.spaceRequired'));
    return;
  }
  if (!form.value.description.trim()) {
    ElMessage.warning(t('tickets.descriptionRequired'));
    return;
  }

  clearAutoSaveTimer();
  emitSave(false);
};

const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatFileSize = (value) => {
  const size = Number(value || 0);
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

onBeforeUnmount(() => {
  clearAutoSaveTimer();
});
</script>

<style scoped>
.ticket-detail-panel {
  width: 100%;
  height: 100%;
  background: var(--md-sys-color-surface);
  border-left: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: var(--md-sys-color-on-surface);
  user-select: none;
  overflow: hidden;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-header {
  min-height: 56px;
  padding: 10px 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-low);
}

.header-copy {
  min-width: 0;
}

.panel-title {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface-variant);
}

.panel-code {
  font-size: 14px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  word-break: break-all;
}

.empty-state {
  flex: 1;
  margin: 12px;
  border: 1px dashed var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  padding: 24px;
}

.empty-state p {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.6;
}

.detail-group {
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.detail-group:first-of-type {
  border-top: none;
}

.group-header {
  background: var(--md-sys-color-surface-container);
  padding: 8px 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface);
}

.group-body {
  padding: 8px 12px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}

.row:last-child {
  margin-bottom: 0;
}

.row label,
.field-label {
  flex: 0 0 72px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 24px;
}

.multiline-row {
  align-items: flex-start;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.field-block:last-child {
  margin-bottom: 0;
}

.editor-box,
.val-box {
  flex: 1;
  min-width: 0;
}

.val-box {
  min-height: 24px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--input-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.multiline-box {
  min-height: 36px;
  align-items: flex-start;
  padding: 6px 8px;
  white-space: normal;
  line-height: 1.5;
}

.muted-text {
  color: var(--md-sys-color-on-surface-variant);
}

.field-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.4;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: inherit;
  text-decoration: none;
}

.attachment-item span {
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
}

.attachment-item strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-actions {
  margin-top: auto;
  padding: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-low);
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-textarea__inner) {
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--input-border) inset;
  background: var(--input-bg);
  color: var(--input-text);
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-select__wrapper.is-focused),
:deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px var(--md-sys-color-primary) inset;
}

:deep(.el-input__inner),
:deep(.el-textarea__inner),
:deep(.el-select__placeholder),
:deep(.el-select__selected-item) {
  font-size: 11px;
}
</style>
