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
    
    <!-- 编辑模式 -->
    <input
      v-else
      ref="inputRef"
      v-model="editValue"
      :type="inputType"
      class="edit-input"
      @blur="handleBlur"
      @keydown.enter="confirmEdit"
      @keydown.esc="cancelEdit"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
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
  if (props.fieldType === 'date') return 'date';
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
  inputRef.value?.focus();
  inputRef.value?.select();
};

// 确认编辑
const confirmEdit = () => {
  const newValue = editValue.value?.trim();
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
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  min-height: 24px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 2px;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
  transition: all 0.2s;
}

.val-box:hover {
  border-color: #555;
  background: #252526;
}

.val-box.placeholder {
  color: #777;
  font-style: normal;
}

.val-box.varies {
  color: #9cdcfe;
  font-style: italic;
  border-color: #4a4a4a;
}

.val-box.varies:hover {
  border-color: #0078d4;
  background: #1e1e1e;
  color: #6cb6ff;
}

.edit-input {
  width: 100%;
  background: #1e1e1e;
  border: 1px solid #0078d4;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 2px;
  color: #eee;
  font-size: 11px;
  font-family: inherit;
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.3);
}

.edit-input:focus {
  border-color: #0078d4;
}

/* 隐藏数字输入框的上下箭头（spinner） */
.edit-input[type="number"]::-webkit-outer-spin-button,
.edit-input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.edit-input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
