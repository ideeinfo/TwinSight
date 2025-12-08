<template>
  <div class="chart-header">
    <div class="title-section">
      <svg class="chart-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
      <span class="label">{{ labelText }}</span>
    </div>
    <div class="tools">
      <span class="date-range">{{ dateRangeText }}</span>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  labelText: { type: String, default: '' },
  range: { type: Object, default: null },
  fallbackStartMs: { type: Number, default: 0 },
  fallbackEndMs: { type: Number, default: 0 }
})

const dateRangeText = computed(() => {
  const s = props.range?.startMs || props.fallbackStartMs
  const e = props.range?.endMs || props.fallbackEndMs
  if (!s || !e) return ''
  const sd = new Date(s)
  const ed = new Date(e)
  return `${sd.toLocaleDateString()} - ${ed.toLocaleDateString()}`
})
</script>

<style scoped>
.chart-header { height: 32px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #333; background: #252526; }
.title-section { display: flex; align-items: center; gap: 6px; }
.chart-icon { color: #0078d4; }
.label { font-size: 12px; font-weight: 600; color: #eee; }
.tools { display: flex; align-items: center; gap: 12px; }
.date-range { font-size: 11px; color: #888; }
.close { background: none; border: none; color: #ccc; cursor: pointer; font-size: 18px; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transition: color 0.2s; }
.close:hover { color: #f48771; }
</style>
