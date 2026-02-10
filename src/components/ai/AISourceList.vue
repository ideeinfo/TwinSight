<template>
  <div v-if="sources && sources.length" class="ai-source-list">
    <div class="source-header">参考文档</div>
    <div class="source-items">
      <div 
        v-for="(src, index) in sources" 
        :key="src.id || index" 
        class="source-item" 
        @click="$emit('open-source', src)"
        :title="src.name"
      >
        <span class="source-index">[{{ index + 1 }}]</span>
        <span class="source-name">{{ src.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  sources: {
    type: Array,
    default: () => []
  }
});

defineEmits(['open-source']);
</script>

<style scoped>
.ai-source-list {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.dark-mode-active .ai-source-list {
  border-top-color: rgba(255, 255, 255, 0.1);
}

.source-header {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.source-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-item {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 100%;
}

.dark-mode-active .source-item {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.source-item:hover {
  background: var(--accent-glow);
  color: var(--accent-color);
  border-color: var(--accent-color);
  transform: translateY(-1px);
}

.source-index {
  color: var(--accent-color);
  font-weight: 600;
  margin-right: 6px;
  font-family: monospace;
}

.source-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
</style>
