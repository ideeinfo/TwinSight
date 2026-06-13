<template>
  <div class="point-overlay">
    <button
      v-for="point in visiblePoints"
      :key="point.id"
      class="point-tag"
      type="button"
      :class="[`type-${point.pointType}`, { selected: point.id === selectedPointId, alert: isAlert(point) }]"
      :style="{ left: `${point.x}px`, top: `${point.y}px` }"
      @click.stop="$emit('point-click', point)"
    >
      <span class="point-icon">{{ getIcon(point.pointType) }}</span>
      <span class="point-value">{{ formatPoint(point) }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  points: { type: Array, default: () => [] },
  selectedPointId: { type: Number, default: null }
});

defineEmits(['point-click']);

const visiblePoints = computed(() => props.points.filter((point) => point.visible));

const icons = {
  temperature: 'T',
  humidity: 'H',
  illuminance: 'L',
  displacement: 'D',
  vibration: 'V',
  energy: 'E',
  electricity: 'E',
  water: 'W',
  gas: 'G',
  video: 'CAM'
};

const getIcon = (type) => icons[type] || 'P';

const isAlert = (point) => {
  if (point.latestValue === null || point.latestValue === undefined) return false;
  if (point.thresholdMin !== null && point.thresholdMin !== undefined && point.latestValue < point.thresholdMin) return true;
  if (point.thresholdMax !== null && point.thresholdMax !== undefined && point.latestValue > point.thresholdMax) return true;
  return false;
};

const formatPoint = (point) => {
  if (point.dataKind === 'video') return point.name || 'Video';
  if (point.latestValue === null || point.latestValue === undefined) return point.name || point.pointCode;
  const value = Number(point.latestValue);
  return `${Number.isFinite(value) ? value.toFixed(1) : point.latestValue}${point.unit || ''}`;
};
</script>

<style scoped>
.point-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 9;
}

.point-tag {
  position: absolute;
  transform: translate(-50%, -100%);
  min-width: 46px;
  max-width: 140px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--point-color, #87d1eb) 65%, #000 12%);
  border-radius: 2px;
  background: color-mix(in srgb, var(--point-color, #87d1eb) 22%, rgba(18, 20, 23, 0.88));
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  pointer-events: auto;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.26);
}

.point-tag::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 8px;
  height: 8px;
  border-right: 1px solid color-mix(in srgb, var(--point-color, #87d1eb) 65%, #000 12%);
  border-bottom: 1px solid color-mix(in srgb, var(--point-color, #87d1eb) 65%, #000 12%);
  background: inherit;
  transform: translateX(-50%) rotate(45deg);
}

.point-tag.selected {
  outline: 2px solid #fff;
}

.point-tag.alert {
  --point-color: #ef4444;
}

.point-icon {
  flex: 0 0 auto;
  min-width: 16px;
  text-align: center;
  font-size: 9px;
  color: var(--point-color, #87d1eb);
}

.point-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-temperature { --point-color: #e76f51; }
.type-humidity { --point-color: #2a9d8f; }
.type-illuminance { --point-color: #f4a261; }
.type-displacement { --point-color: #5e81ac; }
.type-vibration { --point-color: #b56576; }
.type-energy,
.type-electricity { --point-color: #e9c46a; }
.type-water { --point-color: #219ebc; }
.type-gas { --point-color: #8d99ae; }
.type-video { --point-color: #6c757d; }
</style>
