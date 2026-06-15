<template>
  <div class="chart-container">
    <!-- 图表头部 -->
    <ChartHeader :label-text="labelText || t('chartPanel.average')" :range="range" :fallback-start-ms="renderData.length?renderData[0].timestamp:0" :fallback-end-ms="renderData.length?renderData[renderData.length-1].timestamp:0">
      <div v-if="timelineControls" class="timeline-controls">
        <select class="range-select" :value="selectedRangeValue" @change="onRangeSelect">
          <option v-for="option in rangeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <template v-if="selectedRangeValue === 'custom'">
          <input class="date-input" type="datetime-local" v-model="customStart" />
          <span class="date-separator">-</span>
          <input class="date-input" type="datetime-local" v-model="customEnd" />
          <button class="tool-btn" type="button" @click="applyCustomRange">应用</button>
        </template>
        <button class="tool-btn" type="button" @click="zoomRange(0.5)">-</button>
        <button class="tool-btn" type="button" @click="zoomRange(2)">+</button>
        <button class="tool-btn" type="button" :class="{ active: isPlaying }" @click="togglePlay">
          {{ isPlaying ? '暂停' : '播放' }}
        </button>
        <button class="tool-btn" type="button" :class="{ active: isLooping }" @click="isLooping = !isLooping">循环</button>
        <button class="tool-btn" type="button" @click="cycleSpeed">{{ playbackSpeed }}x</button>
        <button class="tool-btn" type="button" @click="goLive">最新</button>
      </div>
      <button class="close" @click="$emit('close')">×</button>
    </ChartHeader>

    <!-- 图表主体区域 -->
    <div class="chart-main">
      <!-- Y轴标签 -->
      <div class="y-axis">
        <span
          v-for="label in yLabels"
          :key="label.bottom"
          class="y-label"
          :style="{ bottom: label.bottom + '%' }"
        >
          {{ label.text }}
        </span>
      </div>
      
      <!-- 图表绘制区域 -->
      <div ref="chartRef" class="chart-body">
        <!-- 静态网格线 -->
        <div class="grid-line" style="bottom: 16.7%"></div>
        <div class="grid-line" style="bottom: 33.3%"></div>
        <div class="grid-line" style="bottom: 50%"></div>
        <div class="grid-line" style="bottom: 66.7%"></div>
        <div class="grid-line" style="bottom: 83.3%"></div>

        <!-- 高温阈值线 -->
        <div v-if="hasHighThreshold" class="threshold-line high" :style="{ bottom: highThresholdBottom + '%' }">
          <span class="threshold-label high">{{ formatAxisValue(highThreshold) }} {{ t('chartPanel.alert') }}</span>
        </div>
        <!-- 低温阈值线 -->
        <div v-if="hasLowThreshold" class="threshold-line low" :style="{ bottom: lowThresholdBottom + '%' }">
          <span class="threshold-label low">{{ formatAxisValue(lowThreshold) }} {{ t('chartPanel.lowAlert') }}</span>
        </div>

        <!-- SVG 曲线 -->
        <svg class="svg-chart" viewBox="0 0 1000 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradBottom" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#00b0ff;stop-opacity:0.3" />
              <stop offset="100%" style="stop-color:#00b0ff;stop-opacity:0.0" />
            </linearGradient>
            <linearGradient id="strokeGradBottom" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <stop :offset="highThresholdRatio - 0.01" stop-color="#ff4d4d" />
              <stop :offset="highThresholdRatio + 0.01" stop-color="#00b0ff" />
            </linearGradient>
          </defs>
          <path :d="areaPath" fill="url(#areaGradBottom)" stroke="none" />
          <path :d="linePath" fill="none" stroke="url(#strokeGradBottom)" stroke-width="2" vector-effect="non-scaling-stroke" />

          <g class="threshold-markers">
            <circle
              v-for="i in overSegments"
              :key="'m'+i"
              :cx="getPointX(renderData[i], i, renderData.length)"
              :cy="getPointY(renderData[i].value)"
              r="3"
              fill="#ff4d4d"
              stroke="#fff"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          </g>

          <!-- 悬浮交互 -->
          <g v-if="hoverX > 0">
            <line :x1="hoverX" y1="0" :x2="hoverX" y2="100" stroke="#fff" stroke-width="1" stroke-dasharray="4 4" opacity="0.8" vector-effect="non-scaling-stroke" />
            <circle :cx="hoverX" :cy="hoverY" r="4" :fill="getPointColor(parseFloat(hoverValue))" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" />
          </g>
        </svg>

        <!-- Tooltip -->
        <div v-if="hoverX > 0" class="tooltip-box" :style="{ left: tooltipLeft, top: tooltipTop }">
          <div class="val" :class="getValueClass(parseFloat(hoverValue))">
            {{ hoverValue }}{{ unit }}
            <span v-if="isAlertValue(parseFloat(hoverValue))" class="alert-badge">!</span>
          </div>
          <div class="time">{{ hoverTime }}</div>
        </div>

        <div class="interaction-layer" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @click="onChartClick"></div>
      </div>
    </div>

    <!-- 底部标签 -->
    <div class="chart-footer">
      <div class="axis-labels">
        <div class="axis-spacer"></div>
        <div class="axis-content">
          <span v-for="(label, index) in xLabels" :key="index">{{ label }}</span>
        </div>
      </div>
      <div class="legend">
        <span v-if="hasHighThreshold" class="warn red">🔥 {{ t('chartPanel.alertHigh') }} ({{ highAlertCount }})</span>
        <span v-if="hasLowThreshold" class="warn cyan">❄️ {{ t('chartPanel.alertLow') }} ({{ lowAlertCount }})</span>
        <span class="warn blue">● {{ t('chartPanel.normal') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, toRefs, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import ChartHeader from './ChartHeader.vue';

const { t } = useI18n();

const props = defineProps({
  data: { type: Array, default: () => [] },
  range: { type: Object, default: null },
  labelText: { type: String, default: '' },
  unit: { type: String, default: '°C' },
  minY: { type: Number, default: -20 },
  maxY: { type: Number, default: 40 },
  highThreshold: { type: Number, default: 28 },
  lowThreshold: { type: Number, default: 10 },
  cursorTime: { type: Number, default: null },
  staleToleranceMs: { type: Number, default: Infinity },
  timelineControls: { type: Boolean, default: false }
});

const emit = defineEmits(['close','hover-sync','range-change','cursor-change']);

const { data: displayData } = toRefs(props);

// === 状态 ===
const chartRef = ref(null);
const hoverX = ref(-1);
const hoverY = ref(-1);
const hoverValue = ref('--');
const hoverTime = ref('--');
const tooltipPxX = ref(0);
const tooltipPxY = ref(0);
const selectedRangeValue = ref('24h');
const customStart = ref('');
const customEnd = ref('');
const isPlaying = ref(false);
const isLooping = ref(false);
const playbackSpeed = ref(1);
let playbackFrame = null;

const rangeOptions = [
  { label: '1小时', value: '1h', ms: 36e5 },
  { label: '3小时', value: '3h', ms: 3 * 36e5 },
  { label: '6小时', value: '6h', ms: 6 * 36e5 },
  { label: '24小时', value: '24h', ms: 24 * 36e5 },
  { label: '3天', value: '3d', ms: 3 * 24 * 36e5 },
  { label: '7天', value: '7d', ms: 7 * 24 * 36e5 },
  { label: '30天', value: '30d', ms: 30 * 24 * 36e5 },
  { label: '自定义', value: 'custom' }
];

// === 计算属性 ===
const minY = computed(() => Number.isFinite(props.minY) ? props.minY : -20);
const maxY = computed(() => {
  if (Number.isFinite(props.maxY) && props.maxY > minY.value) return props.maxY;
  return minY.value + 1;
});
const highThreshold = computed(() => Number(props.highThreshold));
const lowThreshold = computed(() => Number(props.lowThreshold));
const hasHighThreshold = computed(() => Number.isFinite(highThreshold.value));
const hasLowThreshold = computed(() => Number.isFinite(lowThreshold.value));
const ySpan = computed(() => Math.max(1, maxY.value - minY.value));
const highThresholdRatio = computed(() => hasHighThreshold.value ? 1 - (highThreshold.value - minY.value) / ySpan.value : 0);
const highThresholdBottom = computed(() => ((highThreshold.value - minY.value) / ySpan.value) * 100);
const lowThresholdBottom = computed(() => ((lowThreshold.value - minY.value) / ySpan.value) * 100);

const formatAxisValue = (value) => `${Number(value).toFixed(Number.isInteger(value) ? 0 : 1)}${props.unit}`;

const yLabels = computed(() => {
  const count = 7;
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const value = maxY.value - ySpan.value * ratio;
    return {
      bottom: (1 - ratio) * 100,
      text: formatAxisValue(value)
    };
  });
});

