<template>
  <div class="viewer-controls">
    <!-- 温度标签按钮 -->
    <div
      v-if="showTemperatureButton"
      class="control-btn temperature-label-btn"
      :class="{ active: temperatureLabelsVisible }"
      @click="$emit('toggle-temperature-labels')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" style="margin-right: 6px;">
        <text x="2" y="12" font-size="10" fill="currentColor" font-weight="bold">°C</text>
      </svg>
      {{ t('header.temperatureLabel') }}
    </div>

    <!-- 热力图按钮 -->
    <div
      v-if="showHeatmapButton"
      class="control-btn heatmap-btn"
      :class="{ active: heatmapEnabled }"
      @click="$emit('toggle-heatmap')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" style="margin-right: 6px;">
        <defs>
          <linearGradient id="heatGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#4FC3F7;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#FFA726;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#EF5350;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="12" height="12" rx="2" fill="url(#heatGradient)" opacity="0.8"/>
      </svg>
      {{ t('header.heatmap') }}
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
  showTemperatureButton: {
    type: Boolean,
    default: true,
  },
  showHeatmapButton: {
    type: Boolean,
    default: true,
  },
  temperatureLabelsVisible: {
    type: Boolean,
    default: false,
  },
  heatmapEnabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['toggle-temperature-labels', 'toggle-heatmap']);
</script>

<style scoped>
.viewer-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
}

.control-btn {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.control-btn:hover {
  background: rgba(50, 50, 50, 0.95);
  border-color: rgba(255, 255, 255, 0.2);
}

.control-btn.active {
  background: rgba(33, 150, 243, 0.9);
  border-color: rgba(33, 150, 243, 0.5);
}

.control-btn.active:hover {
  background: rgba(33, 150, 243, 1);
}

.temperature-label-btn {
  /* 温度标签按钮特定样式 */
}

.heatmap-btn {
  /* 热力图按钮特定样式 */
}
</style>
