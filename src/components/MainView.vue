<template>
  <div class="viewport-container" @mouseup="stopDrag" @mouseleave="stopDrag">
    
    <!-- 顶部导航区域 -->
    <div :class="['top-navigation-area', isTimelineOpen ? 'docked' : 'floating']">
      <!-- Pill State -->
      <div v-if="!isTimelineOpen" class="time-pill" @click="openTimeline">
        <div class="expand-action">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </div>
        <div class="divider"></div>
        <div class="pill-content">
          <svg class="cal-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span class="date-text">{{ currentDateStr }}</span>
          <span class="time-text">{{ currentTimeStr }}</span>
        </div>
        <div class="divider"></div>
        <div class="live-status-box">
          <div class="live-btn" :class="{ active: isLive }"><span class="dot">●</span> {{ t('timeline.live') }}</div>
        </div>
      </div>

      <!-- Timeline Dock -->
      <div v-else class="timeline-dock">
        <div class="timeline-toolbar">
          <div class="toolbar-left">
            <button class="tool-btn collapse" @click="closeTimeline"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg></button>
            <div class="divider-v"></div>
            <div class="current-info">
              <svg class="cal-icon-sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span class="info-text">{{ currentDateStr }} &nbsp; <strong>{{ currentTimeStr }}</strong></span>
            </div>
            <div class="live-indicator" :class="{ active: isLive }" @click="goLive"><span class="dot">●</span> {{ t('timeline.live') }}</div>
          </div>
          <div class="toolbar-right">
            <div class="time-range-wrapper" ref="dropdownRef">
              <div class="dropdown-trigger" @click="toggleTimeRangeMenu">{{ selectedTimeRangeLabel }} <svg class="arrow" :class="{ rotated: isTimeRangeMenuOpen }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
              <transition name="fade">
                <div v-if="isTimeRangeMenuOpen" class="dropdown-menu">
                  <div v-for="option in timeOptions" :key="option.value" class="menu-item" :class="{ active: selectedTimeRange.value === option.value }" @click="selectTimeRange(option)">{{ option.label }}<svg v-if="selectedTimeRange.value === option.value" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                  <div class="menu-divider"></div>
                  <div class="menu-item" :class="{ active: selectedTimeRange.value === 'custom' }" @click="openCustomRangeModal">{{ t('timeline.custom') }}...<svg v-if="selectedTimeRange.value === 'custom'" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                </div>
              </transition>
            </div>
            <div class="control-group">
              <button class="circle-btn" @click="zoomOut"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
              <button class="circle-btn" @click="zoomIn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
            </div>
            <div class="control-group">
              <button class="icon-btn-lg" @click="togglePlay"><svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></button>
              <button class="icon-btn-lg" :class="{ 'active-blue': isLooping }" @click="isLooping = !isLooping"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg></button>
            </div>
            <div class="speed-box" @click="cycleSpeed">{{ playbackSpeed }}x</div>
          </div>
        </div>
        <div class="timeline-track-row">
          <button class="nav-arrow left" @click="panTimeline(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
          <div class="track-container" ref="trackRef" @mousedown="startDrag">
            <div class="mini-chart-layer">
      <svg class="svg-mini" viewBox="0 0 1000 100" preserveAspectRatio="none">
                <defs><linearGradient id="miniAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#00b0ff;stop-opacity:0.2" /><stop offset="100%" style="stop-color:#00b0ff;stop-opacity:0.0" /></linearGradient><linearGradient id="miniStrokeGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0.24" stop-color="#ff4d4d" /><stop offset="0.26" stop-color="#00b0ff" /></linearGradient></defs>
        <path v-if="!miniOverlayPaths.length" :d="miniAreaPath" fill="url(#miniAreaGrad)" stroke="none" />
        <path v-if="!miniOverlayPaths.length" :d="miniLinePath" fill="none" stroke="url(#miniStrokeGrad)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        <path v-for="(p, idx) in miniOverlayPaths" :key="idx" :d="p" fill="none" stroke="url(#miniStrokeGrad)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
      </svg>
            </div>
            <div class="ticks-layer">
              <div v-for="(tick, index) in generatedTicks" :key="index" class="tick" :class="[tick.type, { 'text-white': tick.highlight }]" :style="{ left: tick.percent + '%' }"><span v-if="tick.label">{{ tick.label }}</span></div>
            </div>
            <div class="scrubber" :style="{ left: progress + '%' }"><div class="head"></div><div class="line"></div></div>
          </div>
          <button class="nav-arrow right" @click="panTimeline(1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
        </div>
      </div>
    </div>
    
    <!-- Custom Range Modal -->
    <div v-if="isCustomModalOpen" class="modal-overlay">
      <div class="custom-modal">
        <div class="dialog-header"><span class="dialog-title">{{ t('timeline.selectDateRange') }}</span><button class="dialog-close-btn" @click="closeCustomModal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div>
        <div class="calendar-widget">
          <div class="cal-header"><button @click="changeMonth(-1)">&#9664;</button><span>{{ calendarTitle }}</span><button @click="changeMonth(1)">&#9654;</button></div>
          <div class="cal-grid">
            <div class="cal-day-name" v-for="(d, idx) in calendarDayNames" :key="idx">{{d}}</div>
            <div v-for="(day, idx) in calendarDays" :key="idx" class="cal-day" :class="{ 'empty': !day.inMonth, 'selected': isDaySelected(day.date), 'in-range': isDayInRange(day.date) }" @click="handleDayClick(day)">{{ day.date ? day.date.getDate() : '' }}</div>
          </div>
          <div class="range-preview"><div class="preview-box"><label>{{ t('timeline.startDate') }}</label><span :class="{ placeholder: !tempStart }">{{ formatDate(tempStart) || t('common.select') }}</span></div><div class="arrow">→</div><div class="preview-box"><label>{{ t('timeline.endDate') }}</label><span :class="{ placeholder: !tempEnd }">{{ formatDate(tempEnd) || t('common.select') }}</span></div></div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" @click="closeCustomModal">{{ t('common.cancel') }}</button><button class="btn-apply" @click="applyCustomRange" :disabled="!tempStart || !tempEnd">{{ t('common.apply') }}</button></div>
      </div>
    </div>

    <!-- 3D 画布区域 -->
    <div class="canvas-3d">
      <div id="forgeViewer" ref="viewerContainer"></div>
      
      <!-- IoT 数据标签覆盖层 (所有房间) -->
      <div class="overlay-tags">
        <div
          v-for="tag in roomTags"
          :key="tag.dbId"
          v-show="areTagsVisible && !isSettingsPanelOpen && tag.visible"
          class="tag-wrapper"
          :style="{ top: tag.y + 'px', left: tag.x + 'px' }"
        >
          <div class="tag-pin selected">
            <div class="pin-val blue" :style="getTagStyle(tag.currentTemp)">
              {{ tag.currentTemp }} °C
            </div>
          </div>
        </div>
      </div>


      <div
        v-if="currentView === 'connect'"
        class="temperature-label-btn"
        :class="{ active: areTagsVisible }"
        @click="toggleTemperatureLabels"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" style="margin-right: 6px;">
          <text x="2" y="12" font-size="10" fill="currentColor" font-weight="bold">°C</text>
        </svg>
        {{ t('header.temperatureLabel') }}
      </div>

      <div
        v-if="currentView === 'connect'"
        class="heatmap-btn"
        :class="{ active: isHeatmapEnabled }"
        @click="toggleHeatmap"
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

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, reactive } from 'vue';
import { isInfluxConfigured, writeRoomHistory, queryAverageSeries, queryLatestByRooms, queryRoomSeries } from '../services/influx';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

// 定义 props
const props = defineProps({
  currentView: { type: String, default: 'connect' },
  assets: { type: Array, default: () => [] }, // 从数据库加载的资产列表
  rooms: { type: Array, default: () => [] }    // 从数据库加载的空间列表
});

// 定义事件发射
const emit = defineEmits(['rooms-loaded', 'assets-loaded', 'chart-data-update', 'time-range-changed', 'viewer-ready', 'model-selection-changed']);

// ================== 1. 所有响应式状态 (Top Level) ==================

// UI 状态
const isTimelineOpen = ref(false);
const isPlaying = ref(false);
const isLooping = ref(false);
const isDragging = ref(false);
const playbackSpeed = ref(1);
const progress = ref(95);
const trackRef = ref(null);

// 标签与房间状态
const roomTags = ref([]); // 存储所有房间标签对象
const areTagsVisible = ref(false); // 温度标签显示状态，默认不显示
const isSettingsPanelOpen = ref(false); // 设置面板打开状态
let foundRoomDbIds = [];
let roomFragData = {}; // 材质缓存 {fragId: material}
let isManualSelection = false; // 防止递归调用的标志
const isHeatmapEnabled = ref(false); // 热力图开关状态

// 辅助函数：设置手动选择标志，并在短时间后自动重置
const setManualSelection = () => {
  isManualSelection = true;
  // 使用 setTimeout 确保在当前调用栈完成后重置标志
  // 这样可以避免标志永久为 true 的情况
  setTimeout(() => {
    isManualSelection = false;
  }, 100);
};

// 资产状态
let foundAssetDbIds = [];
let assetFragData = {}; // 资产材质缓存