const getRangeStart = () => props.range?.startMs || displayData.value[0]?.timestamp || 0;
const getRangeEnd = () => props.range?.endMs || displayData.value[displayData.value.length - 1]?.timestamp || 0;
const getRangeSpan = () => Math.max(0, getRangeEnd() - getRangeStart());

const renderData = computed(() => {
  const start = getRangeStart();
  const end = getRangeEnd();
  return (displayData.value || [])
    .map((point) => ({
      ...point,
      timestamp: Number(point?.timestamp),
      value: Number(point?.value)
    }))
    .filter((point) => (
      Number.isFinite(point.timestamp) &&
      Number.isFinite(point.value) &&
      (!start || point.timestamp >= start) &&
      (!end || point.timestamp <= end)
    ));
});

const toLocalInputValue = (ms) => {
  if (!Number.isFinite(Number(ms))) return '';
  const date = new Date(Number(ms));
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const emitCursor = (time) => {
  const start = getRangeStart();
  const end = getRangeEnd();
  if (!start || !end || end <= start || !Number.isFinite(Number(time))) return;
  const cursorTime = Math.max(start, Math.min(end, Number(time)));
  emit('cursor-change', { time: cursorTime, percent: (cursorTime - start) / (end - start) });
};

const emitRange = (startMs, endMs) => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;
  const windowMs = Math.max(60_000, Math.round((endMs - startMs) / 300));
  emit('range-change', { startMs, endMs, windowMs });
  emit('cursor-change', { time: endMs, percent: 1 });
};

