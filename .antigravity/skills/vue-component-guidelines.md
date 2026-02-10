---
name: vue-component-guidelines
description: Guidelines for creating Vue 3 components in this project. Use when creating or refactoring .vue files.
---
# Vue & Element Plus Guidelines

## 1. Core Stack
- **Framework**: Vue 3 (Composition API `<script setup>`)
- **UI Library**: Element Plus
- **Styling**: Vanilla CSS or Scoped CSS. Avoid Tailwind unless explicitly requested.

## 2. Component Structure
- Use `<script setup>` syntax.
- Props definitions should be strict (using `defineProps` with types).
- Emits should be defined using `defineEmits`.

## 3. Aesthetics & UX
- **Visuals**: Use modern, clean aesthetics. High contrast, proper spacing.
- **Interactivity**: Add hover effects, smooth transitions.
- **Responsiveness**: Ensure layouts work on different screen sizes.

## 4. Example Pattern
```vue
<script setup>
import { ref } from 'vue';
import { ElButton, ElCard } from 'element-plus';

const props = defineProps({
  title: String,
});

const emit = defineEmits(['action']);
</script>

<template>
  <el-card class="box-card">
    <template #header>
      <div class="card-header">
        <span>{{ title }}</span>
        <el-button class="button" text @click="$emit('action')">Operation</el-button>
      </div>
    </template>
    <div class="text item">Content</div>
  </el-card>
</template>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
```
