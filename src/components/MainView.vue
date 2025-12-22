<template>
  <div class="viewport-container">
    
    <!-- 时间线控制组件 -->
    <TimelineControl
      :is-open="isTimelineOpen"
      :is-live="isLive"
      :is-playing="isPlaying"
      :is-looping="isLooping"
      :playback-speed="playbackSpeed"
      :current-date-str="currentDateStr"
      :current-time-str="currentTimeStr"
      :selected-time-range="selectedTimeRange.value"
      :selected-time-range-label="selectedTimeRangeLabel"
      :time-options="timeOptions"
      :progress="progress"
      :ticks="generatedTicks"
      :area-path="miniAreaPath"
      :line-path="miniLinePath"
      :overlay-paths="miniOverlayPaths"
      @open="openTimeline"
      @close="closeTimeline"
      @go-live="goLive"
      @toggle-play="togglePlay"
      @toggle-loop="isLooping = !isLooping"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @pan="panTimeline"
      @cycle-speed="cycleSpeed"
      @select-time-range="selectTimeRange"
      @open-custom-modal="openCustomRangeModal"
      @update:progress="onProgressUpdate"
      @scrub-start="onScrubStart"
      @scrub-end="onScrubEnd"
    />
    
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
      
      <!-- IoT 数据标签覆盖层 -->
      <OverlayTags
        :tags="roomTags"
        :visible="areTagsVisible && !isSettingsPanelOpen"
      />


      <!-- 控制按钮已集成到 Viewer 工具栏 -->
    </div>

    <!-- AI 分析结果弹窗 -->
    <AIAnalysisModal
      :visible="showAIAnalysisModal"
      :loading="aiAnalysisLoading"
      :severity="aiAnalysisData.severity"
      :room-name="aiAnalysisData.roomName"
      :temperature="aiAnalysisData.temperature"
      :analysis="aiAnalysisData.analysis"
      @close="closeAIAnalysisModal"
      @acknowledge="acknowledgeAlert"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, reactive } from 'vue';
import { isInfluxConfigured, queryAverageSeries, queryLatestByRooms, queryRoomSeries } from '../services/influx';
import { triggerTemperatureAlert } from '../services/ai-analysis';
import { useI18n } from 'vue-i18n';
import OverlayTags from './viewer/OverlayTags.vue';
import AIAnalysisModal from './viewer/AIAnalysisModal.vue';
import TimelineControl from './viewer/TimelineControl.vue';
import ViewerControls from './viewer/ViewerControls.vue';
import { useHeatmap } from '../composables/useHeatmap';
import { useDataExport } from '../composables/useDataExport';
import { useViewState } from '../composables/useViewState';

const { t, locale } = useI18n();