// Viewer 状态
const viewerContainer = ref(null);
let viewer = null;
const MODEL_URL = '/models/my-building/output/3d.svf';
let modelLoaded = false; // 追踪模型是否已加载完成
let currentModelPath = null; // 当前加载或已加载的模型路径
let isLoadingModel = false; // 是否正在加载模型
let defaultView = null;
const animateToDefaultView = (duration = 800) => {
  if (!defaultView || !viewer || !viewer.navigation) return;
  const nav = viewer.navigation;
  const sp = nav.getPosition().clone();
  const st = nav.getTarget().clone();
  const ep = defaultView.pos.clone();
  const et = defaultView.target.clone();
  const start = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const e = ease(t);
    const ip = new window.THREE.Vector3(
      sp.x + (ep.x - sp.x) * e,
      sp.y + (ep.y - sp.y) * e,
      sp.z + (ep.z - sp.z) * e
    );
    const it = new window.THREE.Vector3(
      st.x + (et.x - st.x) * e,
      st.y + (et.y - st.y) * e,
      st.z + (et.z - st.z) * e
    );
    nav.setView(ip, it);
    if (defaultView.up) nav.setWorldUpVector(defaultView.up.clone());
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

// 时间状态
const MOCK_NOW = new Date(); 
const endDate = ref(new Date(MOCK_NOW));
const startDate = ref(new Date(MOCK_NOW.getTime() - 3 * 24 * 60 * 60 * 1000)); 

// Dropdown & Modal 状态
const isTimeRangeMenuOpen = ref(false);
const dropdownRef = ref(null);
const selectedTimeRange = ref({ label: '', value: '3d' });
const isCustomModalOpen = ref(false);
const calendarViewDate = ref(new Date());
const tempStart = ref(null);
const tempEnd = ref(null);

// ================== 2. 计算属性 (Computed) ==================

// 时间范围选项（支持多语言）
const timeOptions = computed(() => [
  { label: t('timeline.24h'), value: '24h' },
  { label: t('timeline.3d'), value: '3d' },
  { label: t('timeline.7d'), value: '7d' },
  { label: t('timeline.30d'), value: '30d' }
]);

// 当前选中的时间范围标签（支持多语言）
const selectedTimeRangeLabel = computed(() => {
  if (selectedTimeRange.value.value === 'custom') {
    return t('timeline.custom');
  }
  const option = timeOptions.value.find(o => o.value === selectedTimeRange.value.value);
  return option ? option.label : '';
});

// 日历星期名称（支持多语言）
const calendarDayNames = computed(() => [
  t('calendar.sun'),
  t('calendar.mon'),
  t('calendar.tue'),
  t('calendar.wed'),
  t('calendar.thu'),
  t('calendar.fri'),
  t('calendar.sat')
]);

// 图表数据改为可写 ref，通过 InfluxDB 拉取，失败时退回本地模拟
const chartData = ref([]);
const overlaySeries = ref([]);
const isCacheReady = ref(false);
let heatmapTimer = null;
let lastAppliedTemps = {};
const HEATMAP_EPS = 0.3;
let uiObserver = null;
const selectedRoomCodes = ref([]);
let roomSeriesCache = {};
let roomSeriesRange = { startMs: 0, endMs: 0, windowMs: 0 };

const computeValue = (timestamp) => {
  const d = new Date(timestamp);
  const h = d.getHours() + d.getMinutes() / 60;
  const base = 26.5 + 2.2 * Math.sin(((h - 14) / 24) * 2 * Math.PI);
  const noise = (Math.random() - 0.5) * 0.4;
  return Math.max(24, Math.min(29, base + noise));
};

const genLocalSeries = () => {
  const start = startDate.value.getTime();
  const end = endDate.value.getTime();
  const points = [];
  const count = 300;
  const step = (end - start) / (count - 1);
  for (let i = 0; i < count; i++) {
    const ts = start + i * step;
    points.push({ timestamp: ts, value: computeValue(ts) });
  }
  chartData.value = points;
};

const loadChartData = async () => {
  const start = startDate.value.getTime();
  const end = endDate.value.getTime();
  const windowMs = Math.max(60_000, Math.round((end - start) / 300));
  if (isInfluxConfigured()) {
    try {
      const pts = await queryAverageSeries(start, end, windowMs);
      if (pts.length) {
        chartData.value = pts;
        return;
      }
    } catch {}
  }
  genLocalSeries();
};

const refreshRoomSeriesCache = async (codes) => {
  isCacheReady.value = false;
  if (!isInfluxConfigured()) { roomSeriesCache = {}; isCacheReady.value = true; return; }
  const start = startDate.value.getTime();
  const end = endDate.value.getTime();
  const windowMs = Math.max(60_000, Math.round((end - start)/300));
  roomSeriesRange = { startMs: start, endMs: end, windowMs };
  const targetCodes = (codes && codes.length ? codes : roomTags.value.map(t => t.code).filter(Boolean));
  const list = await Promise.all(targetCodes.map(c => queryRoomSeries(c, start, end, windowMs).then(pts => ({ code: c, pts })).catch(() => ({ code: c, pts: [] }))));
  const cache = {};
  list.forEach(({ code, pts }) => { cache[code] = pts || []; });
  roomSeriesCache = cache;
  isCacheReady.value = true;
};

const currentTemp = computed(() => {
  if (!chartData.value.length) return 0;
  const index = Math.round((progress.value / 100) * (chartData.value.length - 1));
  const point = chartData.value[index];
  return point ? parseFloat(point.value.toFixed(1)) : 0;
});

// 监听图表数据变化，发射给父组件
watch(chartData, (newData) => {
  emit('chart-data-update', newData);
}, { immediate: true });

// 监听温度变化，更新房间标签数值
const valueAtTime = (pts, ms) => {
  if (!pts || !pts.length) return undefined;
  let l = 0, r = pts.length - 1;
  while (l < r) { const m = (l + r) >> 1; if (pts[m].timestamp < ms) l = m + 1; else r = m; }
  const i = l;
  const prev = pts[Math.max(0, i-1)], cur = pts[i];
  const pick = !prev ? cur : (!cur ? prev : (Math.abs(prev.timestamp - ms) <= Math.abs(cur.timestamp - ms) ? prev : cur));
  return pick?.value;
};

const setTagTempsAtCurrentTime = () => {
  if (!roomTags.value.length) return;
  const percent = Math.max(0, Math.min(1, progress.value / 100));
  roomTags.value.forEach(tag => {
    const pts = roomSeriesCache[tag.code];
    if (pts && pts.length) {
      const idx = Math.round(percent * (pts.length - 1));
      const v = pts[idx]?.value;
      if (v !== undefined) tag.currentTemp = Number(v).toFixed(1);
    } else if (!isInfluxConfigured()) {
      tag.currentTemp = Number(currentTemp.value + tag.offset).toFixed(1);
    }
  });
  if (isHeatmapEnabled.value && viewer) {
    if (!heatmapTimer) {
      heatmapTimer = setTimeout(() => { heatmapTimer = null; applyHeatmapStyle(); }, 400);
    }
  }
};

watch(currentTemp, () => setTagTempsAtCurrentTime());

watch(progress, () => setTagTempsAtCurrentTime());

// 监听数据库数据变化，当数据加载后重新应用孤立效果
watch(() => [props.assets, props.rooms, props.currentView], ([newAssets, newRooms, newView]) => {
  
  // 必须等待 viewer 和模型都加载完成
  if (!viewer || !modelLoaded) {
    return;
  }
  
  // 数据加载完成后，根据当前视图重新应用显示逻辑
  if (newView === 'assets' && newAssets.length > 0) {
    // 切换到资产视图时，隐藏温度标签
    areTagsVisible.value = false;
    setTimeout(() => {
      showAllAssets();
    }, 200);
  } else if (newView === 'connect' && newRooms.length > 0) {
    setTimeout(() => {
      applyRoomStyle();
    }, 200);
  }
}, { deep: true });

// isLive 放在这里，确保 progress 已定义
const isLive = computed(() => progress.value > 99.5);

const currentDisplayDate = computed(() => new Date(startDate.value.getTime() + (progress.value/100)*(endDate.value-startDate.value)));
const currentDateStr = computed(() => {
  const localeCode = locale.value === 'zh' ? 'zh-CN' : 'en-US';
  return currentDisplayDate.value.toLocaleDateString(localeCode, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
});
const currentTimeStr = computed(() => {
  const localeCode = locale.value === 'zh' ? 'zh-CN' : 'en-US';
  const timeStr = currentDisplayDate.value.toLocaleTimeString(localeCode, { hour: 'numeric', minute: '2-digit', hour12: locale.value !== 'zh' });
  return locale.value === 'zh' ? timeStr : timeStr + ' EDT';
});

const miniLinePath = computed(() => chartData.value.length ? chartData.value.map((p, i) => `${i===0?'M':'L'} ${(i/(chartData.value.length-1))*1000} ${100-((p.value-0)/40)*100}`).join(' ') : '');
const miniAreaPath = computed(() => miniLinePath.value ? `${miniLinePath.value} L 1000 100 L 0 100 Z` : '');
const miniOverlayPaths = computed(() => {
  return overlaySeries.value.map(series => series.map((p, i) => `${i===0?'M':'L'} ${(i/(series.length-1))*1000} ${100-((p.value-0)/40)*100}`).join(' '));
});

const generatedTicks = computed(() => {
  const s = startDate.value.getTime(), e = endDate.value.getTime(), d = e - s; if(d<=0) return [];
  const localeCode = locale.value === 'zh' ? 'zh-CN' : 'en-US';
  const steps = [{v:36e5},{v:72e5},{v:144e5},{v:216e5},{v:432e5},{v:864e5},{v:1728e5},{v:6048e5},{v:2592e6},{v:31536e6}];
  const step = steps.find(x => x.v >= d/10) || steps[steps.length-1]; const interval = step.v;
  const ticks = []; let c = Math.floor(s/interval)*interval; if(c<s) c+=interval;
  while(c<=e) { const p=((c-s)/d)*100; const dt=new Date(c); let l='', h=false, t='major'; if(interval<864e5){ if(dt.getHours()===0){l=dt.toLocaleDateString(localeCode,{month:'short',day:'numeric'});h=true;}else{l=dt.toLocaleTimeString(localeCode,{hour:'numeric'}).replace(' ','');t='minor';}}else{l=dt.toLocaleDateString(localeCode,{month:'short',day:'numeric'});h=true;} ticks.push({percent:p,type:t,label:l,highlight:h}); c+=interval; } return ticks;
});

const calendarTitle = computed(() => {
  const localeCode = locale.value === 'zh' ? 'zh-CN' : 'en-US';
  return calendarViewDate.value.toLocaleDateString(localeCode, { month: 'long', year: 'numeric' });
});
const calendarDays = computed(() => { const y = calendarViewDate.value.getFullYear(), m = calendarViewDate.value.getMonth(), fd = new Date(y, m, 1), ld = new Date(y, m + 1, 0), g = []; for(let i=0; i<fd.getDay(); i++) g.push({ date: null, inMonth: false }); for(let i=1; i<=ld.getDate(); i++) g.push({ date: new Date(y, m, i), inMonth: true }); return g; });

// 辅助样式计算
const getTagStyle = (t) => {
  if (t > 35) return { backgroundColor: '#ff4d4d', borderColor: '#d32f2f' };
  if (t > 30) return { backgroundColor: '#4caf50', borderColor: '#388e3c' };
  return { backgroundColor: '#0078d4', borderColor: '#005a9e' };
};

// ================== 3. Viewer 逻辑 ==================

const initViewer = () => {
  if (!window.Autodesk) return;
  // 将 Viewer 语言与系统语言同步
  const viewerLanguage = locale.value === 'zh' ? 'zh-cn' : 'en';
  const options = { env: 'Local', document: null, language: viewerLanguage };
  window.Autodesk.Viewing.Initializer(options, () => {
    viewer = new window.Autodesk.Viewing.GuiViewer3D(viewerContainer.value);
    
    viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onModelLoaded);
    viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged);
    viewer.addEventListener(window.Autodesk.Viewing.CAMERA_CHANGE_EVENT, updateAllTagPositions);
    viewer.addEventListener(window.Autodesk.Viewing.viewerResizeEvent, updateAllTagPositions);
    
    if (viewer.start() > 0) return;
    
    // 设置基础样式
    viewer.setTheme('dark-theme');
    viewer.setLightPreset(17); // Field environment
    if (viewer.setProgressiveRendering) viewer.setProgressiveRendering(false);
    if (viewer.setQualityLevel) viewer.setQualityLevel(false, false);
    
    // 反转鼠标缩放方向（滚轮向上放大）
    if (viewer.navigation) {
      viewer.navigation.setReverseZoomDirection(true);
    }
    
    // 设置 UI 观察器
    const root = viewerContainer.value;
    if (root) {
      const checkOpen = () => {
        let open = false;
        const panels = root.querySelectorAll('.docking-panel, .settings-panel, .adsk-settings, .adsk-viewing-settings');
        panels.forEach(el => {
          const cs = window.getComputedStyle(el);
          const opacity = parseFloat(cs.opacity || '1');
          if (cs.display !== 'none' && cs.visibility !== 'hidden' && opacity > 0.1 && el.offsetWidth > 0 && el.offsetHeight > 0) {
            open = true;
          }
        });
        // 更新设置面板状态，温度标签会根据此状态自动隐藏/显示
        // 但不改变 areTagsVisible（按钮状态）
        isSettingsPanelOpen.value = open;
      };
      uiObserver = new MutationObserver(checkOpen);
      uiObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      checkOpen();
    }
    
    // Viewer 就绪，通知父组件决定加载哪个模型
    console.log('🎬 Viewer 已初始化，等待加载模型指令');
    emit('viewer-ready');
  });
};


