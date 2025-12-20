<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <div class="dialog" :class="dialogClass">
        <div class="dialog-header">
          <h4>{{ title }}</h4>
          <button class="btn-close-dialog" @click="handleCancel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="dialog-body">
          <!-- Input mode -->
          <input 
            v-if="type === 'prompt'" 
            ref="inputRef"
            type="text" 
            v-model="inputValue" 
            :placeholder="placeholder"
            @keyup.enter="handleConfirm"
          />
          <!-- Message mode -->
          <p v-else class="dialog-message">{{ message }}</p>
        </div>
        <div class="dialog-footer">
          <button v-if="type !== 'alert'" class="btn-cancel" @click="handleCancel">
            {{ finalCancelText }}
          </button>
          <button 
            class="btn-confirm" 
            :class="{ 'btn-danger': danger }"
            @click="handleConfirm"
            :disabled="type === 'prompt' && !inputValue.trim()"
          >
            {{ finalConfirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue';
import { useI18n } from 'vue-i18n';

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
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.dialog {
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  min-width: 300px;
  max-width: 450px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
}

.dialog-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.btn-close-dialog {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close-dialog:hover {
  color: #fff;
}

.dialog-body {
  padding: 16px;
}

.dialog-message {
  color: #ccc;
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
  word-break: break-word;
}

.dialog-body input {
  width: 100%;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 13px;
  color: #fff;
  outline: none;
  box-sizing: border-box;
}

.dialog-body input:focus {
  border-color: #38ABDF;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #3e3e42;
}

.btn-cancel, .btn-confirm {
  padding: 6px 16px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #3e3e42;
  color: #ccc;
}

.btn-cancel:hover {
  border-color: #555;
  color: #fff;
}

.btn-confirm {
  background: #38ABDF;
  border: none;
  color: #fff;
  font-weight: 500;
}

.btn-confirm:hover {
  background: #2D9ACC;
}

.btn-confirm:disabled {
  background: #3e3e42;
  color: #666;
  cursor: not-allowed;
}

.btn-confirm.btn-danger {
  background: #dc3545;
}

.btn-confirm.btn-danger:hover {
  background: #c82333;
}
</style>
