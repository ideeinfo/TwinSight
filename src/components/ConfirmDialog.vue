<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="400px"
    :close-on-click-modal="false"
    destroy-on-close
    class="custom-dialog"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleCancel"
  >
    <div class="dialog-body-content">
      <!-- Input mode -->
      <el-input 
        v-if="type === 'prompt'" 
        ref="inputRef"
        v-model="inputValue" 
        :placeholder="placeholder"
        @keydown.enter="handleConfirm"
      />
      <!-- Message mode -->
      <p v-else class="dialog-message">{{ message }}</p>
      <!-- Extra slot for custom content -->
      <slot name="extra"></slot>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button v-if="type !== 'alert'" @click="handleCancel">
          {{ finalCancelText }}
        </el-button>
        <el-button 
          :type="danger ? 'danger' : 'primary'"
          :disabled="type === 'prompt' && !inputValue.trim()"
          @click="handleConfirm"
        >
          {{ finalConfirmText }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue';

import { useI18n } from 'vue-i18n';
import { Close } from '@element-plus/icons-vue';

const { t } = useI18n();

const props = defineProps({
  visible: { type: Boolean, default: false },
  type: { type: String, default: 'confirm' }, // 'confirm', 'alert', 'prompt'
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  defaultValue: { type: String, default: '' },
  confirmText: { type: String, default: '' },
  cancelText: { type: String, default: '' },
  danger: { type: Boolean, default: false },
  dialogClass: { type: String, default: '' }
});

const emit = defineEmits(['confirm', 'cancel', 'update:visible']);

const inputRef = ref(null);
const inputValue = ref('');

// Computed default texts
const finalConfirmText = computed(() => props.confirmText || t('common.confirm'));
const finalCancelText = computed(() => props.cancelText || t('common.cancel'));

// Watch for visible changes to reset input
watch(() => props.visible, (newVal) => {
  if (newVal) {
    inputValue.value = props.defaultValue;
    if (props.type === 'prompt') {
      nextTick(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
      });
    }
  }
});

const handleConfirm = () => {
  if (props.type === 'prompt') {
    emit('confirm', inputValue.value);
  } else {
    emit('confirm');
  }
  emit('update:visible', false);
};

const handleCancel = () => {
  emit('cancel');
  emit('update:visible', false);
};
</script>

<style scoped>
/* 模态框样式移除，使用 el-dialog */
.dialog-body-content {
  padding: 10px 0;
}

.dialog-message {
  color: #ccc;
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
  word-break: break-word;
}



</style>
