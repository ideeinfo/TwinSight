<template>
  <div class="ticket-overlay-tags" v-if="visible">
    <button
      v-for="marker in visibleMarkers"
      :key="marker.dbId"
      type="button"
      class="ticket-marker"
      :class="`status-${marker.displayStatus}`"
      :style="{ top: `${marker.y}px`, left: `${marker.x}px` }"
      :title="`${marker.label} (${marker.ticketCount})`"
      @click="$emit('marker-click', marker)"
    >
      {{ marker.ticketCount }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  markers: {
    type: Array,
    default: () => []
  },
  visible: {
    type: Boolean,
    default: false
  }
});

defineEmits(['marker-click']);

const visibleMarkers = computed(() => (
  props.visible
    ? props.markers.filter((marker) => marker.visible && marker.x !== undefined && marker.y !== undefined)
    : []
));
</script>

<style scoped>
.ticket-overlay-tags {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 12;
}

.ticket-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 8px 18px rgba(17, 25, 40, 0.28);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.ticket-marker:hover {
  transform: translate(-50%, -50%) scale(1.06);
  box-shadow: 0 10px 22px rgba(17, 25, 40, 0.34);
}

.status-new {
  background: #e2882a;
}

.status-completed {
  background: #25a56f;
}

.status-closed {
  background: #6f7782;
}
</style>