// 新增：加载新模型
const loadNewModel = async (modelPath) => {
  if (!viewer) return;
  
  // 防止重复加载同一个模型
  if (isLoadingModel || currentModelPath === modelPath) {
    console.log(`⏭️ 模型正在加载或已加载，跳过: ${modelPath}`);
    return;
  }
  
  isLoadingModel = true;
  console.log('🔄 开始加载新模型:', modelPath);
  
  // 构造候选路径
  let candidates = [];
  if (modelPath.endsWith('.svf')) {
    candidates.push(modelPath);
  } else {
    // 优先尝试 /output/3d.svf (标准结构)
    candidates.push(`${modelPath}/output/3d.svf`);
    // 备用尝试 /3d.svf (扁平结构)
    candidates.push(`${modelPath}/3d.svf`);
  }
  
  let finalPath = candidates[0];
  
  // 预检路径，防止 Viewer 弹出错误提示
  try {
    let found = false;
    for (const p of candidates) {
      try {
        const res = await fetch(p, { method: 'HEAD' });
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          // 防止 SPA 返回 index.html (text/html) 被误认为是 SVF
          if (contentType && contentType.includes('text/html')) {
            console.warn(`⚠️ 路径 ${p} 返回了 HTML (可能是404)，跳过`);
            continue;
          }
          finalPath = p;
          found = true;
          break;
        }
      } catch (e) {
        // 网络错误等忽略
      }
    }
    // 如果没有任何路径 ok，保留默认的第一个路径去让 viewer 报错（或者处理失败）
  } catch (e) {
    console.warn('⚠️ 模型路径预检失败，将尝试默认路径:', e);
  }
  
  // 卸载所有当前加载的模型
  console.log('🧹 开始卸载旧模型...');
  const modelsToUnload = viewer.getVisibleModels ? viewer.getVisibleModels() : (viewer.model ? [viewer.model] : []);
  
  if (modelsToUnload.length > 0) {
    console.log(`🗑️ 卸载 ${modelsToUnload.length} 个模型`);
    modelsToUnload.forEach((model, index) => {
      console.log(`  - 卸载模型 ${index + 1}`);
      viewer.unloadModel(model);
    });
    // 等待卸载完成
    await new Promise(resolve => setTimeout(resolve, 100));
  } else {
    console.log('ℹ️ 没有需要卸载的模型');
  }
  
  // 加载新模型
  viewer.loadModel(finalPath, {}, (model) => {
      console.log('✅ 新模型加载成功:', finalPath);
      console.log('📊 模型信息:', { 
        hasGeometry: model.getGeometryList ? 'Yes' : 'No',
        rootId: model.getRootId ? model.getRootId() : 'N/A'
      });
      
      // 标记模型路径和重置加载状态
      currentModelPath = modelPath;
      isLoadingModel = false;
      
      // 其他初始化设置
      viewer.setTheme('dark-theme');
      viewer.setLightPreset(17); // Field
      if (viewer.setProgressiveRendering) viewer.setProgressiveRendering(false);
      if (viewer.setQualityLevel) viewer.setQualityLevel(false, false);
      
      // 检查几何体是否已加载完成
      // 如果已完成，手动触发 onModelLoaded（以防事件未触发）
      setTimeout(() => {
        if (model.isLoadDone && model.isLoadDone()) {
          console.log('📦 检测到几何体已加载完成，确保初始化执行');
          // GEOMETRY_LOADED_EVENT 应该已经触发，但为了保险，我们检查状态
          if (foundRoomDbIds.length === 0 && foundAssetDbIds.length === 0) {
            console.log('⚠️ 数据未提取，手动触发 onModelLoaded');
            onModelLoaded();
          }
        }
      }, 1000);
      
      // 注意：onModelLoaded 会通过事件自动触发
  }, (errorCode) => {
      console.error('❌ 模型加载失败:', errorCode, finalPath);
      // 如果预检都通过了还失败，那就没办法了
  });
};

// 自定义材质单例
let customRoomMat = null;
const getRoomMaterial = () => {
  if (customRoomMat) return customRoomMat;
  // 浅紫色：#B39DDB (RGB: 179, 157, 219)
  customRoomMat = new window.THREE.MeshBasicMaterial({
    color: 0xB39DDB, opacity: 0.5, transparent: true,
    side: window.THREE.DoubleSide, depthWrite: false, depthTest: true
  });
  viewer.impl.matman().addMaterial('custom-room-mat', customRoomMat, true);
  return customRoomMat;
};

// 热力图材质缓存
const heatmapMaterialCache = {};

// 根据温度生成热力图材质
const getHeatmapMaterial = (temperature) => {
  // 使用缓存避免重复创建材质
  const tempKey = Math.round(temperature * 10) / 10; // 精确到0.1度
  if (heatmapMaterialCache[tempKey]) {
    return heatmapMaterialCache[tempKey];
  }

  const minT = 25, maxT = 35;
  let t = (temperature - minT) / (maxT - minT);
  t = Math.max(0, Math.min(1, t));

  // 从蓝色(冷)到红色(热)
  let hue = 200 - (t * 200); // 200(蓝) -> 0(红)

  // 转换 HSL 到 RGB
  const hslToRgb = (h, s, l) => {
    h = h / 360;
    s = s / 100;
    l = l / 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const [r, g, b] = hslToRgb(hue, 100, 50);
  const color = (r << 16) | (g << 8) | b;

  const mat = new window.THREE.MeshPhongMaterial({
    color: color,
    opacity: 0.8,
    transparent: true,
    side: window.THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    shininess: 30
  });

  // 注册到材质管理器
  const matman = viewer.impl.matman();
  matman.addMaterial(`heatmap-${tempKey}`, mat, true);

  // 缓存材质
  heatmapMaterialCache[tempKey] = mat;

  return mat;
};

// 1. 模型加载
const onModelLoaded = () => {
  console.log('🎯 onModelLoaded 被触发');
  
  // 重置状态（确保每次加载新模型时都从干净状态开始）
  roomTags.value = [];
  roomFragData = {};
  foundRoomDbIds = [];
  foundAssetDbIds = [];
  modelLoaded = true; // 标记模型已加载
  console.log('🧹 状态已重置');
  
  if (!defaultView && viewer && viewer.navigation) {
    try {
      const pos = viewer.navigation.getPosition().clone();
      const target = viewer.navigation.getTarget().clone();
      const up = viewer.navigation.getWorldUpVector().clone();
      defaultView = { pos, target, up };
    } catch {}
  }
  // 递归获取所有叶子节点 ID
  const getAllLeafDbIds = (rootIds) => {
    if (!viewer || !viewer.model) return [];
    try {
      const tree = viewer.model.getInstanceTree();
      if (!tree) return rootIds;

      const leafIds = new Set();
      const visited = new Set(); // 防止循环引用
      const stack = [...rootIds];

      while (stack.length > 0) {
        const dbId = stack.pop();
        if (visited.has(dbId)) continue;
        visited.add(dbId);

        if (tree.getChildCount(dbId) > 0) {
          tree.enumNodeChildren(dbId, (childId) => {
            stack.push(childId);
          });
        } else {
          leafIds.add(dbId);
        }
      }
      return Array.from(leafIds);
    } catch (e) {
      console.error('getAllLeafDbIds error:', e);
      return rootIds; // 回退到原始ID
    }
  };

  // 增强的房间搜索逻辑
  viewer.search('Rooms', (roomDbIds) => {
    viewer.search('房间', (cnRoomDbIds) => {
      try {
        let allFoundIds = [];
        if (roomDbIds && roomDbIds.length > 0) allFoundIds = allFoundIds.concat(roomDbIds);
        if (cnRoomDbIds && cnRoomDbIds.length > 0) allFoundIds = allFoundIds.concat(cnRoomDbIds);

        // 去重
        allFoundIds = Array.from(new Set(allFoundIds));

        if (allFoundIds.length > 0) {
          // 展开所有分组
          const leafIds = getAllLeafDbIds(allFoundIds);
          console.log(`🔍 搜索到 ${allFoundIds.length} 个相关节点，展开后得到 ${leafIds.length} 个叶子节点`);
          processRooms(leafIds);
        } else {
          console.warn('⚠️ 未搜索到任何房间节点');
          processRooms([]); 
        }
      } catch (err) {
        console.error('房间搜索处理出错:', err);
        processRooms([]);
      }
    });
  });

  // 同时提取资产
  extractAssets();
};

// 2. 处理房间 (缓存材质 + 生成标签 + 获取属性)
const processRooms = (dbIds) => {
  foundRoomDbIds = dbIds || [];
  
  if (foundRoomDbIds.length === 0) {
      emit('rooms-loaded', []);
      return;
  }

  const fragList = viewer.model.getFragmentList();
  const tree = viewer.model.getInstanceTree();

  const newTags = [];
  const roomList = []; // 存储房间列表用于左侧面板
  let pendingProps = dbIds.length;

  dbIds.forEach(dbId => {
    // A. 缓存材质 (重要：保留原始引用)
    tree.enumNodeFragments(dbId, (fragId) => {
      if (roomFragData[fragId] === undefined) {
        roomFragData[fragId] = fragList.getMaterial(fragId);
      }
    });

    // B. 计算中心点
    const bounds = new window.THREE.Box3();
    const frags = [];
    tree.enumNodeFragments(dbId, f => frags.push(f));
    frags.forEach(f => {
      const b = new window.THREE.Box3();
      fragList.getWorldBounds(f, b);
      bounds.union(b);
    });

    let worldPos = null;
    if (!bounds.isEmpty()) {
      const center = new window.THREE.Vector3();
      bounds.getCenter(center);
      worldPos = center;

      newTags.push({
        dbId: dbId,
        worldPos: center,
        x: 0, y: 0, visible: true,  // 默认显示温度标签
        offset: (Math.random() - 0.5) * 2,
        currentTemp: 25
      });
    }

    // C. 获取房间属性（名称、编号）
    viewer.getProperties(dbId, (result) => {
      let name = '';
      let code = '';

      if (result && result.properties) {
        result.properties.forEach(prop => {
          // 匹配"名称"属性
          if (prop.displayName === '名称' || prop.displayName === 'Name' || prop.displayName === 'name') {
            name = prop.displayValue || '';
          }
          // 匹配"编号"属性
          if (prop.displayName === '编号' || prop.displayName === 'Number' || prop.displayName === 'number') {
            code = prop.displayValue || '';
          }
        });
      }

      // 如果没有找到名称，使用节点名称
      if (!name && result && result.name) {
        name = result.name;
      }

      // 只添加有"编号"属性的房间
      if (code) {
        roomList.push({
          dbId: dbId,
          name: name || `房间 ${dbId}`,
          code: code
        });
        const tag = newTags.find(t => t.dbId === dbId);
        if (tag) tag.code = code;
      }

      pendingProps--;
      if (pendingProps === 0) {
        // 所有属性获取完成，发送房间列表
emit('rooms-loaded', roomList);
// 异步写入 InfluxDB，不阻塞主流程
seedRoomHistory(roomList).catch(err => console.warn('⚠️ InfluxDB 写入失败:', err));

        // 预取所有房间的时序缓存，确保首次播放就绪
        const allCodes = roomList.map(r => r.code).filter(Boolean);
        refreshRoomSeriesCache(allCodes).then(() => setTagTempsAtCurrentTime()).catch(() => {});

        // 根据当前视图决定是否应用房间样式
        setTimeout(() => {
          console.log(`🎯 检查视图状态（房间）: currentView = "${props.currentView}"`);
          if (props.currentView === 'connect') {
            console.log('🏠 当前是连接视图，调用 applyRoomStyle()');
            applyRoomStyle();
          } else {
            console.log(`ℹ️ 当前不是连接视图，跳过房间显示 (视图: ${props.currentView})`);
          }
        }, 100);
      }
    }, (err) => {
      // 属性获取失败，跳过该房间（没有编号）
      pendingProps--;
      if (pendingProps === 0) {
        emit('rooms-loaded', roomList);

        // 根据当前视图决定是否应用房间样式
        setTimeout(() => {
          if (props.currentView === 'connect') {
            applyRoomStyle();
          }
        }, 100);
      }
    });
  });

  roomTags.value = newTags;
};

// 2.5 提取资产
const extractAssets = () => {
  if (!viewer || !viewer.model) return;

  const instanceTree = viewer.model.getInstanceTree();
  if (!instanceTree) return;

  const assetList = [];
  const allDbIds = [];

  // 获取所有 dbId
  instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
    allDbIds.push(dbId);
  }, true);

  let pendingProps = allDbIds.length;
  if (pendingProps === 0) {
    emit('assets-loaded', []);
    return;
  }

  allDbIds.forEach(dbId => {
    viewer.getProperties(dbId, (result) => {
      let mcCode = '';
      let classification = '';
      let name = result.name || '';

      if (result && result.properties) {
        result.properties.forEach(prop => {
          if (prop.displayName === 'MC编码' || prop.displayName === 'MC Code') {
            mcCode = prop.displayValue || '';
          }
          if (prop.displayName === 'Classification.OmniClass.23.Number') {
            classification = prop.displayValue || '';
          }
        });
      }

      // 只添加 MC编码 非空的构件
      if (mcCode) {
        assetList.push({
          dbId,
          name,
          mcCode,
          classification: classification || 'Uncategorized'
        });
        foundAssetDbIds.push(dbId);
      }

      pendingProps--;
      if (pendingProps === 0) {
        console.log(`✅ 资产提取完成: 共 ${assetList.length} 个资产`);
        emit('assets-loaded', assetList);

        // 如果当前是资产视图，立即显示资产
        setTimeout(() => {
          console.log(`🎯 检查视图状态: currentView = "${props.currentView}"`);
          if (props.currentView === 'assets') {
            console.log('📱 当前是资产视图，调用 showAllAssets()');
            showAllAssets();
          } else {
            console.log(`ℹ️ 当前不是资产视图，跳过自动显示 (视图: ${props.currentView})`);
          }
        }, 100);
      }
    });
  });
};

