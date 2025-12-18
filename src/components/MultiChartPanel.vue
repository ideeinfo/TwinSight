<template>
  <div class="multi-container">
    <ChartHeader :label-text="t('chartPanel.individual')" :range="range" :fallback-start-ms="firstStartMs" :fallback-end-ms="firstEndMs">
      <button class="close" @click="$emit('close')">×</button>
    </ChartHeader>
    <div class="multi-grid">
    <div v-for="(s, idx) in seriesList" :key="(s.room)" class="grid-item">
      <div class="item-header">
        <span class="title">{{ s.name || s.room }}</span>
      </div>

      <div class="chart-body" :ref="el => chartRefs[idx] = el">
        <!-- 网格线 -->
        <div class="grid-line" style="bottom: 25%"></div>
        <div class="grid-line" style="bottom: 50%"></div>
        <div class="grid-line" style="bottom: 75%"></div>

        <!-- 阈值线 -->
        <div class="threshold-line" :style="{ bottom: thresholdBottom + '%' }">
          <span class="threshold-label">30°C {{ t('chartPanel.alert') }}</span>
        </div>

        <!-- 曲线 -->
        <svg class="svg-chart" viewBox="0 0 1000 100" preserveAspectRatio="none">
          <defs>
            <linearGradient :id="'areaGrad-' + idx" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#00b0ff;stop-opacity:0.3" />
              <stop offset="100%" style="stop-color:#00b0ff;stop-opacity:0.0" />
            </linearGradient>
            <linearGradient :id="'strokeGrad-' + idx" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <stop :offset="thresholdRatio - 0.01" stop-color="#ff4d4d" />
              <stop :offset="thresholdRatio + 0.01" stop-color="#00b0ff" />
            </linearGradient>
          </defs>
          <path :d="areaPath(s.points)" :fill="'url(#' + 'areaGrad-' + idx + ')'" stroke="none" />
          <path :d="linePath(s.points)" fill="none" :stroke="'url(#' + 'strokeGrad-' + idx + ')'" stroke-width="2" vector-effect="non-scaling-stroke" />

          <g class="threshold-markers">
            <circle
              v-for="i in getOverSegments(s.points)"
              :key="'m'+idx+'-'+i"
              :cx="(i / (s.points.length - 1)) * 1000"
              :cy="100 - (((s.points[i].value - MIN_Y) / (MAX_Y - MIN_Y)) * 100)"
              r="3"
              fill="#ff4d4d"
              stroke="#fff"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          </g>

          <!-- 悬浮交互 -->
          <g v-if="hoverX[idx] > 0">
            <line :x1="hoverX[idx]" y1="0" :x2="hoverX[idx]" y2="100" stroke="#fff" stroke-width="1" stroke-dasharray="4 4" opacity="0.8" vector-effect="non-scaling-stroke" />
            <circle :cx="hoverX[idx]" :cy="hoverY[idx]" r="4" :fill="parseFloat(hoverValue[idx]) >= 30 ? '#ff4d4d' : '#00b0ff'" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" />
          </g>
        </svg>

        <!-- Tooltip -->
        <div v-if="hoverX[idx] > 0" class="tooltip-box" :style="{ left: tooltipLeft(idx), top: tooltipTop(idx) }">
          <div class="val" :class="{ 'alert-val': parseFloat(hoverValue[idx]) >= 30 }">
            {{ hoverValue[idx] }} °C
            <span v-if="parseFloat(hoverValue[idx]) >= 30" class="alert-badge">!</span>
          </div>
          <div class="time">{{ hoverTime[idx] }}</div>
        </div>

        <div class="interaction-layer" @mousemove="e => onMouseMove(idx, e)" @mouseleave="() => onMouseLeave(idx)"></div>
      </div>

      <!-- 底部标签 -->
      <div class="chart-footer">
        <div class="axis-labels">
          <span v-for="(label, i) in xLabels(s.points)" :key="i">{{ label }}</span>
        </div>
        <div class="legend">
          <span class="warn red">⚠️ {{ t('chartPanel.alertAbove30') }} ({{ getOverSegments(s.points).length }})</span>
          <span class="warn blue">● {{ t('chartPanel.normal') }}</span>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ChartHeader from './ChartHeader.vue'

const { t } = useI18n()

const props = defineProps({ seriesList: { type: Array, default: () => [] }, range: { type: Object, default: null } })
const emit = defineEmits(['hover-sync','close'])

const MIN_Y = 0
const MAX_Y = 40
const THRESHOLD = 30

const thresholdRatio = 1 - (THRESHOLD - MIN_Y) / (MAX_Y - MIN_Y)
const thresholdBottom = ((THRESHOLD - MIN_Y) / (MAX_Y - MIN_Y)) * 100

const chartRefs = ref([])
const hoverX = ref([])
const hoverY = ref([])
const hoverValue = ref([])
const hoverTime = ref([])
const tooltipPxX = ref([])
const tooltipPxY = ref([])