const inferRangeValue = () => {
  const span = getRangeSpan();
  if (!span) return selectedRangeValue.value;
  const matched = rangeOptions.find((option) => option.ms && Math.abs(option.ms - span) <= Math.max(60_000, option.ms * 0.02));
  return matched?.value || 'custom';
};

const onRangeSelect = (event) => {
  selectedRangeValue.value = event.target.value;
  if (selectedRangeValue.value === 'custom') {
    customStart.value = toLocalInputValue(getRangeStart());
    customEnd.value = toLocalInputValue(getRangeEnd());
    return;
  }
  const option = rangeOptions.find((item) => item.value === selectedRangeValue.value);
  if (!option?.ms) return;
  const endMs = Date.now();
  emitRange(endMs - option.ms, endMs);
};

const applyCustomRange = () => {
  const startMs = new Date(customStart.value).getTime();
  const endMs = new Date(customEnd.value).getTime();
  emitRange(startMs, endMs);
};

const zoomRange = (factor) => {
  const start = getRangeStart();
  const end = getRangeEnd();
  if (!start || !end || end <= start) return;
  const cursor = Number.isFinite(Number(props.cursorTime)) ? Number(props.cursorTime) : end;
  const span = (end - start) * factor;
  const ratio = Math.max(0, Math.min(1, (cursor - start) / (end - start)));
  const nextStart = cursor - span * ratio;
  const nextEnd = nextStart + span;
  selectedRangeValue.value = 'custom';
  emitRange(nextStart, nextEnd);
};

const cycleSpeed = () => {
  const speeds = [1, 2, 4, 8];
  playbackSpeed.value = speeds[(speeds.indexOf(playbackSpeed.value) + 1) % speeds.length];
};

const stopPlayback = () => {
  isPlaying.value = false;
  if (playbackFrame) {
    cancelAnimationFrame(playbackFrame);
    playbackFrame = null;
  }
};

const playbackStep = () => {
  if (!isPlaying.value) return;
  const start = getRangeStart();
  const end = getRangeEnd();
  if (!start || !end || end <= start) {
    stopPlayback();
    return;
  }
  const current = Number.isFinite(Number(props.cursorTime)) ? Number(props.cursorTime) : start;
  const step = ((end - start) / 1200) * playbackSpeed.value;
  let nextTime = current + step;
  if (nextTime >= end) {
    if (isLooping.value) nextTime = start;
    else {
      nextTime = end;
      stopPlayback();
    }
  }
  emitCursor(nextTime);
  playbackFrame = requestAnimationFrame(playbackStep);
};