// 3. 应用浅紫色样式到所有房间
const applyRoomStyle = () => {
  if (!viewer) return;

  // 优先使用从数据库传入的空间列表
  let dbIdsToShow = [];
  if (props.rooms && props.rooms.length > 0) {
    // 使用数据库中的空间列表
    dbIdsToShow = props.rooms.map(r => r.dbId).filter(Boolean);
  } else if (foundRoomDbIds.length > 0) {
    // 回退到模型提取的房间列表（基于"编号"属性）
    dbIdsToShow = foundRoomDbIds;
  }

  if (dbIdsToShow.length === 0) return;

  // 清除所有主题颜色
  viewer.clearThemingColors();

  const mat = getRoomMaterial();
  const fragList = viewer.model.getFragmentList();
  const tree = viewer.model.getInstanceTree();

  dbIdsToShow.forEach(dbId => {
    tree.enumNodeFragments(dbId, (fragId) => {
      fragList.setMaterial(fragId, mat);
    });
  });

  // 孤立房间（隐藏其他构件）
  viewer.isolate(dbIdsToShow);

  // 强制刷新渲染
  viewer.impl.invalidate(true, true, true);

  updateAllTagPositions();
};

// 4. 移除样式 (恢复)
const removeRoomStyle = () => {
  if (foundRoomDbIds.length === 0) return;
  const fragList = viewer.model.getFragmentList();
  const tree = viewer.model.getInstanceTree();

  foundRoomDbIds.forEach(dbId => {
    tree.enumNodeFragments(dbId, (fragId) => {
      const original = roomFragData[fragId];
      // 关键修复：绝对不传 null，必须传回原始对象
      if (original) {
        fragList.setMaterial(fragId, original);
      }
    });
  });
  
  viewer.impl.invalidate(true);
};

// 5. 选择变更（在模型上直接点击时触发）
const onSelectionChanged = (event) => {
  const dbIds = event.dbIdArray;
  
  // 如果是程序化选择（从列表触发），跳过处理但不影响反向定位
  if (isManualSelection) {
    // 立即重置标志，确保下次用户点击能正常工作
    isManualSelection = false;
    // 如果选择了内容，仍然发射事件以更新列表状态
    // 这样可以确保列表和模型状态同步
    return;
  }

  if (dbIds && dbIds.length > 0) {
    // 在模型上选中了某个构件 - 不移动相机，只发射反向定位事件
    // 🔑 反向定位：发射事件通知父组件更新列表选中状态
    emit('model-selection-changed', dbIds);
  } else {
    // 取消选择：根据当前视图恢复显示
    if (props.currentView === 'assets') {
      showAllAssets();
    } else {
      showAllRooms();
    }
    
    // 取消选择时也通知父组件
    emit('model-selection-changed', []);
  }
};

// 6. 更新所有标签位置
const updateAllTagPositions = () => {
  if (!areTagsVisible.value) return;
  roomTags.value.forEach(tag => {
    const p = viewer.worldToClient(tag.worldPos);
    if (p.z > 1) {
      tag.visible = false;
    } else {
      // 只更新位置，不改变 visible 状态（由其他逻辑控制）
      tag.x = p.x;
      tag.y = p.y;
      // 如果没有被特殊设置，默认可见
      if (tag.visible === undefined || tag.visible === null) {
        tag.visible = true;
      }
    }
  });
};

// 7. 孤立并定位到指定房间（支持多选，供外部调用）
const isolateAndFocusRooms = (dbIds) => {
  if (!viewer || !dbIds || dbIds.length === 0) return;

  // 设置标志，防止 onSelectionChanged 递归调用
  setManualSelection();

  // 清除选择（避免蓝色高亮）
  viewer.clearSelection();

  // 隐藏未选中的房间
  const roomsToHide = foundRoomDbIds.filter(id => !dbIds.includes(id));
  if (roomsToHide.length > 0) {
    viewer.hide(roomsToHide);
  }

  // 显示选中的房间
  viewer.show(dbIds);

  // 根据热力图状态应用不同颜色
  if (isHeatmapEnabled.value) {
    // 热力图模式：使用 setThemingColor
    dbIds.forEach(dbId => {
      const tag = roomTags.value.find(t => t.dbId === dbId);
      const temperature = tag ? parseFloat(tag.currentTemp) : 28; // 确保是数字

      // 计算热力图颜色
      const minT = 25, maxT = 35;
      let t = (temperature - minT) / (maxT - minT);
      t = Math.max(0, Math.min(1, t));
      let hue = 200 - (t * 200);

      const hslToRgb = (h, s, l) => {
        h = h / 360; s = s / 100; l = l / 100;
        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      };

      const [r, g, b] = hslToRgb(hue, 100, 50);
      const color = new window.THREE.Vector4(r / 255, g / 255, b / 255, 0.8);
      viewer.setThemingColor(dbId, color);
    });
  } else {
    // 普通模式：清除主题颜色，应用浅紫色材质
    viewer.clearThemingColors();

    const mat = getRoomMaterial();
    const fragList = viewer.model.getFragmentList();
    const tree = viewer.model.getInstanceTree();

    // 先清除所有房间的主题颜色
    foundRoomDbIds.forEach(dbId => {
      viewer.setThemingColor(dbId, null);
    });

    // 然后只对选中的房间应用浅紫色材质
    dbIds.forEach(dbId => {
      tree.enumNodeFragments(dbId, (fragId) => {
        fragList.setMaterial(fragId, mat);
      });
    });
  }

  // 定位到选中的房间
  viewer.fitToView(dbIds, viewer.model);

  // 强制刷新渲染
  viewer.impl.invalidate(true, true, true);

  // 只显示选中房间的温度标签，隐藏其他
  roomTags.value.forEach(tag => {
    tag.visible = dbIds.includes(tag.dbId);
  });

  // 等待视角调整后更新标签位置
  setTimeout(() => {
    dbIds.forEach(dbId => {
      const selectedTag = roomTags.value.find(tag => tag.dbId === dbId);
      if (selectedTag) {
        const p = viewer.worldToClient(selectedTag.worldPos);
        selectedTag.x = p.x;
        selectedTag.y = p.y;
        selectedTag.visible = true;
      }
    });
  }, 100);
};

// 8. 恢复显示所有房间（供外部调用）
const showAllRooms = () => {
  if (!viewer) return;

  // 设置手动选择标志
  setManualSelection();

  // 优先使用从数据库传入的空间列表
  let dbIdsToShow = [];
  if (props.rooms && props.rooms.length > 0) {
    // 使用数据库中的空间列表
    dbIdsToShow = props.rooms.map(r => r.dbId).filter(Boolean);
  } else if (foundRoomDbIds.length > 0) {
    // 回退到模型提取的房间列表
    dbIdsToShow = foundRoomDbIds;
  }

  // 显示所有房间
  if (dbIdsToShow.length > 0) {
    viewer.show(dbIdsToShow);
  }

  // 清除选择
  viewer.clearSelection();

  // 根据热力图状态应用不同颜色
  if (isHeatmapEnabled.value) {
    applyHeatmapStyle();
  } else {
    // 清除所有主题颜色
    viewer.clearThemingColors();

    // 逐个清除房间的主题颜色
    dbIdsToShow.forEach(dbId => {
      viewer.setThemingColor(dbId, null);
    });

    // 应用浅紫色材质
    const mat = getRoomMaterial();
    const fragList = viewer.model.getFragmentList();
    const tree = viewer.model.getInstanceTree();

    dbIdsToShow.forEach(dbId => {
      tree.enumNodeFragments(dbId, (fragId) => {
        fragList.setMaterial(fragId, mat);
      });
    });

    viewer.impl.invalidate(true, true, true);
  }

  // 显示所有房间的温度标签
  roomTags.value.forEach(tag => {
    tag.visible = true;
  });

  // 更新所有标签位置
  updateAllTagPositions();
  animateToDefaultView();
};

// 9. 切换热力图
const toggleHeatmap = () => {
  isHeatmapEnabled.value = !isHeatmapEnabled.value;

  if (isHeatmapEnabled.value) {
    // 启用热力图：应用温度颜色
    applyHeatmapStyle();
  } else {
    // 关闭热力图：清除主题颜色，恢复蓝色材质
    viewer.clearThemingColors();
    lastAppliedTemps = {};

    const mat = getRoomMaterial();
    const fragList = viewer.model.getFragmentList();
    const tree = viewer.model.getInstanceTree();

    foundRoomDbIds.forEach(dbId => {
      tree.enumNodeFragments(dbId, (fragId) => {
        fragList.setMaterial(fragId, mat);
      });
    });

    viewer.impl.invalidate(true, true, true);
  }


  // 显示所有温度标签
  roomTags.value.forEach(tag => {
    tag.visible = true;
  });

  updateAllTagPositions();
};

// 切换温度标签显示
const toggleTemperatureLabels = () => {
  areTagsVisible.value = !areTagsVisible.value;
  
  // 立即更新标签位置，使标签能够显示
  if (areTagsVisible.value && viewer) {
    nextTick(() => {
      updateAllTagPositions();
    });
  }
};

onUnmounted(() => { if (uiObserver) { uiObserver.disconnect(); uiObserver = null; } });

// 10. 应用热力图样式
const applyHeatmapStyle = () => {
  if (foundRoomDbIds.length === 0) return;

  let changed = false;
  foundRoomDbIds.forEach(dbId => {
    // 找到对应的房间标签获取温度
    const tag = roomTags.value.find(t => t.dbId === dbId);
    const temperature = tag ? parseFloat(tag.currentTemp) : 28; // 默认温度，确保是数字

    const prev = lastAppliedTemps[dbId];
    if (prev !== undefined && Math.abs(prev - temperature) < HEATMAP_EPS) {
      return;
    }

    // 计算热力图颜色
    const minT = 25, maxT = 35;
    let t = (temperature - minT) / (maxT - minT);
    t = Math.max(0, Math.min(1, t));

    // 从蓝色(冷)到红色(热)
    let hue = 200 - (t * 200); // 200(蓝) -> 0(红)

    // 转换 HSL 到 RGB
    const hslToRgb = (h, s, l) => {
      h = h / 360;
      s = s / 100;
      l = l / 100;
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    };

    const [r, g, b] = hslToRgb(hue, 100, 50);
    const color = new window.THREE.Vector4(r / 255, g / 255, b / 255, 0.8);

    // 使用 setThemingColor 而不是 setMaterial
    viewer.setThemingColor(dbId, color);
    lastAppliedTemps[dbId] = temperature;
    changed = true;
  });

  // 强制刷新渲染
  if (changed) viewer.impl.invalidate(false, false, false);
};

