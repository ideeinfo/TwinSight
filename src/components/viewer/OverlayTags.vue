<template>
  <div class="overlay-tags">
    <div
      v-for="tag in visibleTags"
      :key="tag.dbId"
      class="tag-wrapper"
      :style="{ top: tag.y + 'px', left: tag.x + 'px' }"
    >
      <div class="tag-pin selected">
        <div class="pin-val" :class="{ 'no-data': !hasValidData(tag.currentTemp) }">
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
 * 检查是否有有效的温度数据
 */
const hasValidData = (temp) => {
  if (temp === null || temp === undefined) return false;
  // 检查是否是默认值（25）且没有实际数据
  const numTemp = parseFloat(temp);
  return !isNaN(numTemp);
};

/**
 * 格式化温度显示
 */
const formatTemperature = (temp) => {
  if (temp === null || temp === undefined) return 'N/A';
  const numTemp = parseFloat(temp);
  if (isNaN(numTemp)) return 'N/A';
  return `${temp} °C`;
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
  transform: translate(-50%, -50%);
  pointer-events: auto;
  cursor: pointer;
}

.tag-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pin-val {
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  /* 透明底色 + 白边 */
  background: rgba(128, 128, 128, 0.3);
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  /* 白色粗体字 + 黑色阴影 */
  color: #fff;
  text-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.9),
    0 0 4px rgba(0, 0, 0, 0.5);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.pin-val:hover {
  background: rgba(128, 128, 128, 0.4);
  transform: scale(1.05);
}

/* 无数据时显示浅红色 */
.pin-val.no-data {
  color: #ff9999;
  background: rgba(255, 100, 100, 0.2);
  border-color: rgba(255, 150, 150, 0.6);
}
</style>