// 定义 props
const props = defineProps({
  currentView: { type: String, default: 'connect' },
  assets: { type: Array, default: () => [] }, // 从数据库加载的资产列表
  rooms: { type: Array, default: () => [] },   // 从数据库加载的空间列表
  isAIEnabled: { type: Boolean, default: true } // AI 分析功能开关
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

// 初始化热力图 Composable
const heatmap = useHeatmap({ opacity: 0.8, changeThreshold: 0.3, debounceDelay: 400 });
const isHeatmapEnabled = heatmap.isEnabled; // 保持向后兼容

// AI 分析弹窗状态
const showAIAnalysisModal = ref(false);
const aiAnalysisLoading = ref(false);
const aiAnalysisData = ref({
  roomCode: '',
  roomName: '',
  temperature: 0,
  threshold: 28,
  severity: 'warning',
  analysis: ''
});

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

// 初始化数据导出 Composable
const dataExport = useDataExport(
  () => viewer,
  () => foundRoomDbIds
);

// 初始化视图状态 Composable
const viewState = useViewState({
  getViewer: () => viewer,
  isHeatmapEnabled,
  areTagsVisible,
  heatmap
});

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
const startDate = ref(new Date(MOCK_NOW.getTime() - 24 * 60 * 60 * 1000)); // 默认24小时 

// Dropdown & Modal 状态
const isTimeRangeMenuOpen = ref(false);
const dropdownRef = ref(null);
const selectedTimeRange = ref({ label: '', value: '24h' }); // 默认24小时
const isCustomModalOpen = ref(false);
const calendarViewDate = ref(new Date());
const tempStart = ref(null);
const tempEnd = ref(null);

// ================== 2. 计算属性 (Computed) ==================

// 时间范围选项（支持多语言）
const timeOptions = computed(() => [
  { label: t('timeline.1h'), value: '1h' },
  { label: t('timeline.3h'), value: '3h' },
  { label: t('timeline.6h'), value: '6h' },
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

// 图表数据从 InfluxDB 拉取（不使用本地模拟）
const chartData = ref([]);
const overlaySeries = ref([]);
const isCacheReady = ref(false);
let heatmapTimer = null;
let uiObserver = null;
const selectedRoomCodes = ref([]);
let roomSeriesCache = {};
let roomSeriesRange = { startMs: 0, endMs: 0, windowMs: 0 };




// 从 InfluxDB 加载图表数据
const loadChartData = async () => {
  const start = startDate.value.getTime();
  const end = endDate.value.getTime();
  const windowMs = Math.max(60_000, Math.round((end - start) / 300));
  console.log(`  📈 加载图表数据: ${new Date(start).toLocaleTimeString()} - ${new Date(end).toLocaleTimeString()}`);
  if (isInfluxConfigured()) {
    try {
      const pts = await queryAverageSeries(start, end, windowMs);
      chartData.value = pts || [];
      console.log(`  📈 图表数据已更新: ${chartData.value.length} 个点`);
    } catch (err) {
      console.warn('⚠️ 从 InfluxDB 加载图表数据失败:', err);
      chartData.value = [];
    }
  } else {
    console.warn('⚠️ InfluxDB 未配置，无法加载图表数据');
    chartData.value = [];
  }
};

const refreshRoomSeriesCache = async (codes) => {
  isCacheReady.value = false;
  if (!isInfluxConfigured()) { roomSeriesCache = {}; overlaySeries.value = []; isCacheReady.value = true; return; }
  const start = startDate.value.getTime();
  const end = endDate.value.getTime();
  const windowMs = 0; // 不聚合，显示原始数据点
  roomSeriesRange = { startMs: start, endMs: end, windowMs };
  const targetCodes = (codes && codes.length ? codes : roomTags.value.map(t => t.code).filter(Boolean));
  const list = await Promise.all(targetCodes.map(c => queryRoomSeries(c, start, end, windowMs).then(pts => ({ code: c, pts })).catch(() => ({ code: c, pts: [] }))));
  const cache = {};
  list.forEach(({ code, pts }) => { cache[code] = pts || []; });
  roomSeriesCache = cache;
  
  // 更新 overlaySeries（用于下方图表显示）
  if (selectedRoomCodes.value.length > 0) {
    overlaySeries.value = selectedRoomCodes.value.map(code => roomSeriesCache[code] || []);
    console.log(`  📊 图表覆盖层已更新: ${overlaySeries.value.length} 个房间`);
  }
  
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
      if (v !== undefined) {
        const newTemp = Number(v).toFixed(1);
        const prevTemp = parseFloat(tag.currentTemp) || 20; // 默认20度作为正常值
        tag.currentTemp = newTemp;
        
        // 温度阈值
        const HIGH_THRESHOLD = 28;
        const LOW_THRESHOLD = 0;
        const tempValue = parseFloat(newTemp);
        
        // 高温报警：当温度超过28度时触发AI分析
        if (props.isAIEnabled && tempValue > HIGH_THRESHOLD && prevTemp <= HIGH_THRESHOLD && !tag._highAlertTriggered) {
          tag._highAlertTriggered = true;
          console.log(`🔥 高温报警: ${tag.code} (${tag.name || '未命名'}) 温度 ${newTemp}°C 超过阈值 ${HIGH_THRESHOLD}°C`);
          
          // 设置弹窗初始数据并显示加载状态
          aiAnalysisData.value = {
            roomCode: tag.code,
            roomName: tag.name || tag.code,
            temperature: tempValue,
            threshold: HIGH_THRESHOLD,
            severity: tempValue >= HIGH_THRESHOLD + 5 ? 'critical' : 'warning',
            analysis: ''
          };
          aiAnalysisLoading.value = true;
          showAIAnalysisModal.value = true;
          
          // 异步调用 n8n AI 分析工作流
          triggerTemperatureAlert({
            roomCode: tag.code,
            roomName: tag.name || tag.code,
            temperature: tempValue,
            threshold: HIGH_THRESHOLD,
            alertType: 'high',
          }).then(result => {
            aiAnalysisLoading.value = false;
            if (result.success && result.analysis) {
              console.log(`✅ AI 分析结果:`, result.analysis.substring(0, 200) + '...');
              aiAnalysisData.value.analysis = result.analysis;
            } else {
              console.warn(`⚠️ AI 分析失败:`, result.error);
              aiAnalysisData.value.analysis = `分析失败: ${result.error || '未知错误'}`;
            }
          }).catch(err => {
            aiAnalysisLoading.value = false;
            console.error(`❌ AI 分析异常:`, err);
            aiAnalysisData.value.analysis = `分析异常: ${err.message || '网络错误'}`;
          });
        }
        
        // 低温报警：当温度低于10度时触发AI分析
        if (props.isAIEnabled && tempValue < LOW_THRESHOLD && prevTemp >= LOW_THRESHOLD && !tag._lowAlertTriggered) {
          tag._lowAlertTriggered = true;
          console.log(`❄️ 低温报警: ${tag.code} (${tag.name || '未命名'}) 温度 ${newTemp}°C 低于阈值 ${LOW_THRESHOLD}°C`);
          
          // 设置弹窗初始数据并显示加载状态
          aiAnalysisData.value = {
            roomCode: tag.code,
            roomName: tag.name || tag.code,
            temperature: tempValue,
            threshold: LOW_THRESHOLD,
            severity: tempValue <= LOW_THRESHOLD - 5 ? 'critical' : 'warning',
            analysis: ''
          };
          aiAnalysisLoading.value = true;
          showAIAnalysisModal.value = true;
          
          // 异步调用 n8n AI 分析工作流（低温报警）
          triggerTemperatureAlert({
            roomCode: tag.code,
            roomName: tag.name || tag.code,
            temperature: tempValue,
            threshold: LOW_THRESHOLD,
            alertType: 'low',
          }).then(result => {
            aiAnalysisLoading.value = false;
            if (result.success && result.analysis) {
              console.log(`✅ AI 分析结果:`, result.analysis.substring(0, 200) + '...');
              aiAnalysisData.value.analysis = result.analysis;
            } else {
              console.warn(`⚠️ AI 分析失败:`, result.error);
              aiAnalysisData.value.analysis = `分析失败: ${result.error || '未知错误'}`;
            }
          }).catch(err => {
            aiAnalysisLoading.value = false;
            console.error(`❌ AI 分析异常:`, err);
            aiAnalysisData.value.analysis = `分析异常: ${err.message || '网络错误'}`;
          });
        }
        
        // 温度恢复正常时重置报警标志
        if (tempValue <= HIGH_THRESHOLD && tag._highAlertTriggered) {
          tag._highAlertTriggered = false;
          console.log(`✅ 温度恢复正常(高温): ${tag.code} 温度 ${newTemp}°C`);
        }
        if (tempValue >= LOW_THRESHOLD && tag._lowAlertTriggered) {
          tag._lowAlertTriggered = false;
          console.log(`✅ 温度恢复正常(低温): ${tag.code} 温度 ${newTemp}°C`);
        }
      }
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

// 【已移除】原自动孤立逻辑 - 现在模型加载后保持默认状态
// 如果存在默认视图，由 App.vue 负责在 onViewerReady 后恢复
// watch(() => [props.assets, props.rooms, props.currentView], ...)


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

const miniLinePath = computed(() => {
  if (!chartData.value.length) return '';
  const len = chartData.value.length;
  const MIN_Y = -20, MAX_Y = 40, RANGE = MAX_Y - MIN_Y; // 60度范围
  return chartData.value.map((p, i) => {
    const x = len > 1 ? (i / (len - 1)) * 1000 : 500; // 单点时放中间
    const y = 100 - ((p.value - MIN_Y) / RANGE) * 100;
    return `${i === 0 ? 'M' : 'L'} ${isNaN(x) ? 0 : x} ${isNaN(y) ? 50 : y}`;
  }).join(' ');
});
const miniAreaPath = computed(() => miniLinePath.value ? `${miniLinePath.value} L 1000 100 L 0 100 Z` : '');
const miniOverlayPaths = computed(() => {
  const MIN_Y = -20, MAX_Y = 40, RANGE = MAX_Y - MIN_Y;
  return overlaySeries.value.map(series => {
    if (!series.length) return '';
    const len = series.length;
    return series.map((p, i) => {
      const x = len > 1 ? (i / (len - 1)) * 1000 : 500;
      const y = 100 - ((p.value - MIN_Y) / RANGE) * 100;
      return `${i === 0 ? 'M' : 'L'} ${isNaN(x) ? 0 : x} ${isNaN(y) ? 50 : y}`;
    }).join(' ');
  });
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

// AI 分析弹窗函数
const closeAIAnalysisModal = () => {
  showAIAnalysisModal.value = false;
};

const acknowledgeAlert = () => {
  showAIAnalysisModal.value = false;
  console.log('✅ 用户已确认报警');
};

// 格式化 AI 分析文本（Markdown 转 HTML）
const formatAnalysisText = (text) => {
  if (!text) return '';
  
  // 预处理：移除多余的空行和孤立的 #
  let processed = text
    .replace(/^#\s*$/gm, '')           // 移除孤立的 # 
    .replace(/\n{3,}/g, '\n\n')        // 多个换行合并为两个
    .replace(/^\s+|\s+$/g, '')         // 去掉首尾空白
    .trim();
  
  // Markdown 转 HTML
  return processed
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')      // ## 标题
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')     // ### 标题
    .replace(/^# (.+)$/gm, '<h3>$1</h3>')       // # 标题也转为 h3
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // 粗体
    .replace(/^- (.+)$/gm, '<li>$1</li>')       // 列表项
    .replace(/^(\d+)\. (.+)$/gm, '<div class="numbered-item"><span class="num">$1.</span> $2</div>')  // 编号列表
    .replace(/\n\n/g, '</p><p>')               // 段落
    .replace(/\n/g, '<br>')                    // 换行
    .replace(/^/, '<p>')                       // 开头加 p
    .replace(/$/, '</p>')                      // 结尾加 p
    .replace(/<p><h/g, '<h')                   // 清理标题前的 p
    .replace(/<\/h(\d)><\/p>/g, '</h$1>')      // 清理标题后的 p
    .replace(/<p><\/p>/g, '');                 // 移除空段落
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
    
    // 设置热力图 Composable 的 Viewer 实例
    heatmap.setViewer(viewer);
    
    // 设置基础样式
    viewer.setTheme('dark-theme');
    viewer.setLightPreset(17); // Field environment
    if (viewer.setProgressiveRendering) viewer.setProgressiveRendering(false);
    if (viewer.setQualityLevel) viewer.setQualityLevel(false, false);
    
    // 反转鼠标缩放方向（滚轮向上放大）
    if (viewer.navigation) {
      viewer.navigation.setReverseZoomDirection(true);
    }
    
    // TODO: 修复属性面板自动弹出问题（与 viewer.isolate 相关）
    
    // 添加 IoT 控制按钮到 Viewer 工具栏右侧
    let iotTempLabelBtn = null;
    let iotHeatmapBtn = null;
    
    // 根据页面更新 IoT 按钮状态
    const updateIoTButtonsState = () => {
      const isConnectView = props.currentView === 'connect';
      
      if (iotTempLabelBtn) {
        if (isConnectView) {
          iotTempLabelBtn.container.classList.remove('adsk-button-disabled');
          // 恢复当前状态
          if (areTagsVisible.value) {
            iotTempLabelBtn.setState(window.Autodesk.Viewing.UI.Button.State.ACTIVE);
          } else {
            iotTempLabelBtn.setState(window.Autodesk.Viewing.UI.Button.State.INACTIVE);
          }
        } else {
          // 非连接页面：取消激活并禁用
          areTagsVisible.value = false;
          iotTempLabelBtn.setState(window.Autodesk.Viewing.UI.Button.State.DISABLED);
          iotTempLabelBtn.container.classList.add('adsk-button-disabled');
        }
      }
      
      if (iotHeatmapBtn) {
        if (isConnectView) {
          iotHeatmapBtn.container.classList.remove('adsk-button-disabled');
          if (isHeatmapEnabled.value) {
            iotHeatmapBtn.setState(window.Autodesk.Viewing.UI.Button.State.ACTIVE);
          } else {
            iotHeatmapBtn.setState(window.Autodesk.Viewing.UI.Button.State.INACTIVE);
          }
        } else {
          // 非连接页面：取消激活并禁用
          heatmap.disable();
          iotHeatmapBtn.setState(window.Autodesk.Viewing.UI.Button.State.DISABLED);
          iotHeatmapBtn.container.classList.add('adsk-button-disabled');
        }
      }
    };
    
    const addIoTToolbarButtons = () => {
      if (!viewer.toolbar) {
        console.warn('⚠️ Viewer 工具栏尚未初始化');
        return;
      }
      
      // 创建控制按钮组
      const iotControlGroup = new window.Autodesk.Viewing.UI.ControlGroup('iot-controls');
      
      // 温度标签按钮
      iotTempLabelBtn = new window.Autodesk.Viewing.UI.Button('temp-labels-btn');
      iotTempLabelBtn.setToolTip(t('header.temperatureLabel'));
      iotTempLabelBtn.onClick = () => {
        // 只在连接页面响应点击
        if (props.currentView !== 'connect') return;
        
        toggleTemperatureLabels();
        // 更新按钮状态
        if (areTagsVisible.value) {
          iotTempLabelBtn.setState(window.Autodesk.Viewing.UI.Button.State.ACTIVE);
        } else {
          iotTempLabelBtn.setState(window.Autodesk.Viewing.UI.Button.State.INACTIVE);
        }
      };
      // 设置 SVG 图标 (温度计图标)
      const tempIcon = iotTempLabelBtn.container.querySelector('.adsk-button-icon');
      if (tempIcon) {
        tempIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 4V10.54C16.36 11.44 18 13.72 18 16.5C18 20.09 15.09 23 11.5 23C7.91 23 5 20.09 5 16.5C5 13.72 6.64 11.44 9 10.54V4C9 2.34 10.34 1 12 1C13.66 1 15 2.34 15 4H14Z"/>
          <circle cx="11.5" cy="16.5" r="2.5"/>
        </svg>`;
      }
      iotControlGroup.addControl(iotTempLabelBtn);
      
      // 热力图按钮
      iotHeatmapBtn = new window.Autodesk.Viewing.UI.Button('heatmap-btn');
      iotHeatmapBtn.setToolTip(t('header.heatmap'));
      iotHeatmapBtn.onClick = () => {
        // 只在连接页面响应点击
        if (props.currentView !== 'connect') return;
        
        toggleHeatmap();
        // 更新按钮状态
        if (isHeatmapEnabled.value) {
          iotHeatmapBtn.setState(window.Autodesk.Viewing.UI.Button.State.ACTIVE);
        } else {
          iotHeatmapBtn.setState(window.Autodesk.Viewing.UI.Button.State.INACTIVE);
        }
      };
      // 设置 SVG 图标 (热力图图标)
      const heatIcon = iotHeatmapBtn.container.querySelector('.adsk-button-icon');
      if (heatIcon) {
        heatIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="heatGradToolbar" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#4FC3F7"/>
              <stop offset="50%" style="stop-color:#FFA726"/>
              <stop offset="100%" style="stop-color:#EF5350"/>
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="18" height="18" rx="3" fill="url(#heatGradToolbar)" opacity="0.9"/>
        </svg>`;
      }
      iotControlGroup.addControl(iotHeatmapBtn);
      
      // 添加到工具栏右侧
      viewer.toolbar.addControl(iotControlGroup);
      
      // 初始化按钮状态
      updateIoTButtonsState();
      
      console.log('🎛️ IoT 控制按钮已添加到工具栏');
    };
    
    // 监听工具栏创建事件，确保按钮能正确添加
    if (viewer.toolbar) {
      addIoTToolbarButtons();
    } else {
      viewer.addEventListener(window.Autodesk.Viewing.TOOLBAR_CREATED_EVENT, addIoTToolbarButtons);
    }
    
    // 监听页面切换，更新按钮状态
    watch(() => props.currentView, () => {
      updateIoTButtonsState();
    });
    
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


// 新增：加载新模型（返回 Promise，等待模型加载完成）
const loadNewModel = async (modelPath) => {
  if (!viewer) return Promise.resolve(false);
  
  // 防止重复加载同一个模型
  if (isLoadingModel || currentModelPath === modelPath) {
    console.log(`⏭️ 模型正在加载或已加载，跳过: ${modelPath}`);
    return Promise.resolve(true); // 已加载，返回成功
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
  
  // 重置 defaultView，让新模型的初始视角成为新的默认视图
  defaultView = null;
  
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
  
  // 返回 Promise，等待模型加载完成
  return new Promise((resolve, reject) => {
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
          // 等待 1.5 秒后 resolve，确保 onModelLoaded 已完成
          setTimeout(() => {
            console.log('📦 模型加载 Promise 已解析');
            resolve(true);
          }, 1500);
        }, 1000);
        
        // 注意：onModelLoaded 会通过事件自动触发
    }, (errorCode) => {
        console.error('❌ 模型加载失败:', errorCode, finalPath);
        isLoadingModel = false;
        reject(new Error(`模型加载失败: ${errorCode}`));
    });
  });
};

// 自定义材质单例
let customRoomMat = null;
const getRoomMaterial = () => {
  if (customRoomMat) return customRoomMat;
  // 青绿色：#43ABC9 (RGB: 67, 171, 201)
  customRoomMat = new window.THREE.MeshBasicMaterial({
    color: 0x43ABC9, opacity: 0.5, transparent: true,
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
  
  // 延迟捕获默认视图，确保 Forge Viewer 完成初始相机设置
  // 不同大小的模型需要不同时间来稳定相机
  if (!defaultView) {
    setTimeout(() => {
      if (!defaultView && viewer && viewer.navigation) {
        try {
          const pos = viewer.navigation.getPosition().clone();
          const target = viewer.navigation.getTarget().clone();
          const up = viewer.navigation.getWorldUpVector().clone();
          defaultView = { pos, target, up };
          console.log('📷 已捕获默认视图（延迟）:', { pos, target, up });
        } catch (e) {
          console.warn('⚠️ 捕获默认视图失败:', e);
        }
      }
    }, 500); // 等待 500ms 让相机稳定
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

        // 预取所有房间的时序缓存，确保首次播放就绪
        const allCodes = roomList.map(r => r.code).filter(Boolean);
        refreshRoomSeriesCache(allCodes).then(() => setTagTempsAtCurrentTime()).catch(() => {});

        // 应用房间样式（青绿色）- 适用于所有视图
        setTimeout(() => {
          console.log(`🎯 模型加载完成，应用房间青绿色样式 (当前视图: ${props.currentView})`);
          applyRoomStyleOnly(); // 只上色，不孤立
        }, 100);
      }
    }, (err) => {
      // 属性获取失败，跳过该房间（没有编号）
      pendingProps--;
      if (pendingProps === 0) {
        emit('rooms-loaded', roomList);

        // 应用房间样式（青绿色）- 适用于所有视图
        setTimeout(() => {
          applyRoomStyleOnly(); // 只上色，不孤立
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
        
        // 【已移除】原自动显示资产逻辑
        // 现在由默认视图功能控制，或保持模型原始状态
      }
    });
  });
};

// 3. 应用青绿色样式到所有房间（用于连接视图，包含孤立效果）
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

// 3.5 应用青绿色样式到所有房间（只上色，不孤立，适用于所有视图）
const applyRoomStyleOnly = () => {
  if (!viewer || !viewer.model) return;

  // 优先使用从数据库传入的空间列表
  let dbIdsToColor = [];
  if (props.rooms && props.rooms.length > 0) {
    dbIdsToColor = props.rooms.map(r => r.dbId).filter(Boolean);
  } else if (foundRoomDbIds.length > 0) {
    dbIdsToColor = foundRoomDbIds;
  }

  if (dbIdsToColor.length === 0) {
    console.log('⚠️ 没有找到房间数据，跳过上色');
    return;
  }

  console.log(`🎨 为 ${dbIdsToColor.length} 个房间应用青绿色样式`);

  const mat = getRoomMaterial();
  const fragList = viewer.model.getFragmentList();
  const tree = viewer.model.getInstanceTree();

  dbIdsToColor.forEach(dbId => {
    tree.enumNodeFragments(dbId, (fragId) => {
      fragList.setMaterial(fragId, mat);
    });
  });

  // 强制刷新渲染（不孤立，所有构件都可见）
  viewer.impl.invalidate(true, true, true);
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
  
  if (viewState.getIsRestoringView()) return;
  
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
  if (!viewer || !viewer.model || !dbIds || dbIds.length === 0) return;

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
    const fragList = viewer.model?.getFragmentList();
    const tree = viewer.model?.getInstanceTree();

    // 先清除所有房间的主题颜色
    foundRoomDbIds.forEach(dbId => {
      viewer.setThemingColor(dbId, null);
    });

    // 然后只对选中的房间应用浅紫色材质（只有在 tree 可用时）
    if (tree && fragList) {
      dbIds.forEach(dbId => {
        tree.enumNodeFragments(dbId, (fragId) => {
          fragList.setMaterial(fragId, mat);
        });
      });
    }
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
  // 准备房间热力图数据
  const roomsData = foundRoomDbIds.map(dbId => {
    const tag = roomTags.value.find(t => t.dbId === dbId);
    return {
      dbId,
      value: tag ? parseFloat(tag.currentTemp) : 28,
      code: tag?.code,
      name: tag?.name
    };
  });

  // 使用 composable 切换热力图
  const enabled = heatmap.toggle(roomsData);

  if (!enabled) {
    // 关闭热力图时，恢复默认材质
    heatmap.restoreDefaultMaterial(foundRoomDbIds, getRoomMaterial);
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

// 10. 应用热力图样式 (使用 composable)
const applyHeatmapStyle = () => {
  if (foundRoomDbIds.length === 0 || !isHeatmapEnabled.value) return;

  // 准备房间热力图数据
  const roomsData = foundRoomDbIds.map(dbId => {
    const tag = roomTags.value.find(t => t.dbId === dbId);
    return {
      dbId,
      value: tag ? parseFloat(tag.currentTemp) : 28,
      code: tag?.code,
      name: tag?.name
    };
  });

  // 使用 composable 应用热力图
  heatmap.applyHeatmapStyle(roomsData);
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

// 获取完整的资产数据（委托给 dataExport composable）
const getFullAssetData = () => dataExport.getFullAssetData();

// 获取完整的空间数据（委托给 dataExport composable）
const getFullSpaceData = () => dataExport.getFullSpaceData();

// 使用映射配置获取完整的资产数据（委托给 dataExport composable）
const getFullAssetDataWithMapping = (mappings) => dataExport.getFullAssetDataWithMapping(mappings);

// 使用映射配置获取完整的空间数据（委托给 dataExport composable）
const getFullSpaceDataWithMapping = (spaceMapping) => dataExport.getFullSpaceDataWithMapping(spaceMapping);

// 获取资产的所有可用属性结构（委托给 dataExport composable）
const getAssetPropertyList = () => dataExport.getAssetPropertyList();

// 获取空间的所有可用属性结构（委托给 dataExport composable）
const getSpacePropertyList = () => dataExport.getSpacePropertyList();


// ================== 4. 辅助逻辑 (Timeline/Chart/Event) ==================

const emitRangeChanged = () => { const s = startDate.value.getTime(), e = endDate.value.getTime(); const w = Math.max(60_000, Math.round((e - s) / 300)); emit('time-range-changed', { startMs: s, endMs: e, windowMs: w }); };
const panTimeline = (d) => { const s = startDate.value.getTime(), e = endDate.value.getTime(), off = d * ((e - s) / 3); startDate.value = new Date(s + off); endDate.value = new Date(e + off); emitRangeChanged(); };
function syncTimelineHover(time, percent) { const s = startDate.value.getTime(), e = endDate.value.getTime(); if (typeof percent === 'number') { progress.value = Math.max(0, Math.min(100, percent * 100)); return; } if (time && e > s) { const p = Math.max(0, Math.min(100, ((time - s) / (e - s)) * 100)); progress.value = p; } }
const toggleTimeRangeMenu = () => isTimeRangeMenuOpen.value = !isTimeRangeMenuOpen.value;
const selectTimeRange = (o) => { selectedTimeRange.value = o; isTimeRangeMenuOpen.value = false; const now = new Date(); let ms = { '1h': 36e5, '3h': 3*36e5, '6h': 6*36e5, '24h': 864e5, '3d': 3*864e5, '7d': 7*864e5, '30d': 30*864e5 }[o.value] || 0; endDate.value = now; startDate.value = new Date(now - ms); progress.value = 100; emitRangeChanged(); refreshRoomSeriesCache().catch(() => {}); };
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

// 时间轴拖拽事件处理
const onProgressUpdate = (newProgress) => { progress.value = newProgress; emitRangeChanged(); };
const onScrubStart = () => { isDragging.value = true; isPlaying.value = false; };
const onScrubEnd = () => { isDragging.value = false; };

const openTimeline = () => isTimelineOpen.value=true;
const closeTimeline = () => { isTimelineOpen.value=false; isPlaying.value=false; };
watch(isTimelineOpen, (newVal) => { setTimeout(() => { if(viewer) { viewer.resize(); updateAllTagPositions(); } }, 300); });
watch([startDate, endDate], () => { loadChartData(); });

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

// 自动刷新数据的定时器
let autoRefreshTimer = null;
const AUTO_REFRESH_INTERVAL = 15000; // 15秒（更快的刷新频率以便及时检测报警）

const startAutoRefresh = () => {
  if (autoRefreshTimer) return; // 防止重复启动
  
  // 定义刷新函数
  const doRefresh = async () => {
    if (!isInfluxConfigured()) return;
    
    const now = new Date();
    console.log(`🔄 自动刷新数据... [${now.toLocaleTimeString()}]`);
    
    try {
      // 更新时间范围到当前时间（保持同样的时间跨度）
      const duration = endDate.value.getTime() - startDate.value.getTime();
      endDate.value = now;
      startDate.value = new Date(now.getTime() - duration);
      
      // 刷新图表数据
      await loadChartData();
      
      // 刷新房间时序缓存
      const codes = roomTags.value.map(t => t.code).filter(Boolean);
      console.log(`  🏠 发现 ${codes.length} 个房间标签`);
      if (codes.length) {
        await refreshRoomSeriesCache(codes).catch(() => {});
        
        // 更新最新温度值
        const map = await queryLatestByRooms(codes, 60 * 60 * 1000).catch((err) => {
          console.warn('  ⚠️ queryLatestByRooms 失败:', err);
          return {};
        });
        
        const mapKeys = Object.keys(map);
        console.log(`  📋 查询到 ${mapKeys.length} 个房间的数据: ${mapKeys.slice(0, 3).join(', ')}${mapKeys.length > 3 ? '...' : ''}`);
        
        roomTags.value.forEach(tag => {
          const v = map[tag.code];
          if (v !== undefined) {
            const newTemp = v.toFixed(1);
            if (tag.currentTemp !== newTemp) {
              console.log(`  📊 ${tag.code}: ${tag.currentTemp} → ${newTemp}`);
              tag.currentTemp = newTemp;
            }
          }
        });
        
        // 更新温度标签显示（会触发报警检测）
        setTagTempsAtCurrentTime();
      }
      
      // 触发图表数据更新事件，通知 App.vue 刷新底部图表
      emit('chart-data-update', chartData.value);
      
      console.log(`✅ 刷新完成`);
    } catch (err) {
      console.warn('⚠️ 自动刷新失败:', err);
    }
  };
  
  // 立即执行一次刷新
  doRefresh();
  
  // 设置定时刷新
  autoRefreshTimer = setInterval(doRefresh, AUTO_REFRESH_INTERVAL);
  
  console.log(`✅ 自动刷新已启动 (每${AUTO_REFRESH_INTERVAL / 1000}秒)`);
};

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
    console.log('⏹️ 自动刷新已停止');
  }
};

onMounted(() => {
  // 下拉菜单点击外部关闭已移入 TimelineControl 组件
  nextTick(() => initViewer());
  loadChartData();
  
  // 启动自动刷新（无论 InfluxDB 是否配置，定时器会在内部检查）
  if (isInfluxConfigured()) {
    startAutoRefresh();
  }
  
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
onUnmounted(() => { 
  stopAutoRefresh(); // 停止自动刷新
  cancelAnimationFrame(fId); 
  // 拖拽事件监听已移入 TimelineControl 组件 
  if(viewer) { viewer.finish(); viewer=null; } 
});

// ========== 视图状态管理方法（委托给 viewState composable）==========

// 获取当前视图状态
const getViewerState = () => viewState.getViewerState();

// 截取屏幕
const captureScreenshot = (callback) => viewState.captureScreenshot(callback);

// 恢复视图状态
const restoreViewState = (viewData) => viewState.restoreViewState(viewData);

// 刷新时序数据（用于模型激活后重新加载 InfluxDB 数据）
const refreshTimeSeriesData = async () => {
  console.log('🔄 刷新时序数据...');
  try {
    // 重新加载图表数据
    await loadChartData();
    
    // 刷新房间温度缓存
    const codes = roomTags.value.map(t => t.code).filter(Boolean);
    if (codes.length > 0) {
      await refreshRoomSeriesCache(codes).catch(() => {});
      
      // 更新最新温度值
      if (await isInfluxConfigured()) {
        const map = await queryLatestByRooms(codes, 60 * 60 * 1000).catch(() => ({}));
        roomTags.value.forEach(tag => {
          const v = map[tag.code];
          if (v !== undefined) tag.currentTemp = v.toFixed(1);
        });
      }
    }
    
    console.log('✅ 时序数据刷新完成');
  } catch (error) {
    console.error('❌ 时序数据刷新失败:', error);
  }
};

// 暴露方法给父组件
defineExpose({
  resizeViewer,
  loadNewModel,
  showAllAssets,
  showAllRooms,
  isolateAndFocusAssets,
  isolateAndFocusRooms,
  getAssetProperties,
  getRoomProperties,
  getTimeRange: () => ({ startMs: startDate.value.getTime(), endMs: endDate.value.getTime(), windowMs: Math.max(60_000, Math.round((endDate.value.getTime()-startDate.value.getTime())/300)) }),
  getAssetPropertyList,
  getSpacePropertyList,
  getFullAssetData,
  getFullSpaceData,
  getFullAssetDataWithMapping,
  getFullSpaceDataWithMapping,
  getViewerState,
  captureScreenshot,
  restoreViewState,
  showTemperatureTags,
  hideTemperatureTags,
  syncTimelineHover,
  refreshTimeSeriesData,
  setSelectedRooms: async (codes) => {
    if (!isInfluxConfigured() || !codes?.length) {
      overlaySeries.value = [];
      await refreshRoomSeriesCache().catch(() => {});
      setTagTempsAtCurrentTime();
      return;
    }
    const start = startDate.value.getTime();
    const end = endDate.value.getTime();
    const windowMs = 0; // 不聚合，显示原始数据点
    const promises = codes.map(c => queryRoomSeries(c, start, end, windowMs));
    const list = await Promise.all(promises);
    overlaySeries.value = list;
    selectedRoomCodes.value = codes.slice();
    await refreshRoomSeriesCache(codes).catch(() => {});
    setTagTempsAtCurrentTime();
  }
});
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

/* 低温警告弹窗样式 */
.low-temp-overlay {
  z-index: 400;
}
.low-temp-modal {
  background: #1e2a3a;
  border: 1px solid #4fc3f7;
  border-radius: 8px;
  width: 340px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 20px rgba(79, 195, 247, 0.2);
  color: #fff;
  font-family: 'Segoe UI', sans-serif;
  overflow: hidden;
}
.low-temp-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
  border-bottom: 1px solid #4fc3f7;
}
.warning-icon {
  color: #4fc3f7;
  flex-shrink: 0;
}
.warning-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}
.low-temp-body {
  padding: 20px;
}
.warning-message {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: #b3e5fc;
}
.alert-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}
.alert-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(79, 195, 247, 0.1);
  border: 1px solid rgba(79, 195, 247, 0.2);
  border-radius: 6px;
  margin-bottom: 8px;
}
.alert-item:last-child {
  margin-bottom: 0;
}
.room-name {
  font-size: 13px;
  color: #e3f2fd;
  font-weight: 500;
}
.temp-value {
  font-size: 14px;
  font-weight: 600;
  color: #4fc3f7;
  background: rgba(79, 195, 247, 0.2);
  padding: 2px 10px;
  border-radius: 12px;
}
.low-temp-footer {
  padding: 16px 20px;
  background: #152030;
  border-top: 1px solid #2a3a4a;
  display: flex;
  justify-content: center;
}
.btn-acknowledge {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border: none;
  color: #fff;
  padding: 10px 32px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}
.btn-acknowledge:hover {
  background: linear-gradient(135deg, #1e88e5 0%, #1976d2 100%);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
}

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

/* AI 分析弹窗样式 */
.ai-analysis-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.ai-analysis-modal {
  background: linear-gradient(145deg, #1a2332 0%, #0d1520 100%);
  border: 1px solid #3d5a80;
  border-radius: 16px;
  width: 600px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(59, 130, 246, 0.15);
  overflow: hidden;
}

.ai-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border-bottom: 1px solid #3b82f6;
}

.ai-header-icon {
  color: #93c5fd;
  display: flex;
  align-items: center;
}

.ai-header-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.ai-close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #93c5fd;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.ai-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.ai-modal-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  color: #e2e8f0;
  min-height: 200px;
  max-height: calc(85vh - 150px); /* 减去header和footer的高度 */
}

.ai-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 16px;
  color: #93c5fd;
}

.ai-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #1e3a5f;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ai-alert-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 10px;
  margin-bottom: 20px;
}

.alert-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.alert-badge.warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
}

.alert-badge.critical {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;
}

.alert-location {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: #e2e8f0;
}

.alert-temp {
  font-size: 18px;
  font-weight: 700;
  color: #f87171;
  background: rgba(239, 68, 68, 0.15);
  padding: 4px 12px;
  border-radius: 8px;
}

.ai-analysis-text {
  font-size: 14px;
  line-height: 1.8;
  color: #cbd5e1;
}

.ai-analysis-text h3 {
  color: #60a5fa;
  font-size: 16px;
  font-weight: 600;
  margin: 16px 0 8px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #2d4a6a;
}

.ai-analysis-text h4 {
  color: #93c5fd;
  font-size: 14px;
  font-weight: 600;
  margin: 12px 0 6px 0;
}

.ai-analysis-text strong {
  color: #e2e8f0;
}

.ai-analysis-text li {
  margin: 6px 0;
  padding-left: 8px;
  list-style: none;
}

.ai-analysis-text li::before {
  content: "•";
  color: #60a5fa;
  margin-right: 8px;
}

.ai-analysis-text .numbered-item {
  margin: 8px 0;
  padding-left: 0;
}

.ai-analysis-text .numbered-item .num {
  color: #60a5fa;
  font-weight: 600;
  margin-right: 4px;
}

.ai-analysis-text p {
  margin: 8px 0;
}

.ai-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: #0d1520;
  border-top: 1px solid #1e3a5f;
}

.ai-btn-secondary {
  background: transparent;
  border: 1px solid #475569;
  color: #94a3b8;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #64748b;
  color: #e2e8f0;
}

.ai-btn-primary {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-btn-primary:hover {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
}
</style>
// 叠加曲线颜色与默认一致：按阈值渐变