// 11. 获取房间属性
const getRoomProperties = async (dbId) => {
  if (!viewer) return null;

  return new Promise((resolve) => {
    viewer.getProperties(dbId, (result) => {
      const props = {
        code: '--',
        name: result.name || '--',
        area: '--',
        perimeter: '--',
        level: '--',
        spaceNumber: '',
        spaceDescription: ''
      };

      // 从属性中提取信息
      if (result.properties) {
        result.properties.forEach(prop => {
          const name = prop.displayName || prop.attributeName;
          const value = prop.displayValue;

          // 匹配编号
          if (name === '编号' || name === 'Number' || name === 'Mark') {
            props.code = value;
          }
          // 匹配面积
          else if (name === '面积' || name === 'Area') {
            props.area = value;
          }
          // 匹配周长
          else if (name === '周长' || name === 'Perimeter') {
            props.perimeter = value;
          }
          // 匹配标高
          else if (name === '标高' || name === 'Level') {
            props.level = value;
          }
          else if (name === 'Classification.Space.Number') {
            props.spaceNumber = value;
          }
          else if (name === 'Classification.Space.Description') {
            props.spaceDescription = value;
          }
        });
      }

      resolve(props);
    });
  });
};

// 手动触发 viewer resize
const resizeViewer = () => {
  if (viewer) {
    viewer.resize();
    updateAllTagPositions();
  }
};

// 资产相关方法
const isolateAndFocusAssets = (dbIds) => {
  if (!viewer || !dbIds || dbIds.length === 0) return;

  // 设置手动选择标志，防止 onSelectionChanged 干扰
  setManualSelection();

  viewer.isolate(dbIds);
  viewer.select(dbIds);
  
  // 获取选中对象的边界框
  const bounds = new window.THREE.Box3();
  const instanceTree = viewer.model.getInstanceTree();
  const fragList = viewer.model.getFragmentList();
  
  dbIds.forEach(dbId => {
    instanceTree.enumNodeFragments(dbId, (fragId) => {
      const box = new window.THREE.Box3();
      fragList.getWorldBounds(fragId, box);
      bounds.union(box);
    });
  });
  
  if (!bounds.isEmpty()) {
    const center = bounds.getCenter(new window.THREE.Vector3());
    const size = bounds.getSize(new window.THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // 计算相机位置：距离设置为边界框最大尺寸的 2 倍
    const distance = maxDim * 2;
    const camera = viewer.navigation.getCamera();
    const viewDir = camera.target.clone().sub(camera.position).normalize();
    
    // 新的相机位置和目标
    const newPosition = center.clone().sub(viewDir.multiplyScalar(distance));
    const newTarget = center;
    
    // 使用动画平滑移动相机
    const nav = viewer.navigation;
    const startPos = nav.getPosition().clone();
    const startTarget = nav.getTarget().clone();
    const duration = 800; // 动画持续时间（毫秒）
    const startTime = performance.now();
    
    // easing 函数：ease-in-out
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = ease(progress);
      
      // 插值计算当前位置和目标
      const currentPos = new window.THREE.Vector3(
        startPos.x + (newPosition.x - startPos.x) * eased,
        startPos.y + (newPosition.y - startPos.y) * eased,
        startPos.z + (newPosition.z - startPos.z) * eased
      );
      
      const currentTarget = new window.THREE.Vector3(
        startTarget.x + (newTarget.x - startTarget.x) * eased,
        startTarget.y + (newTarget.y - startTarget.y) * eased,
        startTarget.z + (newTarget.z - startTarget.z) * eased
      );
      
      // 设置相机位置
      nav.setView(currentPos, currentTarget);
      
      // 继续动画或结束
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
  
  viewer.impl.invalidate(true, true, true);
};

const showAllAssets = () => {
  if (!viewer) return;

  // 设置手动选择标志
  setManualSelection();

  // 优先使用从数据库传入的资产列表
  let dbIdsToShow = [];
  if (props.assets && props.assets.length > 0) {
    dbIdsToShow = props.assets.map(a => a.dbId).filter(Boolean);
  } else if (foundAssetDbIds.length > 0) {
    dbIdsToShow = foundAssetDbIds;
  }

  if (dbIdsToShow.length > 0) {
    viewer.isolate(dbIdsToShow);
  } else {
    console.log('⚠️ dbIdsToShow 为空，清除孤立');
    viewer.isolate([]);
  }

  // 清除选择
  viewer.clearSelection();

  viewer.impl.invalidate(true, true, true);
  animateToDefaultView();
};

const getAssetProperties = (dbId) => {
  return new Promise((resolve) => {
    if (!viewer) {
      resolve({
        name: '',
        mcCode: '',
        level: '',
        room: '',
        omniClass21Number: '',
        omniClass21Description: '',
        category: '',
        family: '',
        type: '',
        typeComments: '',
        manufacturer: ''
      });
      return;
    }

    viewer.getProperties(dbId, (result) => {
      const props = {
        name: result.name || '',
        mcCode: '',
        level: '',
        room: '',
        omniClass21Number: '',
        omniClass21Description: '',
        category: '',
        family: '',
        type: '',
        typeComments: '',
        manufacturer: ''
      };

      if (result && result.properties) {
        result.properties.forEach(prop => {
          const name = prop.displayName;
          const category = prop.displayCategory;
          const value = prop.displayValue || '';

          // 元素属性
          if (name === 'MC编码' || name === 'MC Code') {
            props.mcCode = value;
          }
          else if (name === '标高' || name === 'Level') {
            props.level = value;
          }
          // 关系属性 - 房间名称（在"房间"分组下的"名称"字段）
          else if ((category === '房间' || category === 'Room') && (name === '名称' || name === 'Name')) {
            props.room = value;
          }
          // 类型属性
          else if (name === 'Classification.OmniClass.21.Number') {
            props.omniClass21Number = value;
          }
          else if (name === 'Classification.OmniClass.21.Description') {
            props.omniClass21Description = value;
          }
          else if (name === '类别' || name === 'Category') {
            props.category = value;
          }
          else if (name === '族' || name === 'Family') {
            props.family = value;
          }
          else if (name === '类型' || name === 'Type') {
            props.type = value;
          }
          else if (name === '类型注释' || name === 'Type Comments') {
            props.typeComments = value;
          }
          else if (name === '制造商' || name === 'Manufacturer') {
            props.manufacturer = value;
          }
        });
      }

      resolve(props);
    });
  });
};

// 显示温度标签
const showTemperatureTags = () => {
  areTagsVisible.value = true;
  updateAllTagPositions();
};

// 隐藏温度标签
const hideTemperatureTags = () => {
  areTagsVisible.value = false;
};

// 获取完整的资产数据（用于导出到数据库）
const getFullAssetData = async () => {
  if (!viewer || !viewer.model) return [];

  const instanceTree = viewer.model.getInstanceTree();
  if (!instanceTree) return [];

  const allDbIds = [];
  instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
    allDbIds.push(dbId);
  }, true);

  const assets = [];

  // 逐个获取资产属性
  for (const dbId of allDbIds) {
    try {
      const props = await new Promise((resolve) => {
        viewer.getProperties(dbId, (result) => {
          if (!result || !result.properties) {
            resolve(null);
            return;
          }

          const assetData = {
            dbId,
            name: '',
            mcCode: '',
            floor: '',
            room: '',
            omniClass21Number: '',
            omniClass21Description: '',
            category: '',
            family: '',
            type: '',
            typeComments: '',
            manufacturer: '',
            address: '',
            phone: ''
          };

          // 先获取基本信息
          result.properties.forEach(prop => {
            const name = prop.displayName;
            const category = prop.displayCategory;
            const value = prop.displayValue || '';

            // 标识分组下的名称
            if ((category === '标识数据' || category === 'Identity Data') && (name === '名称' || name === 'Name')) {
              assetData.name = value;
            }
            // MC编码
            else if (name === 'MC编码' || name === 'MC Code') {
              assetData.mcCode = value;
            }
            // 楼层
            else if (name === '楼层' || name === 'Level') {
              assetData.floor = value;
            }
            // 房间分组下的名称
            else if ((category === '房间' || category === 'Room') && (name === '名称' || name === 'Name')) {
              assetData.room = value;
            }
            // OmniClass 21 编号
            else if (name === 'Classification.OmniClass.21.Number') {
              assetData.omniClass21Number = value;
            }
            // OmniClass 21 描述
            else if (name === 'Classification.OmniClass.21.Description') {
              assetData.omniClass21Description = value;
            }
            // 类别
            else if (name === '类别' || name === 'Category') {
              assetData.category = value;
            }
            // 族
            else if (name === '族' || name === 'Family') {
              assetData.family = value;
            }
            // 类型
            else if (name === '类型' || name === 'Type') {
              assetData.type = value;
            }
            // 类型注释（规格编码）
            else if (name === '类型注释' || name === 'Type Comments') {
              assetData.typeComments = value;
            }
            // 制造商
            else if (name === '制造商' || name === 'Manufacturer') {
              assetData.manufacturer = value;
            }
            // 地址
            else if (name === '地址' || name === 'Address') {
              assetData.address = value;
            }
            // 电话
            else if (name === '电话' || name === 'Phone') {
              assetData.phone = value;
            }
          });

          // 只添加有 MC编码 的构件
          if (assetData.mcCode) {
            resolve(assetData);
          } else {
            resolve(null);
          }
        });
      });

      if (props) {
        assets.push(props);
      }
    } catch (e) {
      console.error('获取资产属性失败:', e);
    }
  }

  console.log(`📊 已提取 ${assets.length} 个资产数据`);
  return assets;
};

// 获取完整的空间数据（用于导出到数据库）
const getFullSpaceData = async () => {
  if (!viewer || !viewer.model || foundRoomDbIds.length === 0) return [];

  const spaces = [];

  for (const dbId of foundRoomDbIds) {
    try {
      const props = await new Promise((resolve) => {
        viewer.getProperties(dbId, (result) => {
          if (!result || !result.properties) {
            resolve(null);
            return;
          }

          const spaceData = {
            dbId,
            spaceCode: '',
            name: result.name || '',
            classificationCode: '',
            classificationDesc: '',
            floor: '',
            area: '',
            perimeter: ''
          };

          result.properties.forEach(prop => {
            const name = prop.displayName || prop.attributeName;
            const value = prop.displayValue;

            // 空间编码（编号）
            if (name === '编号' || name === 'Number' || name === 'Mark') {
              spaceData.spaceCode = value;
            }
            // 名称
            else if (name === '名称' || name === 'Name') {
              if (!spaceData.name) spaceData.name = value;
            }
            // 分类编码
            else if (name === 'Classification.Space.Number') {
              spaceData.classificationCode = value;
            }
            // 分类描述
            else if (name === 'Classification.Space.Description') {
              spaceData.classificationDesc = value;
            }
            // 楼层（标高）
            else if (name === '标高' || name === 'Level') {
              spaceData.floor = value;
            }
            // 面积
            else if (name === '面积' || name === 'Area') {
              spaceData.area = value;
            }
            // 周长
            else if (name === '周长' || name === 'Perimeter') {
              spaceData.perimeter = value;
            }
          });

          // 只添加有编号的空间
          if (spaceData.spaceCode) {
            resolve(spaceData);
          } else {
            resolve(null);
          }
        });
      });

      if (props) {
        spaces.push(props);
      }
    } catch (e) {
      console.error('获取空间属性失败:', e);
    }
  }

  console.log(`📊 已提取 ${spaces.length} 个空间数据`);
  return spaces;
};

