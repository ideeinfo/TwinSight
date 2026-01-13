<template>
  <el-select 
    :model-value="modelValue" 
    :placeholder="placeholder"
    filterable 
    clearable
    class="full-width-select"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-option
      v-for="item in options"
      :key="item"
      :label="item"
      :value="item"
    />
  </el-select>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: 'Select...'
  }
});

defineEmits(['update:modelValue']);
</script>

<style scoped>
.full-width-select {
  width: 100%;
}
</style>