const togglePlay = () => {
  if (isPlaying.value) {
    stopPlayback();
    return;
  }
  isPlaying.value = true;
  playbackFrame = requestAnimationFrame(playbackStep);
};

const goLive = () => {
  stopPlayback();
  const end = getRangeEnd();
  if (end) emitCursor(end);
};

const getPointX = (point, index, len) => {
  const start = getRangeStart();
  const end = getRangeEnd();
  if (start && end && end > start && point?.timestamp) {
    return Math.max(0, Math.min(1000, ((point.timestamp - start) / (end - start)) * 1000));
  }
  return len > 1 ? (index / (len - 1)) * 1000 : 500;
};

const getPointY = (value) => {
  const ratio = (Number(value) - minY.value) / ySpan.value;
  return 100 - (Math.max(0, Math.min(1, ratio)) * 100);
};

const linePath = computed(() => {
  if (!renderData.value.length) return '';
  const len = renderData.value.length;
  return renderData.value.map((point, index) => {
    const x = getPointX(point, index, len);
    const y = getPointY(point.value);
    const safeX = isNaN(x) ? 0 : x;
    const safeY = isNaN(y) ? 50 : y;
    return `${index === 0 ? 'M' : 'L'} ${safeX.toFixed(1)} ${safeY.toFixed(1)}`;
  }).join(' ');
});

const areaPath = computed(() => {
  if (!linePath.value) return '';
  const len = renderData.value.length;
  const firstX = getPointX(renderData.value[0], 0, len);
  const lastX = getPointX(renderData.value[len - 1], len - 1, len);
  return `${linePath.value} L ${lastX.toFixed(1)} 100 L ${firstX.toFixed(1)} 100 Z`;
});

const highAlertCount = computed(() => {
  if (!renderData.value.length || !hasHighThreshold.value) return 0;
  return renderData.value.filter(p => p.value >= highThreshold.value).length;
});

const lowAlertCount = computed(() => {
  if (!renderData.value.length || !hasLowThreshold.value) return 0;
  return renderData.value.filter(p => p.value <= lowThreshold.value).length;
});

const overSegments = computed(() => {
  const res = [];
  if (!renderData.value.length) return res;
  for (let i = 1; i < renderData.value.length; i++) {
    const prev = renderData.value[i-1];
    const cur = renderData.value[i];
    if (hasHighThreshold.value && prev.value < highThreshold.value && cur.value >= highThreshold.value) res.push(i);
  }
  return res;
});

const isAlertValue = (value) => (
  Number.isFinite(Number(value)) &&
  (
    (hasHighThreshold.value && value >= highThreshold.value) ||
    (hasLowThreshold.value && value <= lowThreshold.value)
  )
);

// 获取点的颜色
const getPointColor = (value) => {
  if (!Number.isFinite(Number(value))) return '#8A8F98';
  if (hasHighThreshold.value && value >= highThreshold.value) return '#ff4d4d';
  if (hasLowThreshold.value && value <= lowThreshold.value) return '#00bcd4';
  return '#00b0ff';
};

// 获取值的样式类
const getValueClass = (value) => {
  if (!Number.isFinite(Number(value))) return 'empty-val';
  if (hasHighThreshold.value && value >= highThreshold.value) return 'alert-val-high';
  if (hasLowThreshold.value && value <= lowThreshold.value) return 'alert-val-low';
  return '';
};


const xLabels = computed(() => {
  const start = getRangeStart();
  const end = getRangeEnd();
  if (!start || !end) return [];
  const labels = [];
  const span = end - start;
  const count = span > 7 * 24 * 60 * 60 * 1000 ? 8 : span > 36 * 60 * 60 * 1000 ? 7 : 6;
  for (let i=0; i<count; i++) {
    const dt = new Date(start + ((end - start) * i / (count - 1)));
    const showDate = span > 36 * 60 * 60 * 1000;
    labels.push(showDate
      ? `${dt.getMonth() + 1}/${dt.getDate()}`
      : `${dt.getHours()}:${dt.getMinutes().toString().padStart(2,'0')}`
    );
  }
  return labels;
});