// 使用映射配置获取完整的资产数据（新版本，支持灵活映射）
const getFullAssetDataWithMapping = async (mappings) => {
  if (!viewer || !viewer.model) return [];

  const instanceTree = viewer.model.getInstanceTree();
  if (!instanceTree) return [];

  // 从单个参数对象中提取映射配置
  const assetMapping = mappings?.assetMapping;
  const assetSpecMapping = mappings?.assetSpecMapping;

  // 参数验证
  if (!assetMapping || !assetSpecMapping) {
    console.error('❌ 映射配置参数错误:', { assetMapping, assetSpecMapping });
    return [];
  }

  const allDbIds = [];
  instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
    allDbIds.push(dbId);
  }, true);

  console.log(`🔍 开始提取资产数据，共 ${allDbIds.length} 个构件`);

  // 合并映射配置（资产表 + 资产规格表的所有字段）
  const fullMapping = { ...assetMapping, ...assetSpecMapping };
  
  console.log('📋 合并后的映射配置字段:', Object.keys(fullMapping));
  console.log('   资产映射字段:', Object.keys(assetMapping));
  console.log('   规格映射字段:', Object.keys(assetSpecMapping));


  const tempTable = [];
  let firstAssetLogged = false;  // 标志：是否已打印第一个资产的属性

  // 逐个获取资产属性
  for (const dbId of allDbIds) {
    try {
      const row = await new Promise((resolve) => {
        viewer.getProperties(dbId, (result) => {
          if (!result || !result.properties) {
            resolve(null);
            return;
          }

          // 初始化临时行数据（包含所有字段）
          const rowData = { dbId };

          // 为每个映射字段初始化空值
          Object.keys(fullMapping).forEach(field => {
            rowData[field] = '';
          });

          // 遍历所有属性
          result.properties.forEach(prop => {
            const displayName = prop.displayName || '';
            const attributeName = prop.attributeName || '';
            const category = prop.displayCategory || '';
            const value = prop.displayValue || '';

            // 检查每个映射配置
            Object.entries(fullMapping).forEach(([field, mapping]) => {
              // 如果该字段已经有值且不是空字符串，跳过（防止被无关属性覆盖）
              if (rowData[field] && rowData[field] !== '') return;

              const targetCategory = mapping.category;
              const targetProperty = mapping.property;

              // 1. 优先尝试精确匹配（分类 + 属性名）
              const categoryMatch = category === targetCategory;
              const nameMatch = displayName === targetProperty || attributeName === targetProperty;
              
              if (categoryMatch && nameMatch) {
                rowData[field] = value;
                return;
              }

              // 2. 特殊属性（带点号）只匹配名称
              if (targetProperty.includes('.') && nameMatch) {
                rowData[field] = value;
                return;
              }

              // 3. 备用策略：如果只是分类不匹配但名称完全一致，也视为匹配
              // 这可以解决分类名称在不同版本 Revit 中可能不同的问题
              if (nameMatch) {
                 // 仅当属性名非常独特时才放宽分类限制，或者用户配置的分类是 '其他'
                 // 防止常见的 "名称" 属性混淆
                 if (targetCategory === '其他' || !['名称', 'Name'].includes(targetProperty)) {
                     rowData[field] = value;
                 }
              }
            });
          });

          // 4. 第二轮检查：对于 specCode，尝试从类型属性中查找
          // 很多时候 Type Comments 在 Type 属性集里，而不是 Instance
          if (!rowData['specCode'] && !rowData['typeComments']) {
               const typeParams = result.properties.find(p => 
                  p.displayName === '类型注释' || p.displayName === 'Type Comments' ||
                  p.attributeName === 'Type Comments');
               if (typeParams) {
                   if (fullMapping.specCode) rowData['specCode'] = typeParams.displayValue;
               }
          }


          // 调试：打印第一个有资产编码的构件的所有属性
          if (rowData.assetCode && !firstAssetLogged) {
            console.log(`\n📋 第一个有MC编码的构件 (dbId: ${dbId}) 的所有属性:`);
            const propsTable = result.properties.map(p => ({
              分类: p.displayCategory || '(无)',
              显示名: p.displayName || '(无)',
              属性名: p.attributeName || '(无)',
              值: p.displayValue || ''
            }));
            console.table(propsTable);
            firstAssetLogged = true;
          }

          // 只添加有资产编码的构件
          if (rowData.assetCode) {
            resolve(rowData);
          } else {
            resolve(null);
          }
        });
      });

      if (row) {
        tempTable.push(row);
      }
    } catch (e) {
      console.error('获取资产属性失败:', e);
    }
  }

  console.log(`✅ 提取完成: ${tempTable.length} 个资产（临时表）`);

  // 调试：打印前 3 条数据
  if (tempTable.length > 0) {
    console.log('📋 前3条资产数据示例:');
    console.table(tempTable.slice(0, 3));
  }

  return tempTable;
};

// 使用映射配置获取完整的空间数据（新版本，支持灵活映射）
const getFullSpaceDataWithMapping = async (spaceMapping) => {
  if (!viewer || !viewer.model || foundRoomDbIds.length === 0) {
    console.warn('⚠️ 没有找到房间数据或模型未加载');
    return [];
  }

  console.log(`🔍 开始提取空间数据，共 ${foundRoomDbIds.length} 个房间`);

  const spaces = [];

  // 为了调试，打印第一个房间的所有属性
  if (foundRoomDbIds.length > 0) {
    const firstDbId = foundRoomDbIds[0];
    await new Promise((resolve) => {
      viewer.getProperties(firstDbId, (result) => {
        if (result && result.properties) {
          console.log(`📋 第一个房间的前20个属性 (dbId: ${firstDbId}):`);
          const sample = result.properties.slice(0, 20).map(p => ({
            分类: p.displayCategory,
            名称: p.displayName,
            属性名: p.attributeName,
            值: p.displayValue
          }));
          console.table(sample);
        }
        resolve();
      });
    });
  }

  for (const dbId of foundRoomDbIds) {
    try {
      const spaceData = await new Promise((resolve) => {
        viewer.getProperties(dbId, (result) => {
          if (!result || !result.properties) {
            resolve(null);
            return;
          }

          // 初始化空间数据
          const data = { dbId };

          // 为每个映射字段初始化空值
          Object.keys(spaceMapping).forEach(field => {
            data[field] = '';
          });

          // 遍历所有属性
          result.properties.forEach(prop => {
            const displayName = prop.displayName || '';
            const attributeName = prop.attributeName || '';
            const category = prop.displayCategory || '';
            const value = prop.displayValue || '';

            // 检查每个映射配置
            Object.entries(spaceMapping).forEach(([field, mapping]) => {
              const targetCategory = mapping.category;
              const targetProperty = mapping.property;

              // 匹配逻辑：
              // 1. 对于包含点号的属性（如 Classification.Space.Number），只匹配属性名，忽略分类
              // 2. 对于普通属性，必须分类和属性名都匹配
              const nameMatch = displayName === targetProperty || attributeName === targetProperty;
              const isSpecialProperty = targetProperty.includes('.');  // 检测点号分隔的属性
              
              let shouldMatch = false;
              if (isSpecialProperty) {
                // 特殊属性只匹配名称
                shouldMatch = nameMatch;
              } else {
                // 普通属性需要分类和名称都匹配
                const categoryMatch = category === targetCategory;
                shouldMatch = categoryMatch && nameMatch;
              }

              if (shouldMatch) {
                data[field] = value;
              }
            });
          });

          // 添加名称（如果映射中没有找到，使用 result.name）
          if (!data.name && result.name) {
            data.name = result.name;
          }

          // 检查是否有 spaceCode
          if (data.spaceCode) {
            resolve(data);
          } else {
            console.warn(`⚠️ 房间 ${dbId} 没有找到空间编号，请检查 spaceMapping 配置。房间名称: ${data.name || result.name}`);
            // 使用默认值
            data.spaceCode = `SPACE_${dbId}`;
            resolve(data);
          }
        });
      });

      if (spaceData) {
        spaces.push(spaceData);
      }
    } catch (e) {
      console.error('获取空间属性失败:', e);
    }
  }

  console.log(`✅ 提取完成: ${spaces.length} 个空间`);

  // 调试：打印前 3 条数据
  if (spaces.length > 0) {
    console.log('📋 前3条空间数据示例:');
    console.table(spaces.slice(0, 3));
  }

  return spaces;
};

// 获取资产的所有可用属性结构（用于填充映射配置下拉框）
const getAssetPropertyList = async () => {
  if (!viewer || !viewer.model) return {};
  
  return new Promise((resolve) => {
    const tree = viewer.model.getInstanceTree();
    if (!tree) {
      resolve({});
      return;
    }
    
    const rootId = tree.getRootId();
    const dbIds = [];
    
    // 递归获取所有子节点，但排除根节点本身
    tree.enumNodeChildren(rootId, (dbId) => {
      // 只添加非根节点
      if (dbId !== rootId) {
        dbIds.push(dbId);
      }
    }, true);
    
    console.log(`📋 开始提取属性列表，构件总数: ${dbIds.length}（已排除根节点 ${rootId}）`);
    
    // 使用 getBulkProperties 获取所有属性
    viewer.model.getBulkProperties(dbIds, null, (results) => {
      console.log(`📋 getBulkProperties 返回结果数: ${results.length}`);
      
      const categories = {};
      const categoryStats = {};
      const rawPropertyNames = {}; // 记录原始属性名（调试用）
      
      // 统计每个构件的属性数量
      let totalProperties = 0;
      results.forEach(res => {
        if (res.properties) {
          totalProperties += res.properties.length;
        }
      });
      console.log(`📋 所有构件的属性总数: ${totalProperties}`);
      
      // 显示前3个构件的属性示例
      console.log('📋 前3个构件的属性示例:');
      results.slice(0, 3).forEach((res, idx) => {
        console.log(`  构件 ${idx + 1} (dbId: ${res.dbId}): ${res.properties?.length || 0} 个属性`);
        if (res.properties && res.properties.length > 0) {
          const samples = res.properties.slice(0, 5).map(p => `${p.displayName}(${p.displayCategory})`);
          console.log(`    示例: ${samples.join(', ')}`);
        }
      });
      
      results.forEach(res => {
        if (!res.properties) return;
        
        res.properties.forEach(prop => {
          // 原始分类名
          const originalCat = prop.displayCategory || '其他';
          
          // 统一处理分类名称（中英文映射）
          let cat = originalCat;
          
          // 英文 -> 中文映射
          const categoryMap = {
            'Identity Data': '标识数据',
            'Constraints': '约束',
            'Phasing': '阶段化',
            'Dimensions': '尺寸',
            'Construction': '构造',
            'Materials and Finishes': '材质和装饰',
            'Structural': '结构',
            'Mechanical': '机械',
            'Electrical': '电气',
            'Plumbing': '管道',
            'Fire Protection': '消防',
            'Text': '文字',
            'Graphics': '图形',
            'Data': '数据',
            'Other': '其他',
            'Room': '房间',
            'Analytical Properties': '分析属性',
            'Green Building Properties': '绿色建筑属性',
            'IFC Parameters': 'IFC参数',
            'Structural Analysis': '结构分析'
          };
          
          if (categoryMap[cat]) {
            cat = categoryMap[cat];
          }
          
          // 获取属性名
          let name = prop.displayName || prop.attributeName;
          
          // 排除无效名称
          if (!name || name.trim() === '') return;
          
          // 记录原始属性名（用于调试）
          if (!rawPropertyNames[cat]) {
            rawPropertyNames[cat] = [];
          }
          rawPropertyNames[cat].push({
            display: name,
            original: originalCat,
            attr: prop.attributeName
          });
          
          // 初始化分类
          if (!categories[cat]) {
            categories[cat] = new Set();
            categoryStats[cat] = 0;
          }
          
          // 添加属性名（使用Set自动去重）
          const added = !categories[cat].has(name);
          categories[cat].add(name);
          
          if (added) {
            categoryStats[cat]++;
          }
        });
      });
      
      // 转换为排序后的数组
      const formatted = {};
      const sortedCategories = Object.keys(categories).sort();
      
      sortedCategories.forEach(cat => {
        formatted[cat] = Array.from(categories[cat]).sort();
      });
      
      // 详细的调试日志
      console.log(`📋 已提取资产属性结构: ${sortedCategories.length} 个分类`);
      console.log('📋 分类统计:');
      sortedCategories.forEach(cat => {
        console.log(`  - ${cat}: ${categoryStats[cat]} 个属性`);
      });
      
      // 输出每个分类的所有属性（不只是前5个）
      console.log('📋 完整属性列表:');
      sortedCategories.forEach(cat => {
        console.log(`  ${cat}:`, formatted[cat]);
      });
      
      // 特别显示"标识数据"分类的原始信息
      if (rawPropertyNames['标识数据']) {
        console.log('📋 "标识数据"分类的原始属性信息（前20个）:');
        rawPropertyNames['标识数据'].slice(0, 20).forEach(prop => {
          console.log(`    ${prop.display} [原始分类: ${prop.original}, 属性名: ${prop.attr}]`);
        });
      }
      
      resolve(formatted);
    }, (err) => {
      console.error('获取属性列表失败:', err);
      resolve({});
    });
  });
};

