<template>
  <div class="editable-field" @click="startEdit">
    <!-- 显示模式 -->
    <div 
      v-if="!editing" 
      class="val-box" 
      :class="{ placeholder: isPlaceholder, varies: isVaries }"
      :title="isVaries ? t('common.clickToEditAll') : ''"
    >
      {{ displayValue }}
    </div>
    
    <!-- 编辑模式：使用 el-input -->
    <el-input
      v-else
      ref="inputRef"
      v-model="editValue"
      :type="inputType"
      size="small"
      @blur="handleBlur"
      @keydown.enter="confirmEdit"
      @keydown.esc="cancelEdit"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  fieldType: {
    type: String,
    default: 'text' // 'text', 'number', 'date'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const editing = ref(false);
const editValue = ref('');
const inputRef = ref(null);

// 格式化显示值
const displayValue = computed(() => {
  const val = props.modelValue;
  if (val === '__VARIES__') {
    return t('common.varies');
  }
  if (val == null || val === '') {
    return props.placeholder || t('common.none');
  }
  return String(val);
});

const isPlaceholder = computed(() => {
  const val = props.modelValue;
  return val === '__VARIES__' || val == null || val === '';
});

const isVaries = computed(() => {
  return props.modelValue === '__VARIES__';
});

// 根据字段类型确定 input type
const inputType = computed(() => {
  if (props.fieldType === 'number') return 'number';
  // el-input 不支持 date type，使用 text
  return 'text';
});

// 开始编辑
const startEdit = async () => {
  if (props.disabled) return;
  
  editing.value = true;
  
  // 如果当前值是 __VARIES__（多个不同值），清空输入框让用户输入新值
  if (props.modelValue === '__VARIES__') {
    editValue.value = '';
  } else {
    editValue.value = props.modelValue || '';
  }
  
  await nextTick();
  // el-input 的 focus 需要访问内部 input 元素
  inputRef.value?.focus();
  inputRef.value?.select();
};

// 确认编辑
const confirmEdit = () => {
  const newValue = editValue.value?.toString().trim();
  if (newValue !== props.modelValue) {
    emit('update:modelValue', newValue);
    emit('change', newValue);
  }
  editing.value = false;
};

// 取消编辑
const cancelEdit = () => {
  editValue.value = props.modelValue || '';
  editing.value = false;
};

// 失去焦点时确认编辑
const handleBlur = () => {
  confirmEdit();
};
</script>

<style scoped>
.editable-field {
  flex: 1;
  min-width: 0;
}

.val-box {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  min-height: 24px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-radius: var(--input-radius);
  color: var(--input-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
  transition: all 0.2s;
  font-size: 10px;
}

.val-box:hover {
  border-color: var(--md-sys-color-outline);
  background: var(--md-sys-color-surface-container);
}

.val-box.placeholder {
  color: var(--input-placeholder);
  font-style: normal;
}

.val-box.varies {
  color: var(--md-sys-color-primary);
  font-style: italic;
  border-color: var(--md-sys-color-outline-variant);
}

.val-box.varies:hover {
  border-color: var(--md-sys-color-primary);
  background: var(--input-bg);
  color: var(--md-sys-color-primary);
}

/* el-input 尺寸适配 - 紧凑风格 */
:deep(.el-input__wrapper) {
  min-height: 24px;
  padding: 0 8px;
  box-shadow: none !important;
}

:deep(.el-input__inner) {
  height: 22px;
  line-height: 22px;
  font-size: 10px;
}

:deep(.el-input) {
  --el-input-height: 24px;
}
</style>