// === 交互 ===
const findNearestPointIndex = (targetTime, enforceTolerance = false) => {
  if (!renderData.value.length) return -1;
  if (!targetTime) return renderData.value.length - 1;
  const bestIndex = renderData.value.reduce((bestIndex, point, currentIndex) => {
    const currentDelta = Math.abs(point.timestamp - targetTime);
    const bestDelta = Math.abs(renderData.value[bestIndex].timestamp - targetTime);
    return currentDelta < bestDelta ? currentIndex : bestIndex;
  }, 0);
  if (!enforceTolerance) return bestIndex;
  const delta = Math.abs(renderData.value[bestIndex].timestamp - targetTime);
  const tolerance = Number(props.staleToleranceMs);
  return !Number.isFinite(tolerance) || delta <= tolerance ? bestIndex : -1;
};

const getTimePercent = (time, fallbackPercent = 0.5) => {
  const start = getRangeStart();
  const end = getRangeEnd();
  if (start && end && end > start && Number.isFinite(Number(time))) {
    return Math.max(0, Math.min(1, (Number(time) - start) / (end - start)));
  }
  return fallbackPercent;
};

const setMarkerFromPoint = (point, index, rect = null, anchorTime = null) => {
  if (!point) {
    hoverX.value = -1;
    return;
  }
  const fallbackPercent = renderData.value.length > 1 ? index / (renderData.value.length - 1) : 0.5;
  const anchorPercent = getTimePercent(anchorTime ?? point.timestamp, fallbackPercent);
  const ratio = (Number(point.value) - minY.value) / ySpan.value;

  hoverX.value = anchorPercent * 1000;
  hoverY.value = getPointY(point.value);
  hoverValue.value = Number(point.value).toFixed(1);
  hoverTime.value = new Date(point.timestamp).toLocaleString();
  tooltipPxX.value = rect ? anchorPercent * rect.width : anchorPercent * (chartRef.value?.clientWidth || 0);
  tooltipPxY.value = (rect?.height || chartRef.value?.clientHeight || 0) * (1 - ratio);
};

const setEmptyMarkerFromTime = (time, rect = null) => {
  const anchorPercent = getTimePercent(time, 0.5);
  hoverX.value = anchorPercent * 1000;
  hoverY.value = 50;
  hoverValue.value = 'N/A';
  hoverTime.value = new Date(Number(time)).toLocaleString();
  tooltipPxX.value = rect ? anchorPercent * rect.width : anchorPercent * (chartRef.value?.clientWidth || 0);
  tooltipPxY.value = (rect?.height || chartRef.value?.clientHeight || 0) * 0.5;
};

const setMarkerFromTime = (time) => {
  if (!Number.isFinite(Number(time))) {
    hoverX.value = -1;
    return;
  }
  if (!renderData.value.length) {
    setEmptyMarkerFromTime(time);
    return;
  }
  const index = findNearestPointIndex(time, true);
  if (index < 0) {
    setEmptyMarkerFromTime(time);
    return;
  }
  setMarkerFromPoint(renderData.value[index], index, null, time);
};

const onMouseMove = (e) => {
  if (!chartRef.value) return;
  const rect = chartRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const svgX = (mouseX / rect.width) * 1000;
  const percent = Math.max(0, Math.min(1, svgX / 1000));
  const start = getRangeStart();
  const end = getRangeEnd();
  const targetTime = start && end && end > start ? start + percent * (end - start) : null;
  if (!renderData.value.length && targetTime) {
    setEmptyMarkerFromTime(targetTime, rect);
    emit('hover-sync', { time: targetTime, percent });
    return;
  }
  const index = targetTime
    ? findNearestPointIndex(targetTime, true)
    : Math.round(percent * (renderData.value.length - 1));
  if (index < 0) {
    setEmptyMarkerFromTime(targetTime, rect);
    emit('hover-sync', { time: targetTime, percent });
    return;
  }
  const point = renderData.value[index];
  setMarkerFromPoint(point, index, rect);

  const anchorPercent = start && end && end > start
    ? Math.max(0, Math.min(1, (point.timestamp - start) / (end - start)))
    : (renderData.value.length > 1 ? index / (renderData.value.length - 1) : 0.5);
  emit('hover-sync', { time: point.timestamp, percent: anchorPercent });
};

const onChartClick = (e) => {
  if (!chartRef.value) return;
  const rect = chartRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, mouseX / rect.width));
  const start = getRangeStart();
  const end = getRangeEnd();
  if (!start || !end || end <= start) return;
  const targetTime = start + percent * (end - start);
  setMarkerFromTime(targetTime);
  emit('cursor-change', { time: targetTime, percent });
};