// 获取空间的所有可用属性结构
const getSpacePropertyList = async () => {
  if (!viewer || !viewer.model || foundRoomDbIds.length === 0) return {};

  return new Promise((resolve) => {
    console.log(`📋 开始提取空间属性列表，房间总数: ${foundRoomDbIds.length}`);
    
    // 仅针对房间 ID 获取
    viewer.model.getBulkProperties(foundRoomDbIds, null, (results) => {
      const categories = {};
      const categoryStats = {};
      
      results.forEach(res => {
        if (!res.properties) return;
        
        res.properties.forEach(prop => {
          const originalCat = prop.displayCategory || '其他';
          
          // 使用相同的映射逻辑
          let cat = originalCat;
          const categoryMap = {
            'Identity Data': '标识数据',
            'Constraints': '约束',
            'Phasing': '阶段化',
            'Dimensions': '尺寸',
            'Construction': '构造',
            'Materials and Finishes': '材质和装饰',
            'Structural': '结构',
            'Mechanical': '机械',
            'Electrical': '电气',
            'Plumbing': '管道',
            'Text': '文字',
            'Graphics': '图形',
            'Data': '数据',
            'Other': '其他',
            'Room': '房间',
            'Analytical Properties': '分析属性',
            'IFC Parameters': 'IFC参数'
          };
          
          if (categoryMap[cat]) {
            cat = categoryMap[cat];
          }
          
          let name = prop.displayName || prop.attributeName;
          
          if (!name || name.trim() === '') return;
          
          if (!categories[cat]) {
            categories[cat] = new Set();
            categoryStats[cat] = 0;
          }
          
          const added = !categories[cat].has(name);
          categories[cat].add(name);
          
          if (added) {
            categoryStats[cat]++;
          }
        });
      });
      
      const formatted = {};
      const sortedCategories = Object.keys(categories).sort();
      
      sortedCategories.forEach(cat => {
        formatted[cat] = Array.from(categories[cat]).sort();
      });
      
      // 详细的调试日志
      console.log(`📋 已提取空间属性结构: ${sortedCategories.length} 个分类`);
      console.log('📋 分类统计:');
      sortedCategories.forEach(cat => {
        console.log(`  - ${cat}: ${categoryStats[cat]} 个属性`);
      });
      
      console.log('📋 示例属性:');
      sortedCategories.slice(0, 5).forEach(cat => {
        const props = formatted[cat].slice(0, 5);
        console.log(`  ${cat}: ${props.join(', ')}${formatted[cat].length > 5 ? '...' : ''}`);
      });
      
      resolve(formatted);
    }, (err) => {
      console.error('获取空间属性列表失败:', err);
      resolve({});
    });
  });
};

// 暴露方法给父组件
defineExpose({
  isolateAndFocusRooms,
  showAllRooms,
  getRoomProperties,
  resizeViewer,
  isolateAndFocusAssets,
  showAllAssets,
  getAssetProperties,
  showTemperatureTags,
  hideTemperatureTags,
  syncTimelineHover,
  getFullAssetData,
  getFullSpaceData,
  getFullAssetDataWithMapping,
  getFullSpaceDataWithMapping,
  getAssetPropertyList,
  getSpacePropertyList,
  getTimeRange: () => ({ startMs: startDate.value.getTime(), endMs: endDate.value.getTime(), windowMs: Math.max(60_000, Math.round((endDate.value.getTime()-startDate.value.getTime())/300)) }),
  setSelectedRooms: async (codes) => {
    if (!isInfluxConfigured() || !codes?.length) {
      overlaySeries.value = [];
      await refreshRoomSeriesCache().catch(() => {});
      setTagTempsAtCurrentTime();
      return;
    }
    const start = startDate.value.getTime();
    const end = endDate.value.getTime();
    const windowMs = Math.max(60_000, Math.round((end - start)/300));
    const promises = codes.map(c => queryRoomSeries(c, start, end, windowMs));
    const list = await Promise.all(promises);
    overlaySeries.value = list;
    selectedRoomCodes.value = codes.slice();
    await refreshRoomSeriesCache(codes).catch(() => {});
    setTagTempsAtCurrentTime();
  },
  loadNewModel // 暴露方法
});

// ================== 4. 辅助逻辑 (Timeline/Chart/Event) ==================

const emitRangeChanged = () => { const s = startDate.value.getTime(), e = endDate.value.getTime(); const w = Math.max(60_000, Math.round((e - s) / 300)); emit('time-range-changed', { startMs: s, endMs: e, windowMs: w }); };
const panTimeline = (d) => { const s = startDate.value.getTime(), e = endDate.value.getTime(), off = d * ((e - s) / 3); startDate.value = new Date(s + off); endDate.value = new Date(e + off); emitRangeChanged(); };
function syncTimelineHover(time, percent) { const s = startDate.value.getTime(), e = endDate.value.getTime(); if (typeof percent === 'number') { progress.value = Math.max(0, Math.min(100, percent * 100)); return; } if (time && e > s) { const p = Math.max(0, Math.min(100, ((time - s) / (e - s)) * 100)); progress.value = p; } }
const toggleTimeRangeMenu = () => isTimeRangeMenuOpen.value = !isTimeRangeMenuOpen.value;
const selectTimeRange = (o) => { selectedTimeRange.value = o; isTimeRangeMenuOpen.value = false; const now = new Date(); let ms = { '24h': 864e5, '3d': 3*864e5, '7d': 7*864e5, '30d': 30*864e5 }[o.value] || 0; endDate.value = now; startDate.value = new Date(now - ms); progress.value = 100; emitRangeChanged(); refreshRoomSeriesCache().catch(() => {}); };
const changeMonth = (d) => calendarViewDate.value = new Date(calendarViewDate.value.setMonth(calendarViewDate.value.getMonth() + d));
const isSameDay = (d1, d2) => d1 && d2 && d1.toDateString() === d2.toDateString();
const isDaySelected = (d) => isSameDay(d, tempStart.value) || isSameDay(d, tempEnd.value);
const isDayInRange = (d) => d && tempStart.value && tempEnd.value && d > tempStart.value && d < tempEnd.value;
const handleDayClick = (d) => { if (!d.date) return; if (!tempStart.value || (tempStart.value && tempEnd.value)) { tempStart.value = d.date; tempEnd.value = null; } else { if (d.date < tempStart.value) { tempEnd.value = tempStart.value; tempStart.value = d.date; } else tempEnd.value = d.date; } };
const formatDate = (d) => d ? d.toLocaleDateString() : '';
const openCustomRangeModal = () => { isTimeRangeMenuOpen.value = false; selectedTimeRange.value = { label: '', value: 'custom' }; tempStart.value = new Date(startDate.value); tempEnd.value = new Date(endDate.value); calendarViewDate.value = new Date(startDate.value); isCustomModalOpen.value = true; };
const closeCustomModal = () => isCustomModalOpen.value = false;
const applyCustomRange = () => { if (tempStart.value && tempEnd.value) { startDate.value = new Date(tempStart.value); endDate.value = new Date(tempEnd.value); endDate.value.setHours(23,59,59); progress.value = 100; isCustomModalOpen.value = false; emitRangeChanged(); refreshRoomSeriesCache().catch(() => {}); } };
const zoomIn = () => { const d = endDate.value.getTime() - startDate.value.getTime(); startDate.value = new Date(endDate.value.getTime() - d / 1.5); emitRangeChanged(); refreshRoomSeriesCache().catch(() => {}); };
const zoomOut = () => { const d = endDate.value.getTime() - startDate.value.getTime(); startDate.value = new Date(endDate.value.getTime() - d * 1.5); emitRangeChanged(); refreshRoomSeriesCache().catch(() => {}); };
let fId;
const animate = () => { if(!isPlaying.value) return; const step=0.05*playbackSpeed.value; if(progress.value+step>=100) { if(isLooping.value) progress.value=0; else {progress.value=100; isPlaying.value=false;} } else progress.value+=step; fId=requestAnimationFrame(animate); };
const togglePlay = async () => { isPlaying.value=!isPlaying.value; if(isPlaying.value) { if(progress.value>=100) progress.value=0; await refreshRoomSeriesCache(selectedRoomCodes.value).catch(()=>{}); animate(); } else cancelAnimationFrame(fId); };
const cycleSpeed = () => { const s=[1,2,4,8]; playbackSpeed.value=s[(s.indexOf(playbackSpeed.value)+1)%4]; };
const goLive = () => { progress.value=100; isPlaying.value=false; };
const startDrag = (e) => { isDragging.value=true; isPlaying.value=false; updateP(e); window.addEventListener('mousemove',onDrag); window.addEventListener('mouseup',stopDrag); };
const onDrag = (e) => isDragging.value && updateP(e);
const stopDrag = () => { isDragging.value=false; window.removeEventListener('mousemove',onDrag); window.removeEventListener('mouseup',stopDrag); };
const updateP = (e) => { if(!trackRef.value)return; const r=trackRef.value.getBoundingClientRect(); progress.value=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)); emitRangeChanged(); };
const openTimeline = () => isTimelineOpen.value=true;
const closeTimeline = () => { isTimelineOpen.value=false; isPlaying.value=false; };
const handleClickOutside = (e) => { if(dropdownRef.value && !dropdownRef.value.contains(e.target)) isTimeRangeMenuOpen.value=false; };
watch(isTimelineOpen, (newVal) => { setTimeout(() => { if(viewer) { viewer.resize(); updateAllTagPositions(); } }, 300); });
watch([startDate, endDate], () => { loadChartData(); });
let seeded = false;
const seedRoomHistory = async (rooms) => {
  if (!isInfluxConfigured() || seeded) return;
  const now = Date.now();
  const start = now - 30 * 24 * 60 * 60 * 1000;
  const every = 15 * 60 * 1000;
  for (const r of rooms) {
    const nm = r.name || '';
    const isExcluded = /泵房|格栅机间/.test(nm);
    const isRest = /休息室/.test(nm);
    if (isExcluded) continue;
    const points = [];
    for (let t = start; t <= now; t += every) {
      let v = computeValue(t);
      if (isRest) v = Math.max(23, Math.min(28, v - (1 + Math.random())));
      points.push({ timestamp: t, value: v });
    }
      try { await writeRoomHistory(r.code, points); } catch {}
  }
  seeded = true;
};

