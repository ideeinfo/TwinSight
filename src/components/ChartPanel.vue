<template>
  <div class="chart-container">
    <!-- 图表头部 -->
    <ChartHeader :label-text="labelText || t('chartPanel.average')" :range="range" :fallback-start-ms="displayData.length?displayData[0].timestamp:0" :fallback-end-ms="displayData.length?displayData[displayData.length-1].timestamp:0">
      <button class="close" @click="$emit('close')">×</button>
    </ChartHeader>

    <!-- 图表主体区域 -->
    <div class="chart-main">
      <!-- Y轴标签 (范围: -20°C 到 40°C) -->
      <div class="y-axis">
        <span class="y-label" style="bottom: 100%">40°C</span>
        <span class="y-label" style="bottom: 83.3%">30°C</span>
        <span class="y-label" style="bottom: 66.7%">20°C</span>
        <span class="y-label" style="bottom: 50%">10°C</span>
        <span class="y-label" style="bottom: 33.3%">0°C</span>
        <span class="y-label" style="bottom: 16.7%">-10°C</span>
        <span class="y-label" style="bottom: 0%">-20°C</span>
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
        <div class="threshold-line high" :style="{ bottom: highThresholdBottom + '%' }">
          <span class="threshold-label high">28°C {{ t('chartPanel.alert') }}</span>
        </div>
        <!-- 低温阈值线 -->
        <div class="threshold-line low" :style="{ bottom: lowThresholdBottom + '%' }">
          <span class="threshold-label low">10°C {{ t('chartPanel.lowAlert') }}</span>
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
              :cx="(i / (displayData.length - 1)) * 1000"
              :cy="100 - (((displayData[i].value - MIN_Y) / (MAX_Y - MIN_Y)) * 100)"
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
            {{ hoverValue }} °C
            <span v-if="parseFloat(hoverValue) >= HIGH_THRESHOLD || parseFloat(hoverValue) <= LOW_THRESHOLD" class="alert-badge">!</span>
          </div>
          <div class="time">{{ hoverTime }}</div>
        </div>

        <div class="interaction-layer" @mousemove="onMouseMove" @mouseleave="onMouseLeave"></div>
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
        <span class="warn red">🔥 {{ t('chartPanel.alertHigh') }} ({{ highAlertCount }})</span>
        <span class="warn cyan">❄️ {{ t('chartPanel.alertLow') }} ({{ lowAlertCount }})</span>
        <span class="warn blue">● {{ t('chartPanel.normal') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import ChartHeader from './ChartHeader.vue';

const { t } = useI18n();

const props = defineProps({
  data: { type: Array, default: () => [] },
  range: { type: Object, default: null },
  labelText: { type: String, default: '' }
});

const emit = defineEmits(['close','hover-sync']);

const { data: displayData } = toRefs(props);

// === 配置 ===
const MIN_Y = -20;
const MAX_Y = 40;
const HIGH_THRESHOLD = 28;
const LOW_THRESHOLD = 10;

// === 状态 ===
const chartRef = ref(null);
const hoverX = ref(-1);
const hoverY = ref(-1);
const hoverValue = ref('--');
const hoverTime = ref('--');
const tooltipPxX = ref(0);
const tooltipPxY = ref(0);

// === 计算属性 ===
const highThresholdRatio = computed(() => 1 - (HIGH_THRESHOLD - MIN_Y) / (MAX_Y - MIN_Y));
const highThresholdBottom = computed(() => ((HIGH_THRESHOLD - MIN_Y) / (MAX_Y - MIN_Y)) * 100);
const lowThresholdBottom = computed(() => ((LOW_THRESHOLD - MIN_Y) / (MAX_Y - MIN_Y)) * 100);

const linePath = computed(() => {
  if (!displayData.value.length) return '';
  const len = displayData.value.length;
  return displayData.value.map((point, index) => {
    const x = len > 1 ? (index / (len - 1)) * 1000 : 500;
    const ratio = (point.value - MIN_Y) / (MAX_Y - MIN_Y);
    const y = 100 - (ratio * 100);
    const safeX = isNaN(x) ? 0 : x;
    const safeY = isNaN(y) ? 50 : y;
    return `${index === 0 ? 'M' : 'L'} ${safeX.toFixed(1)} ${safeY.toFixed(1)}`;
  }).join(' ');
});

const areaPath = computed(() => {
  if (!linePath.value) return '';
  return `${linePath.value} L 1000 100 L 0 100 Z`;
});

const highAlertCount = computed(() => {
  if (!displayData.value.length) return 0;
  return displayData.value.filter(p => p.value >= HIGH_THRESHOLD).length;
});

const lowAlertCount = computed(() => {
  if (!displayData.value.length) return 0;
  return displayData.value.filter(p => p.value <= LOW_THRESHOLD).length;
});

const overSegments = computed(() => {
  const res = [];
  if (!displayData.value.length) return res;
  for (let i = 1; i < displayData.value.length; i++) {
    const prev = displayData.value[i-1];
    const cur = displayData.value[i];
    if (prev.value < HIGH_THRESHOLD && cur.value >= HIGH_THRESHOLD) res.push(i);
  }
  return res;
});

// 获取点的颜色
const getPointColor = (value) => {
  if (value >= HIGH_THRESHOLD) return '#ff4d4d';
  if (value <= LOW_THRESHOLD) return '#00bcd4';
  return '#00b0ff';
};

// 获取值的样式类
const getValueClass = (value) => {
  if (value >= HIGH_THRESHOLD) return 'alert-val-high';
  if (value <= LOW_THRESHOLD) return 'alert-val-low';
  return '';
};


const xLabels = computed(() => {
  if (!displayData.value.length) return [];
  const labels = [];
  const count = 7;
  for (let i=0; i<count; i++) {
    const idx = Math.floor((i/(count-1)) * (displayData.value.length - 1));
    const dt = new Date(displayData.value[idx].timestamp);
    labels.push(dt.getHours() + ':' + dt.getMinutes().toString().padStart(2,'0'));
  }
  return labels;
});

// === 交互 ===
const onMouseMove = (e) => {
  if (!chartRef.value || !displayData.value.length) return;
  const rect = chartRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const svgX = (mouseX / rect.width) * 1000;
  const percent = Math.max(0, Math.min(1, svgX / 1000));
  const index = Math.round(percent * (displayData.value.length - 1));
  const point = displayData.value[index];

  const ratio = (point.value - MIN_Y) / (MAX_Y - MIN_Y);
  const svgY = 100 - (ratio * 100);

  const anchorPercent = index / (displayData.value.length - 1);
  hoverX.value = anchorPercent * 1000;
  hoverY.value = svgY;

  hoverValue.value = Number(point.value).toFixed(1);

  hoverTime.value = new Date(point.timestamp).toLocaleString();

  tooltipPxX.value = mouseX;
  tooltipPxY.value = rect.height * (1 - ratio);

  emit('hover-sync', { time: point.timestamp, percent: anchorPercent });
};

const onMouseLeave = () => { hoverX.value = -1; };

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
</style>

