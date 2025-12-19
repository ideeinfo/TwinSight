<template>
  <div class="overlay-tags">
    <div
      v-for="tag in visibleTags"
      :key="tag.dbId"
      class="tag-wrapper"
      :style="{ top: tag.y + 'px', left: tag.x + 'px' }"
    >
      <div class="tag-pin selected">
        <div class="pin-val blue" :style="getTagStyle(tag.currentTemp)">
          {{ formatTemperature(tag.currentTemp) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  tags: {
    type: Array,
    default: () => [],
  },
  visible: {
    type: Boolean,
    default: true,
  },
  minTemp: {
    type: Number,
    default: 15,
  },
  maxTemp: {
    type: Number,
    default: 35,
  },
});

// 只显示可见且有位置的标签
const visibleTags = computed(() => {
  if (!props.visible) return [];
  return props.tags.filter(tag => tag.visible && tag.x !== undefined && tag.y !== undefined);
});

/**
 * 格式化温度显示
 */
const formatTemperature = (temp) => {
  if (temp === null || temp === undefined) return '--';
  return `${temp} °C`;
};

/**
 * 根据温度值计算标签样式
 */
const getTagStyle = (temp) => {
  if (temp === null || temp === undefined) {
    return { backgroundColor: '#888' };
  }
  
  // 归一化到 0-1
  const normalized = Math.max(0, Math.min(1, (temp - props.minTemp) / (props.maxTemp - props.minTemp)));
  
  // 从蓝色 (240°) 到红色 (0°)
  const hue = (1 - normalized) * 240;
  
  return {
    backgroundColor: `hsl(${hue}, 80%, 50%)`,
    color: normalized > 0.5 ? '#fff' : '#000',
  };
};
</script>

<style scoped>
.overlay-tags {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.tag-wrapper {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: auto;
  cursor: pointer;
}

.tag-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tag-pin.selected .pin-val {
  animation: pulse 2s infinite;
}

.pin-val {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: background-color 0.3s, transform 0.2s;
}

.pin-val:hover {
  transform: scale(1.1);
}

.pin-val.blue {
  background: linear-gradient(135deg, #4fc3f7, #29b6f6);
  color: #fff;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  50% {
    box-shadow: 0 2px 16px rgba(79, 195, 247, 0.6);
  }
}
</style>
