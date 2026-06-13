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
      <span class="tag-pin">
        <span class="pin-val" :class="{ 'no-data': !hasValidValue(point) }">
          {{ formatPoint(point) }}
        </span>
      </span>
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

const isAlert = (point) => {
  if (point.latestValue === null || point.latestValue === undefined) return false;
  if (point.thresholdMin !== null && point.thresholdMin !== undefined && point.latestValue < point.thresholdMin) return true;
  if (point.thresholdMax !== null && point.thresholdMax !== undefined && point.latestValue > point.thresholdMax) return true;
  return false;
};

const hasValidValue = (point) => {
  if (point.dataKind === 'video') return Boolean(point.name || point.pointCode);
  if (point.latestValue === null || point.latestValue === undefined) return false;
  return Number.isFinite(Number(point.latestValue));
};

const formatPoint = (point) => {
  if (point.dataKind === 'video') return point.name || 'Video';
  if (!hasValidValue(point)) return 'N/A';
  const value = Number(point.latestValue);
  return `${Number.isFinite(value) ? value.toFixed(1) : point.latestValue}${point.unit || ''}`;
};
</script>

<style scoped>
.point-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.point-tag {
  position: absolute;
  transform: translate(-50%, -50%);
  display: inline-flex;
  padding: 0;
  border: 0;
  background: transparent;
  pointer-events: auto;
  cursor: pointer;
}

.tag-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pin-val {
  max-width: 150px;
  padding: 4px 10px;
  overflow: hidden;
  border: 1.5px solid var(--point-color, rgba(255, 255, 255, 0.85));
  border-radius: 16px;
  background: rgba(128, 128, 128, 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.9),
    0 0 4px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  transition: all 0.2s ease;
}

.point-tag:hover .pin-val {
  background: rgba(128, 128, 128, 0.4);
  transform: scale(1.05);
}

.point-tag.selected .pin-val {
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.78),
    0 1px 3px rgba(0, 0, 0, 0.2);
}

.point-tag.alert .pin-val {
  background: rgba(255, 120, 80, 0.24);
}

.pin-val.no-data {
  background: rgba(255, 100, 100, 0.2);
  color: #ff9999;
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