const linePath = (pts) => {
  if (!pts || !pts.length) return ''
  return pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * 1000
    const y = 100 - ((p.value - MIN_Y) / (MAX_Y - MIN_Y)) * 100
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

const areaPath = (pts) => {
  const lp = linePath(pts)
  return lp ? `${lp} L 1000 100 L 0 100 Z` : ''
}

const xLabels = (pts) => {
  if (!pts || !pts.length) return []
  const labels = []
  const count = 7
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / (count - 1)) * (pts.length - 1))
    const dt = new Date(pts[idx].timestamp)
    labels.push(dt.getHours() + ':' + dt.getMinutes().toString().padStart(2, '0'))
  }
  return labels
}

const getOverSegments = (pts) => {
  const res = []
  if (!pts || !pts.length) return res
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i-1]
    const cur = pts[i]
    if (prev.value < THRESHOLD && cur.value >= THRESHOLD) res.push(i)
  }
  return res
}

const onMouseMove = (idx, e) => {
  const el = chartRefs.value[idx]
  const s = props.seriesList[idx]
  if (!el || !s?.points?.length) return
  const rect = el.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const svgX = (mouseX / rect.width) * 1000
  const percent = Math.max(0, Math.min(1, svgX / 1000))
  const index = Math.round(percent * (s.points.length - 1))
  const point = s.points[index]
  const ratio = (point.value - MIN_Y) / (MAX_Y - MIN_Y)
  const svgY = 100 - (ratio * 100)
  const anchorPercent = index / (s.points.length - 1)
  hoverX.value[idx] = anchorPercent * 1000
  hoverY.value[idx] = svgY
  hoverValue.value[idx] = Number(point.value).toFixed(1)
  hoverTime.value[idx] = new Date(point.timestamp).toLocaleString()
  tooltipPxX.value[idx] = mouseX
  tooltipPxY.value[idx] = rect.height * (1 - ratio)
  emit('hover-sync', { time: point.timestamp, percent: anchorPercent })
}

const onMouseLeave = (idx) => { hoverX.value[idx] = -1 }

const tooltipLeft = (idx) => {
  const el = chartRefs.value[idx]
  const x = tooltipPxX.value[idx] || 0
  if (el) { if (x > el.clientWidth - 140) return (x - 130) + 'px' }
  return (x + 15) + 'px'
}
const tooltipTop = (idx) => ((tooltipPxY.value[idx] || 0) - 50) + 'px'

// 从第一个系列获取起始和结束时间（用于 ChartHeader）
const firstStartMs = computed(() => {
  const first = props.seriesList && props.seriesList[0]
  const pts = first && first.points
  return pts && pts.length ? pts[0]?.timestamp || 0 : 0
})
const firstEndMs = computed(() => {
  const first = props.seriesList && props.seriesList[0]
  const pts = first && first.points
  return pts && pts.length ? pts[pts.length - 1]?.timestamp || 0 : 0
})
</script>

<style scoped>
.multi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; height: 100%; overflow: auto; padding: 8px; }
.multi-grid::-webkit-scrollbar { width: 10px; }
.multi-grid::-webkit-scrollbar-track { background: #1e1e1e; }
.multi-grid::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 5px; }
.multi-grid::-webkit-scrollbar-thumb:hover { background: #4e4e52; }
.multi-container { display: flex; flex-direction: column; height: 100%; }
.chart-header { height: 32px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #333; background: #252526; }
.title-section { display: flex; align-items: center; gap: 6px; }
.chart-icon { color: #0078d4; }
.label { font-size: 12px; font-weight: 600; color: #eee; }
.tools { display: flex; align-items: center; gap: 12px; }
.date-range { font-size: 11px; color: #888; }
.grid-item { background: #1e1e1e; border: 1px solid #333; border-radius: 6px; display: flex; flex-direction: column; }
.item-header { height: 32px; display: flex; align-items: center; padding: 0 12px; border-bottom: 1px solid #333; color: #eee; font-size: 12px; }
.chart-body { position: relative; }
.svg-chart { width: 100%; height: 180px; }
.title { font-weight: 600; }
.grid-line { position: absolute; left: 0; right: 0; height: 1px; background: #2b2b2b; }
.threshold-line { position: absolute; left: 0; right: 0; height: 1px; background: #444; }
.threshold-label { position: absolute; right: 8px; top: -10px; font-size: 10px; color: #f48771; }
.interaction-layer { position: absolute; inset: 0; }
.tooltip-box { position: absolute; background: #2b2b2b; border: 1px solid #444; border-radius: 4px; padding: 6px 8px; color: #eee; font-size: 11px; pointer-events: none; }
.val { font-weight: 600; }
.alert-val { color: #ff4d4d; }
.alert-badge { display: inline-block; margin-left: 6px; background: #ff4d4d; color: #fff; border-radius: 50%; width: 14px; height: 14px; text-align: center; line-height: 14px; font-size: 10px; }
.chart-footer { display: flex; justify-content: space-between; align-items: center; padding: 4px 12px 10px; }
.axis-labels span { margin-right: 12px; color: #777; font-size: 10px; }
.legend { display: flex; gap: 12px; font-size: 10px; color: #888; }
.legend .red { color: #ff4d4d; }
.legend .blue { color: #00b0ff; }
.close { background: none; border: none; color: #ccc; cursor: pointer; font-size: 18px; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transition: color 0.2s; }
.close:hover { color: #f48771; }
</style>
