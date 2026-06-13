<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="760px"
    destroy-on-close
    @close="$emit('close')"
  >
    <el-form label-position="top" class="ticket-form">
      <div class="grid two-col">
        <el-form-item :label="t('tickets.titleLabel')">
          <el-input v-model="form.title" maxlength="200" />
        </el-form-item>
        <el-form-item :label="t('tickets.ticketNoLabel')">
          <el-input :model-value="ticket?.ticketNo || t('tickets.ticketNoHint')" disabled />
        </el-form-item>
      </div>

      <el-form-item :label="t('tickets.descriptionLabel')" required>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          :placeholder="t('tickets.descriptionPlaceholder')"
        />
      </el-form-item>

      <div class="grid two-col">
        <el-form-item :label="t('tickets.spaceLabel')" required>
          <el-select
            v-model="form.spaceCode"
            filterable
            :disabled="lockedSpace"
            style="width: 100%;"
            @change="handleSpaceChange"
          >
            <el-option
              v-for="space in sortedSpaces"
              :key="space.code"
              :label="`${space.floor || '-'} / ${space.name || space.code}`"
              :value="space.code"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('tickets.assigneeLabel')">
          <el-select
            v-model="form.assigneeUserId"
            clearable
            filterable
            style="width: 100%;"
          >
            <el-option
              v-for="assignee in assignees"
              :key="assignee.id"
              :label="assignee.name"
              :value="assignee.id"
            >
              <div class="assignee-option">
                <span>{{ assignee.name }}</span>
                <small>{{ assignee.roles?.join(', ') }}</small>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </div>

      <div class="grid two-col">
        <el-form-item :label="t('tickets.assetLabel')">
          <el-select
            v-model="form.assetCodes"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%;"
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
        </el-form-item>

        <div class="grid two-col nested-grid">
          <el-form-item :label="t('tickets.priorityLabel')">
            <el-select v-model="form.priority" style="width: 100%;">
              <el-option :label="t('tickets.priorityLow')" value="low" />
              <el-option :label="t('tickets.priorityMedium')" value="medium" />
              <el-option :label="t('tickets.priorityHigh')" value="high" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('tickets.statusLabel')">
            <el-select v-model="form.status" style="width: 100%;">
              <el-option :label="t('tickets.statusNew')" value="new" />
              <el-option :label="t('tickets.statusCompleted')" value="completed" />
              <el-option :label="t('tickets.statusClosed')" value="closed" />
            </el-select>
          </el-form-item>
        </div>
      </div>

      <el-form-item :label="t('tickets.attachmentLabel')">
        <div v-if="existingAttachments.length" class="attachment-list">
          <div v-for="attachment in existingAttachments" :key="attachment.id" class="attachment-item">
            <a :href="attachment.filePath" target="_blank" rel="noopener noreferrer">{{ attachment.originalName }}</a>
            <el-button link type="danger" @click="removeExistingAttachment(attachment.id)">
              {{ t('common.delete') }}
            </el-button>
          </div>
        </div>
        <el-upload
          :auto-upload="false"
          :file-list="uploadFileList"
          :limit="10"
          multiple
          @change="handleUploadChange"
          @remove="handleUploadRemove"
        >
          <el-button type="primary" plain>{{ t('tickets.addAttachment') }}</el-button>
        </el-upload>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('close')">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ mode === 'edit' ? t('common.save') : t('tickets.createTicket') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { matchesAssetToSpace } from '@/utils/ticketAssetSpace';

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'create' },
  ticket: { type: Object, default: null },
  context: { type: Object, default: null },
  spaces: { type: Array, default: () => [] },
  assets: { type: Array, default: () => [] },
  assignees: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'submit']);
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
const uploadFileList = ref([]);
const existingAttachments = ref([]);

const dialogTitle = computed(() => (
  props.mode === 'edit' ? t('tickets.editTicket') : t('tickets.createTicket')
));

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

  const fallbackAssetCodes = new Set(
    [...(props.context?.assetCodes || []), ...form.value.assetCodes].filter(Boolean)
  );
  if (fallbackAssetCodes.size === 0) {
    return [];
  }

  return props.assets.filter((asset) => fallbackAssetCodes.has(asset.mcCode));
});

const lockedSpace = computed(() => props.mode === 'create' && Boolean(props.context?.spaceCode));

const applyInitialState = () => {
  if (props.mode === 'edit' && props.ticket) {
    form.value = {
      title: props.ticket.title || '',
      description: props.ticket.description || '',
      spaceCode: props.ticket.sourceSpaceCode || '',
      assetCodes: (props.ticket.assets || []).map((asset) => asset.assetCode),
      assigneeUserId: props.ticket.assigneeUserId || null,
      priority: props.ticket.priority || 'medium',
      status: props.ticket.status || 'new'
    };
    existingAttachments.value = [...(props.ticket.attachments || [])];
  } else {
    form.value = {
      title: '',
      description: '',
      spaceCode: props.context?.spaceCode || '',
      assetCodes: [...(props.context?.assetCodes || [])],
      assigneeUserId: null,
      priority: 'medium',
      status: 'new'
    };
    existingAttachments.value = [];
  }
  uploadFileList.value = [];
};

watch(
  () => [props.visible, props.mode, props.ticket, props.context],
  () => {
    if (props.visible) {
      applyInitialState();
    }
  },
  { deep: true, immediate: true }
);

const handleSpaceChange = () => {
  if (!selectedSpace.value) return;
  const availableAssetCodes = new Set(availableAssets.value.map((asset) => asset.mcCode));
  form.value.assetCodes = form.value.assetCodes.filter((assetCode) => availableAssetCodes.has(assetCode));
};

const handleUploadChange = (file, fileList) => {
  uploadFileList.value = fileList;
};

const handleUploadRemove = (file, fileList) => {
  uploadFileList.value = fileList;
};

const removeExistingAttachment = (attachmentId) => {
  existingAttachments.value = existingAttachments.value.filter((attachment) => attachment.id !== attachmentId);
};

const submit = () => {
  if (!form.value.spaceCode) {
    ElMessage.warning(t('tickets.spaceRequired'));
    return;
  }
  if (!form.value.description.trim()) {
    ElMessage.warning(t('tickets.descriptionRequired'));
    return;
  }

  emit('submit', {
    payload: {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      spaceCode: form.value.spaceCode,
      assetCodes: form.value.assetCodes,
      assigneeUserId: form.value.assigneeUserId,
      priority: form.value.priority,
      status: form.value.status,
      keepAttachmentIds: existingAttachments.value.map((attachment) => attachment.id)
    },
    files: uploadFileList.value.map((item) => item.raw).filter(Boolean)
  });
};
</script>

<style scoped>
.ticket-form {
  padding-right: 4px;
}

.grid {
  display: grid;
  gap: 16px;
}

.two-col {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.nested-grid {
  align-self: start;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.attachment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--md-sys-color-surface-container-low);
}

.attachment-item a {
  color: var(--md-sys-color-primary);
  text-decoration: none;
  word-break: break-all;
}

.assignee-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.assignee-option small {
  color: var(--md-sys-color-on-surface-variant);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 760px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