// 监听语言切换，更新 Viewer 语言
// 注意：Forge Viewer 的语言切换需要重新初始化，所以我们提示用户刷新页面
watch(locale, (newLocale, oldLocale) => {
  if (oldLocale && newLocale !== oldLocale && viewer) {
    console.log(`🌐 语言已切换: ${oldLocale} → ${newLocale}`);
    console.log('💡 建议刷新页面以应用 3D 查看器的语言设置');
    
    // 可选：自动刷新页面（如果需要）
    // window.location.reload();
  }
});

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  nextTick(() => initViewer());
  loadChartData();
  setTimeout(() => {
    if (isInfluxConfigured()) {
      const codes = roomTags.value.map(t => t.code).filter(Boolean);
      if (codes.length) {
        refreshRoomSeriesCache(codes).catch(() => {});
        queryLatestByRooms(codes, 60 * 60 * 1000).then(map => {
          roomTags.value.forEach(tag => {
            const v = map[tag.code];
            if (v !== undefined) tag.currentTemp = v.toFixed(1);
          });
        }).catch(() => {});
      }
    }
  }, 1500);
});
onUnmounted(() => { cancelAnimationFrame(fId); document.removeEventListener('click', handleClickOutside); window.removeEventListener('mousemove',onDrag); window.removeEventListener('mouseup',stopDrag); if(viewer) { viewer.finish(); viewer=null; } });
</script>

<style scoped>
/* 样式保持不变 */
.viewport-container { width: 100%; height: 100%; position: relative; background: #222; overflow: hidden; display: flex; flex-direction: column; }
.top-navigation-area { z-index: 100; transition: all 0.2s ease; }
.top-navigation-area.floating { position: absolute; top: 12px; left: 12px; }
.top-navigation-area.docked { position: relative; width: 100%; background: #202020; border-bottom: 1px solid #000; }
.time-pill { background: rgba(43, 43, 43, 0.5); backdrop-filter: blur(5px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; display: flex; align-items: center; height: 38px; cursor: pointer; color: #fff; user-select: none; transition: background 0.2s ease, box-shadow 0.2s ease; }
.time-pill:hover { background: #252526; border-color: rgba(255, 255, 255, 0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
.expand-action { width: 36px; display: flex; justify-content: center; color: #ddd; }
.divider { width: 1px; height: 20px; background: rgba(255,255,255,0.2); }
.pill-content { padding: 0 12px; display: flex; align-items: center; gap: 8px; font-family: 'Segoe UI', sans-serif; }
.date-text { font-size: 13px; font-weight: 500; }
.time-text { font-size: 13px; opacity: 0.9; }
.live-status-box { padding: 0 8px; }
.live-btn { border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; padding: 2px 8px; font-size: 12px; display: flex; align-items: center; gap: 6px; }
.live-btn.active .dot { animation: pulse 1.5s infinite; color: #ff4dcb; }
.live-btn .dot { color: #666; }
.timeline-dock { width: 100%; height: 108px; display: flex; flex-direction: column; background: #202020; color: #ccc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.timeline-toolbar { height: 44px; display: flex; justify-content: space-between; align-items: center; padding: 0 8px; background: #202020; user-select: none; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; height: 100%; }
.toolbar-right { gap: 12px; padding-right: 8px; }
.time-range-wrapper { position: relative; }
.tool-btn { background: transparent; border: none; color: #aaa; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer; }
.tool-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.divider-v { width: 1px; height: 20px; background: #444; margin: 0 8px; }
.current-info { display: flex; align-items: center; gap: 8px; margin-left: 4px; color: #eee; font-size: 13px; }
.info-text strong { font-weight: 600; color: #fff; }
.live-indicator { margin-left: 16px; border: 1px solid #444; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; color: #aaa; background: #333; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.live-indicator.active { color: #fff; border-color: #ff4dcb; }
.live-indicator.active .dot { color: #ff4dcb; animation: pulse 1.5s infinite; }
.dropdown-trigger { font-size: 12px; color: #ccc; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; }
.dropdown-trigger:hover { background: rgba(255,255,255,0.1); color: #fff; }
.arrow { font-size: 10px; transition: transform 0.2s; }
.arrow.rotated { transform: rotate(180deg); }
.control-group { display: flex; align-items: center; gap: 4px; }
.circle-btn { width: 20px; height: 20px; border-radius: 50%; border: 1px solid #666; background: transparent; color: #ccc; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.circle-btn:hover { border-color: #999; color: #fff; }
.icon-btn-lg { width: 28px; height: 28px; background: transparent; border: none; color: #aaa; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.icon-btn-lg:hover { color: #fff; }
.active-blue { color: #2196f3; }
.speed-box { background: #333; border: 1px solid #555; border-radius: 3px; width: 24px; text-align: center; font-size: 11px; cursor: pointer; line-height: 18px; color: #ccc; }
.timeline-track-row { flex: 1; display: flex; background: #1a1a1a; border-top: 1px solid #333; position: relative; height: 64px; }
.nav-arrow { width: 24px; background: #252526; border: none; border-right: 1px solid #333; border-left: 1px solid #333; color: #888; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 5; }
.nav-arrow:hover { color: #fff; background: #333; }
.track-container { flex: 1; position: relative; overflow: hidden; background: #1e1e1e; cursor: pointer; }
.ticks-layer { position: absolute; top: 0; bottom: 0; width: 100%; pointer-events: none; z-index: 5; }
.tick { position: absolute; bottom: 24px; height: 10px; border-left: 1px solid #444; }
.tick.major { height: 16px; border-left: 1px solid #666; }
.tick span { position: absolute; top: 20px; left: -50%; transform: translateX(-2px); font-size: 10px; color: #777; white-space: nowrap; }
.tick.text-white span { color: #fff; font-weight: 500; }
.mini-chart-layer { position: absolute; top: 12px; bottom: 24px; left: 0; right: 0; pointer-events: none; z-index: 1; }
.svg-mini { width: 100%; height: 100%; }
.data-layer { position: absolute; top: 12px; bottom: 24px; left: 0; right: 0; pointer-events: none; z-index: 2; }
.bar { position: absolute; height: 60%; top: 20%; border-radius: 1px; opacity: 0.8; }
.bar.teal { background: #26a69a; z-index: 2; height: 10px; top: 0; }
.bar.brown { background: #795548; z-index: 1; height: 20px; top: 10px; }
.scrubber { position: absolute; top: 0; bottom: 0; width: 16px; transform: translateX(-50%); pointer-events: none; z-index: 20; transition: left 0.1s linear; }
.scrubber .line { position: absolute; left: 50%; top: 6px; bottom: 0; width: 2px; background: #2196f3; transform: translateX(-50%); z-index: 1; }
.scrubber .head { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #2196f3; z-index: 2; }
.dropdown-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; width: 160px; background: #2b2b2b; border: 1px solid #444; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 200; padding: 4px 0; }
.menu-item { padding: 6px 12px; font-size: 12px; color: #ccc; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.menu-item:hover { background: #3e3e3e; color: #fff; }
.menu-item.active { color: #2196f3; font-weight: 500; }
.check-icon { color: #2196f3; }
.menu-divider { height: 1px; background: #444; margin: 4px 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 300; backdrop-filter: blur(2px); }
.custom-modal { background: #2b2b2b; border: 1px solid #3e3e3e; border-radius: 6px; width: 300px; box-shadow: 0 20px 50px rgba(0,0,0,0.7); color: #fff; font-family: 'Segoe UI', sans-serif; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid #3e3e3e; font-weight: 600; font-size: 13px; background: #252526; border-radius: 6px 6px 0 0; }
.close-btn { background: none; border: none; color: #aaa; font-size: 18px; cursor: pointer; }
.close-btn:hover { color: #fff; }
.calendar-widget { padding: 12px; }
.cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.cal-header button { background: transparent; border: 1px solid #444; color: #ccc; border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 10px; }
.cal-header button:hover { border-color: #777; color: #fff; }
.cal-header span { font-size: 13px; font-weight: 600; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; margin-bottom: 12px; }
.cal-day-name { font-size: 10px; color: #777; padding-bottom: 4px; }
.cal-day { font-size: 12px; padding: 6px; border-radius: 4px; cursor: pointer; color: #ddd; }
.cal-day:hover { background: #3e3e3e; }
.cal-day.empty { cursor: default; pointer-events: none; }
.cal-day.selected { background: #0078d4; color: #fff; font-weight: bold; }
.cal-day.in-range { background: rgba(0, 120, 212, 0.3); color: #fff; }
.range-preview { display: flex; justify-content: space-between; align-items: center; background: #1e1e1e; padding: 8px; border-radius: 4px; border: 1px solid #333; margin-top: 8px; }
.preview-box { display: flex; flex-direction: column; gap: 2px; }
.preview-box label { font-size: 10px; color: #777; }
.preview-box span { font-size: 12px; color: #fff; font-weight: 500; }
.preview-box span.placeholder { color: #555; font-style: italic; }
.range-preview .arrow { color: #555; }
.modal-footer { padding: 10px 16px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #3e3e3e; background: #252526; border-radius: 0 0 6px 6px; }
.btn-cancel { background: transparent; border: 1px solid #555; color: #ccc; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-cancel:hover { border-color: #777; color: #fff; }
.btn-apply { background: #0078d4; border: none; color: #fff; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; }
.btn-apply:hover { background: #106ebe; }
.btn-apply:disabled { background: #333; color: #777; cursor: not-allowed; }
.canvas-3d { flex: 1; position: relative; display: block; min-height: 0; background: #111; }
#forgeViewer { width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 0; }
:deep(.adsk-viewing-viewer) { background: #111; }
.overlay-tags { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
.tag-wrapper { position: absolute; transform: translate(-50%, -100%); margin-top: -10px; pointer-events: none; }
.tag-pin { position: relative; }
.pin-val { background: rgba(30,30,30,0.8); backdrop-filter: blur(4px); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 1px solid #555; white-space: nowrap; }
.pin-val.blue { background: #0078d4; border-color: #005a9e; font-weight: bold; }
.pin-val.alert-bg { background: #ff4d4d; border-color: #d32f2f; font-weight: bold; }
.temperature-label-btn {
  position: absolute;
  bottom: 60px;
  left: 20px;
  min-width: 120px;
  background: #333;
  color: #fff;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  border: 1px solid #555;
  user-select: none;
}
.temperature-label-btn:hover {
  background: #444;
  border-color: #666;
}
.temperature-label-btn.active {
  background: #0078d4;
  border-color: #005a9e;
  box-shadow: 0 0 10px rgba(0, 120, 212, 0.5);
}
.temperature-label-btn.active:hover {
  background: #006cbd;
}
.heatmap-btn {
  position: absolute;
  bottom: 20px;
  left: 20px;
  min-width: 120px;
  background: #333;
  color: #fff;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  border: 1px solid #555;
  user-select: none;
}
.heatmap-btn:hover {
  background: #444;
  border-color: #666;
}
.heatmap-btn.active {
  background: #0078d4;
  border-color: #005a9e;
  box-shadow: 0 0 10px rgba(0, 120, 212, 0.5);
}
.heatmap-btn.active:hover {
  background: #006cbd;
}
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
</style>
// 叠加曲线颜色与默认一致：按阈值渐变