const onMouseLeave = () => {
  if (props.cursorTime) {
    setMarkerFromTime(props.cursorTime);
    return;
  }
  hoverX.value = -1;
};

watch(
  () => [
    props.cursorTime,
    props.range?.startMs,
    props.range?.endMs,
    renderData.value.length,
    renderData.value[0]?.timestamp,
    renderData.value[renderData.value.length - 1]?.timestamp
  ],
  () => setMarkerFromTime(props.cursorTime),
  { immediate: true }
);

watch(
  () => props.range,
  () => {
    selectedRangeValue.value = inferRangeValue();
    customStart.value = toLocalInputValue(getRangeStart());
    customEnd.value = toLocalInputValue(getRangeEnd());
  },
  { immediate: true, deep: true }
);

onUnmounted(() => stopPlayback());

const tooltipLeft = computed(() => {
  if (chartRef.value) {
    if (tooltipPxX.value > chartRef.value.clientWidth - 140) return (tooltipPxX.value - 130) + 'px';
  }
  return (tooltipPxX.value + 15) + 'px';
});
const tooltipTop = computed(() => (tooltipPxY.value - 50) + 'px');
</script>

<style scoped>
.chart-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #ccc;
  font-size: 11px;
  background: #1e1e1e;
  position: relative;
  user-select: none;
}



.close {
  background: none;
  border: none;
  color: #ccc;
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close:hover {
  color: #f48771;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-left: auto;
}

.range-select,
.date-input,
.tool-btn {
  height: 24px;
  color: #d8dde2;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 3px;
  font-size: 11px;
  outline: none;
}

.range-select {
  min-width: 72px;
  padding: 0 22px 0 8px;
}

.date-input {
  width: 142px;
  padding: 0 6px;
}

.date-separator {
  color: #8f969d;
}

.tool-btn {
  min-width: 28px;
  padding: 0 8px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.tool-btn:hover,
.tool-btn.active {
  color: #101820;
  background: #87d8f2;
  border-color: #87d8f2;
}

.chart-main {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.y-axis {
  width: 40px;
  position: relative;
  background: #1e1e1e;
  flex-shrink: 0;
}

.y-label {
  position: absolute;
  right: 4px;
  transform: translateY(-50%);
  font-size: 10px;
  color: #aaa;
  pointer-events: none;
}

.chart-body {
  flex: 1;
  position: relative;
  background: #1e1e1e;
  overflow: hidden;
  cursor: crosshair;
}

.grid-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #333;
  border-top: 1px dashed #444;
}

.threshold-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  z-index: 5;
  pointer-events: none;
}

.threshold-line.high {
  border-top: 1px dashed #ff4d4d;
}

.threshold-line.low {
  border-top: 1px dashed #00bcd4;
}

.threshold-label {
  position: absolute;
  right: 10px;
  bottom: 2px;
  font-size: 10px;
  font-weight: bold;
  background: rgba(30,30,30,0.8);
  padding: 0 4px;
}

.threshold-label.high {
  color: #ff4d4d;
}

.threshold-label.low {
  color: #00bcd4;
}

.svg-chart {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
}

.tooltip-box {
  position: absolute;
  background: rgba(30,30,30,0.95);
  border: 1px solid #555;
  padding: 6px 10px;
  border-radius: 4px;
  z-index: 20;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  transition: top 0.05s ease, left 0.05s ease;
}

.val {
  font-size: 14px;
  font-weight: bold;
  color: #00b0ff;
}

.val.alert-val {
  color: #ff4d4d;
}

.alert-badge {
  margin-left: 4px;
  font-size: 12px;
}

.time {
  color: #888;
  font-size: 10px;
  margin-top: 2px;
  white-space: nowrap;
}

.interaction-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
}

.chart-footer {
  height: 36px;
  background: #1e1e1e;
  padding: 0 16px;
  flex-shrink: 0;
  border-top: 1px solid #333;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.axis-labels {
  display: flex;
  color: #666;
  font-size: 10px;
}

.axis-spacer {
  width: 40px;
  flex-shrink: 0;
}

.axis-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
}

.legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 2px;
}

.warn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}

.warn.red {
  color: #ff4d4d;
}

.warn.cyan {
  color: #00bcd4;
}

.warn.blue {
  color: #00b0ff;
}

.alert-val-high {
  color: #ff4d4d;
}

.alert-val-low {
  color: #00bcd4;
}

.empty-val {
  color: #8A8F98;
}
</style>
