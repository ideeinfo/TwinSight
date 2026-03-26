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
    <DateRangePicker
      v-model="dateRange"
      :visible="isCustomModalOpen"
      @update:visible="isCustomModalOpen = $event"
      @apply="onDateRangeApply"
    />


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
      :sources="aiAnalysisData.sources || []"
      @close="closeAIAnalysisModal"
      @acknowledge="acknowledgeAlert"
      @open-source="handleOpenSource"
    />

    <!-- 文档预览弹窗 -->
    <DocumentPreview
      :visible="showDocPreview"
      :document="previewDoc"
      @close="showDocPreview = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { isInfluxConfigured, queryAverageSeries, queryLatestByRooms, queryRoomSeries } from '../services/influx';
import { triggerTemperatureAlert } from '../services/ai-analysis';
import { useI18n } from 'vue-i18n';
import OverlayTags from './viewer/OverlayTags.vue';
import AIAnalysisModal from './viewer/AIAnalysisModal.vue';
import DocumentPreview from './DocumentPreview.vue';
import TimelineControl from './viewer/TimelineControl.vue';
import DateRangePicker from './DateRangePicker.vue';
import { useHeatmap } from '../composables/useHeatmap';
import { useDataExport } from '../composables/useDataExport';
import { useViewState } from '../composables/useViewState';
import { useThemeStore } from '../stores/theme';
import { useAuthStore } from '../stores/auth';

const { t, locale } = useI18n();
const themeStore = useThemeStore();
const authStore = useAuthStore();

// Helper to get auth headers
const getHeaders = () => {
  const headers = {};
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  return headers;
};

// 定义 props
const props = defineProps({
  currentView: { type: String, default: 'connect' },
  assets: { type: Array, default: () => [] }, // 从数据库加载的资产列表
  rooms: { type: Array, default: () => [] },   // 从数据库加载的空间列表
  isAIEnabled: { type: Boolean, default: true } // AI 分析功能开关
});

// 定义事件发射
const emit = defineEmits(['rooms-loaded', 'assets-loaded', 'chart-data-update', 'time-range-changed', 'viewer-ready', 'model-selection-changed', 'trigger-ai-alert']);

// ================== 1. 所有响应式状态 (Top Level) ==================

// UI 状态
const isTimelineOpen = ref(false);
const isPlaying = ref(false);
const isLooping = ref(false);
const isDragging = ref(false);
const playbackSpeed = ref(1);
const progress = ref(95);

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
  analysis: '',
  sources: []  // 文档来源列表
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

// 文档预览状态
const showDocPreview = ref(false);
const previewDoc = ref(null);

const handleOpenSource = async (source) => {
  console.log('📄 打开文档预览:', source);
  
  // 从 API 获取完整的文档信息（包括正确的 file_path）
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
    const response = await fetch(`${API_BASE_URL}/api/documents/${source.documentId}`, { headers: getHeaders() });
    const data = await response.json();
    
    if (data.success && data.data) {
      previewDoc.value = data.data;
    } else {
      // 降级：使用传入的信息构造文档对象
      previewDoc.value = {
        id: source.documentId,
        title: source.title || source.name,
        file_name: source.name || source.title,
        file_path: `/docs/${source.documentId}`, // 这个可能不正确，但作为降级方案
        file_type: source.fileType || 'pdf',
        image_width: source.width,
        image_height: source.height
      };
    }
  } catch (error) {
    console.error('获取文档信息失败:', error);
    // 降级处理
    previewDoc.value = {
      id: source.documentId,
      title: source.title || source.name,
      file_name: source.name || source.title,
      file_path: `/docs/${source.documentId}`,
      file_type: source.fileType || 'pdf'
    };
  }
  
  showDocPreview.value = true;
};

// 资产状态
let foundAssetDbIds = [];

// Viewer 状态
const viewerContainer = ref(null);
let viewer = null;
let currentModelPath = null; // 当前加载或已加载的模型路径
let isLoadingModel = false; // 是否正在加载模型
let defaultView = null;
let modelReadyCallbacks = []; // 模型就绪后执行的回调队列
let modelFullyReady = false; // 标记模型是否完全就绪（几何体+渲染）

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
const selectedTimeRange = ref({ label: '', value: '24h' }); // 默认24小时
const isCustomModalOpen = ref(false);

// DateRangePicker 绑定值
const dateRange = computed({
  get: () => ({ start: startDate.value, end: endDate.value }),
  set: (val) => {
    if (val?.start) startDate.value = new Date(val.start);
    if (val?.end) endDate.value = new Date(val.end);
  }
});

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

// 图表数据从 InfluxDB 拉取（不使用本地模拟）
const chartData = ref([]);
const overlaySeries = ref([]);
const isCacheReady = ref(false);
const suppressRangeWatchLoad = ref(false);
let heatmapTimer = null;
let uiObserver = null;
const selectedRoomCodes = ref([]);
let roomSeriesCache = {};




// 从 InfluxDB 加载图表数据
const loadChartData = async () => {
  const start = startDate.value.getTime();
  const end = endDate.value.getTime();
  const windowMs = 0; // 不聚合，显示原始数据点
  // 获取当前模型的 fileId（优先使用 roomTags，否则使用 props.rooms）
  const currentFileId = roomTags.value[0]?.fileId || props.rooms[0]?.fileId;
  console.log(`  📈 加载图表数据: ${new Date(start).toLocaleTimeString()} - ${new Date(end).toLocaleTimeString()}, fileId=${currentFileId}`);
  if (await isInfluxConfigured(currentFileId)) {
    try {
      const pts = await queryAverageSeries(start, end, windowMs, currentFileId);
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
  // 获取当前模型的 fileId（优先使用 roomTags，否则使用 props.rooms）
  const currentFileId = roomTags.value[0]?.fileId || props.rooms[0]?.fileId;
  if (!(await isInfluxConfigured(currentFileId))) { roomSeriesCache = {}; overlaySeries.value = []; isCacheReady.value = true; return; }
  const start = startDate.value.getTime();
  const end = endDate.value.getTime();
  const windowMs = 0; // 不聚合，显示原始数据点
  const targetCodes = (codes && codes.length ? codes : roomTags.value.map(t => t.code).filter(Boolean));
  const list = await Promise.all(targetCodes.map(c => queryRoomSeries(c, start, end, windowMs, currentFileId).then(pts => ({ code: c, pts })).catch(() => ({ code: c, pts: [] }))));
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
        tag.currentTemp = newTemp;
        
        // 温度阈值
        const HIGH_THRESHOLD = 26;
        const LOW_THRESHOLD = 10;
        const tempValue = parseFloat(newTemp);
        
        // 调试日志：打印报警判断条件
        if (tempValue > HIGH_THRESHOLD) {
          console.log(`🔍 [${tag.code}] 高温检测: tempValue=${tempValue}, isAIEnabled=${props.isAIEnabled}, _highAlertTriggered=${tag._highAlertTriggered}`);
        }
        
        // 高温报警：当温度超过28度时触发AI分析
        if (props.isAIEnabled && tempValue > HIGH_THRESHOLD && !tag._highAlertTriggered) {
          tag._highAlertTriggered = true;
          console.log(`🔥 高温报警: ${tag.code} (${tag.name || '未命名'}) 温度 ${newTemp}°C 超过阈值 ${HIGH_THRESHOLD}°C`);
          
          // 立即触发报警通知，需用户手动点击 "分析"
          emit('trigger-ai-alert', {
            title: `🔥 高温报警: ${tag.name || tag.code}`,
            message: `**当前温度**: ${tempValue}°C (阈值: ${HIGH_THRESHOLD}°C)\n\n系统检测到温度异常，请立即检查。您可以点击下方按钮进行智能分析。`,
            level: 'critical',
            actions: [
               { label: '定位房间', type: 'locate_room', id: tag.dbId },
               { 
                 label: '智能分析', 
                 type: 'analyze_alert', 
                 params: { 
                   roomCode: tag.code, 
                   roomName: tag.name || tag.code, 
                   temperature: tempValue, 
                   threshold: HIGH_THRESHOLD, 
                   alertType: 'high',
                   fileId: tag.fileId
                 }
               }
            ]
          });
        }
        
        // 低温报警：当温度低于0度时触发AI分析
        if (props.isAIEnabled && tempValue < LOW_THRESHOLD && !tag._lowAlertTriggered) {
          tag._lowAlertTriggered = true;
          console.log(`❄️ 低温报警: ${tag.code} (${tag.name || '未命名'}) 温度 ${newTemp}°C 低于阈值 ${LOW_THRESHOLD}°C`);
          
          // 立即触发报警通知，需用户手动点击 "分析"
          emit('trigger-ai-alert', {
            title: `❄️ 低温报警: ${tag.name || tag.code}`,
            message: `**当前温度**: ${tempValue}°C (阈值: ${LOW_THRESHOLD}°C)\n\n系统检测到温度异常，请立即检查。您可以点击下方按钮进行智能分析。`,
            level: 'critical',
            actions: [
               { label: '定位房间', type: 'locate_room', id: tag.dbId },
               {
                 label: '智能分析',
                 type: 'analyze_alert',
                 params: {
                   roomCode: tag.code,
                   roomName: tag.name || tag.code,
                   temperature: tempValue,
                   threshold: LOW_THRESHOLD,
                   alertType: 'low',
                   fileId: tag.fileId
                 }
               }
            ]
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

// 监听 rooms 变化更新 roomTags，确保 fileId 被传递
watch(() => props.rooms, (newRooms) => {
  if (newRooms && newRooms.length > 0) {
    // 只有当 roomTags 为空或者需要更新时才重新赋值
    // 这里我们要小心不要覆盖了已有的 tag 状态（如 currentTemp）
    // 所以我们只更新/合并属性
    
    // 如果 roomTags 为空，直接初始化
    if (roomTags.value.length === 0) {
      roomTags.value = newRooms.map(r => ({
        ...r,
        code: r.code,
        name: r.name,
        dbId: r.dbId,
        fileId: r.fileId, // 确保 fileId 被复制
        currentTemp: '20.0', // 默认温度
        visible: false,
        _highAlertTriggered: false,
        _lowAlertTriggered: false
      }));
      console.log(`🏠 初始化 roomTags: ${roomTags.value.length} 个, 第一个tag.fileId=${roomTags.value[0]?.fileId}`);
    } else {
      // 如果已存在，更新 fileId (如果缺失)
      roomTags.value.forEach(tag => {
        const room = newRooms.find(r => r.code === tag.code || r.dbId === tag.dbId);
        if (room && room.fileId) {
          tag.fileId = room.fileId;
        }
      });
      console.log(`🏠 更新 roomTags fileId: ${roomTags.value[0]?.fileId}, 原始 rooms[0].fileId=${newRooms[0]?.fileId}`);
      console.log('👀 [DEBUG] MainView roomTags[0] full dump:', JSON.stringify(roomTags.value[0]));
    }
  }
}, { immediate: true, deep: true });
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

// AI 分析弹窗函数
const closeAIAnalysisModal = () => {
  showAIAnalysisModal.value = false;
};

const acknowledgeAlert = () => {
  showAIAnalysisModal.value = false;
  console.log('✅ 用户已确认报警');
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
    // 根据系统主题设置 Forge 主题
    const forgeTheme = themeStore.isDark ? 'dark-theme' : 'light-theme';
    viewer.setTheme(forgeTheme);
    viewer.setLightPreset(17); // Field environment
    if (viewer.setProgressiveRendering) viewer.setProgressiveRendering(false);
    if (viewer.setQualityLevel) viewer.setQualityLevel(false, false);
    
    // 反转鼠标缩放方向（滚轮向上放大）
    if (viewer.navigation) {
      viewer.navigation.setReverseZoomDirection(true);
      
      // 设置默认的 WorldUpVector 为 Z 轴向上
      // 这确保新加载的模型使用正确的坐标系
      const defaultUpVector = new window.THREE.Vector3(0, 0, 1);
      viewer.navigation.setWorldUpVector(defaultUpVector);
      console.log('🧭 已设置默认 WorldUpVector 为 Z 轴向上');
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
    
    // 监听系统主题变化，实时更新 Forge Viewer 主题
    watch(() => themeStore.isDark, (isDark) => {
      if (viewer) {
        const forgeTheme = isDark ? 'dark-theme' : 'light-theme';
        viewer.setTheme(forgeTheme);
        console.log(`🎨 Forge Viewer 主题已切换为: ${forgeTheme}`);
      }
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
// 新增：加载新模型（返回 Promise，等待模型加载完成）
// 使用单例 Promise 模式，防止重复调用导致提前返回
let currentLoadPromise = null;

const loadNewModel = async (modelPath) => {
  if (!viewer) return Promise.resolve(false);
  
  // 如果已经在加载，直接返回当前的 loading promise
  if (isLoadingModel && currentLoadPromise) {
    console.log(`⏭️ 模型正在加载中，返回现有 Promise 以保持锁定: ${modelPath}`);
    return currentLoadPromise;
  }
  
  // 防止重复加载同一个已加载的模型
  if (!isLoadingModel && currentModelPath === modelPath) {
    console.log(`⏭️ 模型已完全加载，跳过重复加载: ${modelPath}`);
    return Promise.resolve(true); 
  }
  
  isLoadingModel = true;
  modelFullyReady = false; // 重置模型就绪状态
  
  // 创建并存储当前的 loading promise
  currentLoadPromise = (async () => {
    try {
      return await performLoadNewModel(modelPath);
    } finally {
      // 加载完成（成功或失败）后，清理 promise 引用
      currentLoadPromise = null;
    }
  })();
  
  return currentLoadPromise;
};

// 提取实际的加载逻辑到单独函数
const performLoadNewModel = async (modelPath) => {
  console.log('🔄 开始加载新模型:', modelPath);
  
  // 构造候选路径 - 使用完整 URL 确保 Web Worker 能正确解析（特别是 HTTPS 环境）
  const baseUrl = window.location.origin;
  let candidates = [];
  if (modelPath.endsWith('.svf')) {
    candidates.push(`${baseUrl}${modelPath}`);
  } else {
    // 优先尝试 /output/3d.svf (标准结构)
    candidates.push(`${baseUrl}${modelPath}/output/3d.svf`);
    // 备用尝试 /3d.svf (扁平结构)
    candidates.push(`${baseUrl}${modelPath}/3d.svf`);
  }
  
  let finalPath = candidates[0];
  
  // 预检路径，防止 Viewer 弹出错误提示
  try {
    for (const p of candidates) {
      try {
        const res = await fetch(p, { method: 'HEAD', headers: getHeaders() });
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          // 防止 SPA 返回 index.html (text/html) 被误认为是 SVF
          if (contentType && contentType.includes('text/html')) {
            console.warn(`⚠️ 路径 ${p} 返回了 HTML (可能是404)，跳过`);
            continue;
          }
          finalPath = p;
          break;
        }
      } catch {
        // 网络错误等忽略
      }
    }
    // 如果没有任何路径 ok，保留默认的第一个路径去让 viewer 报错（或者处理失败）
  } catch (err) {
    console.warn('⚠️ 模型路径预检失败，将尝试默认路径:', err);
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
  
  // 关键：在卸载旧模型后、加载新模型前，重置 WorldUpVector 为标准 Z 轴向上
  // 这样可以避免旧模型的错误坐标系影响新模型的加载
  if (viewer.navigation && viewer.navigation.setWorldUpVector) {
    const resetUpVector = new window.THREE.Vector3(0, 0, 1);
    viewer.navigation.setWorldUpVector(resetUpVector);
    console.log('🔄 已重置 WorldUpVector 为 Z 轴向上（准备加载新模型）');
  }
  
  // 返回 Promise，等待模型加载完成
  return new Promise((resolve, reject) => {
    // 监听 Promise 1: 几何体加载完成
    const geometryPromise = new Promise(res => {
      const handler = () => {
        viewer.removeEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, handler);
        console.log('✅ [loadNewModel] GEOMETRY_LOADED_EVENT 触发');
        res();
      };
      viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, handler);
    });

    // 监听 Promise 2: 对象树构建完成（确保可交互）
    const treePromise = new Promise(res => {
      const handler = () => {
        viewer.removeEventListener(window.Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, handler);
        console.log('✅ [loadNewModel] OBJECT_TREE_CREATED_EVENT 触发');
        res();
      };
      viewer.addEventListener(window.Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, handler);
    });

    // 加载错误处理
    const onLoadError = (errorCode) => {
       console.error('❌ 模型加载失败:', errorCode, finalPath);
       isLoadingModel = false;
       reject(new Error(`模型加载失败: ${errorCode}`));
    };

    // 加载新模型，并明确指定全局坐标系
    const loadOptions = {
      globalOffset: { x: 0, y: 0, z: 0 },
      // 关键：明确指定使用全局坐标系，Z 轴向上
      applyRefPoint: false,
      placementTransform: null,
      // 禁用自动相机调整，保持当前相机位置
      preserveView: false,
      // 强制使用正确的坐标系
      modelSpace: null
    };
    
    viewer.loadModel(finalPath, loadOptions, (model) => {
        // ❗ 最高优先级：立即设置 WorldUpVector，必须在任何其他操作之前
        // 这样 ViewCube 等工具也会使用正确的坐标系
        if (viewer.navigation && viewer.navigation.setWorldUpVector) {
          const correctUpVector = new window.THREE.Vector3(0, 0, 1);
          viewer.navigation.setWorldUpVector(correctUpVector);
          console.log('⚡ 模型加载回调：立即强制设置 WorldUpVector 为 Z 轴向上');
        }
        
        console.log('✅ loadModel 调用成功 (Manifest Loaded):', finalPath);
        console.log('📊 模型信息:', { 
          hasGeometry: model.getGeometryList ? 'Yes' : 'No',
          rootId: model.getRootId ? model.getRootId() : 'N/A'
        });
        
        // 标记模型路径（注意：isLoadingModel 稍后与 modelFullyReady 一起重置）
        currentModelPath = modelPath;
        
        // 其他初始化设置
        // 根据系统主题设置 Forge 主题
        const forgeTheme = themeStore.isDark ? 'dark-theme' : 'light-theme';
        viewer.setTheme(forgeTheme);
        viewer.setLightPreset(17); // Field
        if (viewer.setProgressiveRendering) viewer.setProgressiveRendering(false);
        if (viewer.setQualityLevel) viewer.setQualityLevel(false, false);
        
        // 重要：强制设置正确的 WorldUpVector，避免模型文件中的错误元数据
        // 大多数 BIM 模型使用 Z 轴向上 (0, 0, 1)
        if (viewer.navigation && viewer.navigation.setWorldUpVector) {
          const correctUpVector = new window.THREE.Vector3(0, 0, 1);
          viewer.navigation.setWorldUpVector(correctUpVector);
          console.log('🧭 已强制设置 WorldUpVector 为 Z 轴向上:', correctUpVector);
        }
        
        // 检查某些事件是否可能已经同步发生或已完成
        const pendingPromises = [];
        
        if (model.isLoadDone && model.isLoadDone()) {
             console.log('⏩ 几何体已加载 (同步或缓存)');
        } else {
             console.log('⏳ 等待几何体加载...');
             pendingPromises.push(geometryPromise);
        }

        if (model.getInstanceTree && model.getInstanceTree()) {
             console.log('⏩ 对象树已构建 (同步或缓存)');
        } else {
             console.log('⏳ 等待对象树构建...');
             pendingPromises.push(treePromise);
        }

        // 等待所有条件满足
        Promise.all(pendingPromises).then(() => {
             console.log('🎉 模型几何体与对象树均已就绪');
             
             // 额外的稳定时间，确保渲染帧完成且 Viewer 内部状态同步
             setTimeout(() => {
                modelFullyReady = true;
                isLoadingModel = false;
                console.log('📦 模型完全交互就绪，执行回调:', modelReadyCallbacks.length);
                
                // 再次确保 WorldUpVector 正确
                if (viewer.navigation && viewer.navigation.setWorldUpVector) {
                   viewer.navigation.setWorldUpVector(new window.THREE.Vector3(0, 0, 1));
                }

                modelReadyCallbacks.forEach(cb => {
                  try { cb(); } catch (e) { console.error('回调执行失败:', e); }
                });
                modelReadyCallbacks = [];
                resolve(true);
             }, 500);
        });

    }, onLoadError);
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

// 1. 模型加载
const onModelLoaded = () => {
  console.log('🎯 onModelLoaded 被触发');
  
  // 关键：再次强制设置 WorldUpVector，确保模型加载后也是正确的坐标系
  if (viewer && viewer.navigation && viewer.navigation.setWorldUpVector) {
    // 先读取当前的 WorldUpVector，用于调试
    const currentUpVector = viewer.navigation.getWorldUpVector();
    console.log('🔍 当前 WorldUpVector:', currentUpVector);
    
    const correctUpVector = new window.THREE.Vector3(0, 0, 1);
    viewer.navigation.setWorldUpVector(correctUpVector);
    console.log('🧭 onModelLoaded: 已再次强制设置 WorldUpVector 为 Z 轴向上');
    
    // 验证设置是否成功
    const verifyUpVector = viewer.navigation.getWorldUpVector();
    console.log('✅ 验证设置后的 WorldUpVector:', verifyUpVector);
  }
  
  // 重置状态（确保每次加载新模型时都从干净状态开始）
  roomTags.value = [];
  roomFragData = {};
  foundRoomDbIds = [];
  foundAssetDbIds = [];
  // 模型已加载（通过 modelFullyReady 标志控制）
  console.log('🧹 状态已重置');
  
  // 延迟捕获默认视图，确保 Forge Viewer 完成初始相机设置
  // 不同大小的模型需要不同时间来稳定相机
  if (!defaultView) {
    setTimeout(() => {
      if (!defaultView && viewer && viewer.navigation) {
        try {
          const pos = viewer.navigation.getPosition().clone();
          const target = viewer.navigation.getTarget().clone();
          // 强制使用 Z 轴向上，而不是从模型中读取可能错误的 WorldUpVector
          const up = new window.THREE.Vector3(0, 0, 1);
          defaultView = { pos, target, up };
          console.log('📷 已捕获默认视图（延迟，强制 Z 轴向上）:', { pos, target, up });
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

    if (!bounds.isEmpty()) {
      const center = new window.THREE.Vector3();
      bounds.getCenter(center);

      newTags.push({
        dbId: dbId,
        worldPos: center,
        x: 0, y: 0, visible: true,  // 默认显示温度标签
        offset: (Math.random() - 0.5) * 2,
        currentTemp: null  // 默认无数据，显示 N/A
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
        // 尝试解析 fileId
        let fileId;
        if (props.rooms && props.rooms.length > 0) {
          const match = props.rooms.find(r => r.code === code || r.dbId === dbId);
          if (match) fileId = match.fileId;
        }

        roomList.push({
          dbId: dbId,
          name: name || `房间 ${dbId}`,
          code: code,
          fileId: fileId
        });
        const tag = newTags.find(t => t.dbId === dbId);
        if (tag) {
          tag.code = code;
          // 尝试从 props.rooms 中匹配 fileId
          if (props.rooms && props.rooms.length > 0) {
            const match = props.rooms.find(r => r.code === code || r.dbId === dbId);
            if (match && match.fileId) {
              tag.fileId = match.fileId;
            }
          }
        }
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
    }, () => {
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
  // 注意：移除了 animateToDefaultView() 调用，以保持用户的相机视角
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
  // 注意：移除了 animateToDefaultView() 调用，以保持用户的相机视角
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

const emitRangeChanged = () => { const s = startDate.value.getTime(), e = endDate.value.getTime(); const w = 0; /* 不聚合 */ emit('time-range-changed', { startMs: s, endMs: e, windowMs: w }); };
const panTimeline = (d) => { const s = startDate.value.getTime(), e = endDate.value.getTime(), off = d * ((e - s) / 3); startDate.value = new Date(s + off); endDate.value = new Date(e + off); emitRangeChanged(); };
function syncTimelineHover(time, percent) { const s = startDate.value.getTime(), e = endDate.value.getTime(); if (typeof percent === 'number') { progress.value = Math.max(0, Math.min(100, percent * 100)); return; } if (time && e > s) { const p = Math.max(0, Math.min(100, ((time - s) / (e - s)) * 100)); progress.value = p; } }
const selectTimeRange = (o) => { selectedTimeRange.value = o; isTimeRangeMenuOpen.value = false; const now = new Date(); let ms = { '1h': 36e5, '3h': 3*36e5, '6h': 6*36e5, '24h': 864e5, '3d': 3*864e5, '7d': 7*864e5, '30d': 30*864e5 }[o.value] || 0; endDate.value = now; startDate.value = new Date(now - ms); progress.value = 100; emitRangeChanged(); refreshRoomSeriesCache().catch(() => {}); };
// DateRangePicker 事件处理
const openCustomRangeModal = () => { 
  isTimeRangeMenuOpen.value = false; 
  selectedTimeRange.value = { label: '', value: 'custom' }; 
  isCustomModalOpen.value = true; 
};
const onDateRangeApply = (range) => {
  if (range?.start && range?.end) {
    startDate.value = new Date(range.start);
    endDate.value = new Date(range.end);
    progress.value = 100;
    emitRangeChanged();
    refreshRoomSeriesCache().catch(() => {});
  }
};
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
watch(isTimelineOpen, () => { setTimeout(() => { if(viewer) { viewer.resize(); updateAllTagPositions(); } }, 300); });
watch([startDate, endDate], () => {
  if (suppressRangeWatchLoad.value) return;
  loadChartData();
});

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
    const currentFileId = roomTags.value[0]?.fileId || props.rooms[0]?.fileId;
    if (!(await isInfluxConfigured(currentFileId))) return;
    
    const now = new Date();
    console.log(`🔄 自动刷新数据... [${now.toLocaleTimeString()}]`);
    
    try {
      // 更新时间范围到当前时间（保持同样的时间跨度）
      const duration = endDate.value.getTime() - startDate.value.getTime();
      suppressRangeWatchLoad.value = true;
      endDate.value = now;
      startDate.value = new Date(now.getTime() - duration);
      suppressRangeWatchLoad.value = false;
      
      // 刷新图表数据
      await loadChartData();
      
      // 刷新房间时序缓存
      const codes = roomTags.value.map(t => t.code).filter(Boolean);
      console.log(`  🏠 发现 ${codes.length} 个房间标签`);
      if (codes.length) {
        await refreshRoomSeriesCache(codes).catch(() => {});
        
        // 获取当前模型的 fileId（使用第一个 room 的 fileId）
        const map = await queryLatestByRooms(codes, 60 * 60 * 1000, currentFileId).catch((err) => {
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
  const currentFileId = roomTags.value[0]?.fileId || props.rooms[0]?.fileId;
  isInfluxConfigured(currentFileId).then((ok) => {
    if (ok) startAutoRefresh();
  });
  
  setTimeout(async () => {
    const currentTimeoutFileId = roomTags.value[0]?.fileId || props.rooms[0]?.fileId;
    if (await isInfluxConfigured(currentTimeoutFileId)) {
      const codes = roomTags.value.map(t => t.code).filter(Boolean);
      if (codes.length) {
        refreshRoomSeriesCache(codes).catch(() => {});
        queryLatestByRooms(codes, 60 * 60 * 1000, roomTags.value[0]?.fileId).then(map => {
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
        const map = await queryLatestByRooms(codes, 60 * 60 * 1000, roomTags.value[0]?.fileId).catch(() => ({}));
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

// 12. 根据 GUID 和 搜索目标 (RefCodes 或 高级查询) 高亮构件
const highlightBimObjects = (guids, searchTarget) => {
  if (!viewer || !viewer.model) return;

  const targetDbIds = new Set();
  
  // 辅助函数：根据 dbIds 完成高亮
  const finalize = () => {
    const finalDbIds = Array.from(targetDbIds);
    if (finalDbIds.length > 0) {
      console.log(`🎯 高亮 ${finalDbIds.length} 个构件`);
      isolateAndFocusAssets(finalDbIds);
    } else {
      ElMessage.warning('在模型中未找到对应构件');
    }
  };

  // 核心搜索逻辑
  const executeSearch = (codes, attributes) => {
    if (!codes || codes.length === 0) return Promise.resolve();
    
    // 如果 refCodes 数量过多，只取前 50 个避免卡顿
    const codesToSearch = codes.length > 50 ? codes.slice(0, 50) : codes;
    if (codes.length > 50) {
       // 使用防抖或仅提示一次
       console.log(`选中项过多(${codes.length})，仅搜索前 50 个`);
    }

    const promises = codesToSearch.map(code => {
      return new Promise((resolve) => {
        // search(value, onSuccess, onError, attributeNames)
        viewer.search(code, (dbIds) => {
           dbIds.forEach(id => targetDbIds.add(id));
           resolve();
        }, (err) => {
           resolve();
        }, attributes);
      });
    });
    
    return Promise.all(promises);
  };

  // 1. 处理 GUIDs (优先处理，因为最快且准确)
  const processGuids = () => {
    return new Promise((resolve) => {
      if (guids && guids.length > 0) {
        viewer.model.getExternalIdMapping((mapping) => {
          guids.forEach(guid => {
            if (mapping[guid]) targetDbIds.add(mapping[guid]);
          });
          resolve();
        }, (err) => {
           console.error('获取 ExternalIdMapping 失败', err);
           resolve();
        });
      } else {
        resolve();
      }
    });
  };

  // 2. 执行流程
  processGuids().then(() => {
    // 处理 searchTarget
    if (Array.isArray(searchTarget)) {
       // 兼容旧模式：searchTarget 是 refCodes 数组
       // 为了提高效率，只搜索特定属性
       const defaultAttributes = ['MC编码', 'MC Code', 'DeviceCode', '设备编码', 'Tag Number'];
       executeSearch(searchTarget, defaultAttributes).then(finalize);
    } 
    else if (searchTarget && searchTarget.queries) {
       // 新模式：高级查询对象 { queries: [{ values: [], attributes: [] }] }
       const queryPromises = searchTarget.queries.map(q => executeSearch(q.values, q.attributes));
       Promise.all(queryPromises).then(finalize);
    } 
    else {
       // 只有 GUID 或无数据
       finalize();
    }
  });
};

// ==================== 电源追溯 3D 可视化 ====================

// 存储 3D 覆盖层对象，用于清除时移除
let powerTraceOverlayObjects = [];

// ==================== 电源追溯 3D 可视化 ====================

// 存储 3D 覆盖层对象，用于清除时移除
// let powerTraceOverlayObjects = []; // 已在上方声明

/**
 * 获取 BIM 构件的包围盒
 */
const getComponentBounds = (dbId) => {
  if (!viewer || !viewer.model) return null;
  
  const fragList = viewer.model.getFragmentList();
  const instanceTree = viewer.model.getInstanceTree();
  
  const bounds = new window.THREE.Box3();
  
  instanceTree.enumNodeFragments(dbId, (fragId) => {
    const box = new window.THREE.Box3();
    fragList.getWorldBounds(fragId, box);
    bounds.union(box);
  });
  
  return bounds.isEmpty() ? null : bounds;
};

/**
 * 获取射线与包围盒的交点（从中心向外）
 * 用于计算箭头的准确起点（在包围盒表面）
 */
const getBoxIntersection = (center, target, box) => {
  const direction = target.clone().sub(center).normalize();
  const ray = new window.THREE.Ray(center, direction);
  
  // THREE.Box3.intersectRay 返回交点，如果射线在盒内起点则返回 null (老版本 THREE behavior maybe?)
  // Forge Viewer 的 THREE 版本较旧 (r71 based)，我们需要谨慎使用
  
  // 简化算法：如果不使用 ray.intersectBox，我们可以手动计算
  // 但 Forge Viewer 带的 THREE.Box3 应该有 intersectRay
  const point = ray.intersectBox(box);
  
  // 如果起点就在盒内，intersectBox 可能返回 null 或者 远处的交点（取决于 Three 版本）
  // 让我们尝试手动计算"离开点"
  if (!point) {
    // 粗略近似：将中心点沿着方向移动，直到超出包围盒一半尺寸
    const size = box.getSize(new window.THREE.Vector3());
    const dist = Math.min(size.x, size.y, size.z) * 0.5;
    return center.clone().add(direction.multiplyScalar(dist));
  }
  
  return point;
};

// 共享几何体和材质以优化性能
let _arrowShaftGeo, _arrowHeadGeo, _arrowMat;
const getArrowAssets = (THREE, color) => {
   if (!_arrowShaftGeo) {
     // 建立单位高度的圆柱和圆锥，之后通过 scale 调整
     // 默认高度 1，中心在原点 -> 需要调整 pivot?
     // CylinderGeometry(radiusTop, radiusBottom, height)
     // Pivot default is center.
     _arrowShaftGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
     // Shift pivot to bottom: translate y by 0.5
     _arrowShaftGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
     
     _arrowHeadGeo = new THREE.CylinderGeometry(0, 1, 1, 16, 1);
     _arrowHeadGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
   }
   // 材质每次可能颜色不同，或者可以复用
   if (!_arrowMat || _arrowMat.color.getHex() !== color) {
     _arrowMat = new THREE.MeshPhongMaterial({ color: color, ambient: color, specular: 0x111111, shininess: 200 });
   }
   return { shaftGeo: _arrowShaftGeo, headGeo: _arrowHeadGeo, mat: _arrowMat };
};

/**
 * 创建更加明显的 3D 箭头（圆柱杆 + 圆锥头）- 性能优化版
 */
const createThickArrow = (startPos, endPos, color = 0xff0000, thickness = 0.5) => {
  const THREE = window.THREE;
  const { shaftGeo, headGeo, mat } = getArrowAssets(THREE, color);
  
  const direction = endPos.clone().sub(startPos);
  const length = direction.length();
  
  // 箭头头部长度和宽度 (调整系数以适应更细的线)
  const headLength = Math.min(length * 0.3, 5); 
  const headWidth = Math.max(thickness * 3, 0.5);
  const shaftLength = length - headLength;
  
  // 如果太短，不画或者画微小的
  if (length < 0.1) return null;
  
  const arrowGroup = new THREE.Object3D();
  
  // 1. 箭杆
  if (shaftLength > 0) {
    const shaft = new THREE.Mesh(shaftGeo, mat);
    // Scale: x=thickness, y=shaftLength, z=thickness
    shaft.scale.set(thickness, shaftLength, thickness);
    // Shaft position is local 0,0,0 because pivot is at bottom
    arrowGroup.add(shaft);
  }
  
  // 2. 箭头
  const head = new THREE.Mesh(headGeo, mat);
  head.scale.set(headWidth, headLength, headWidth);
  head.position.y = shaftLength; // 头部放在杆子顶端
  arrowGroup.add(head);
  
  // 3. 对齐方向
  const axisY = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(axisY, direction.normalize());
  arrowGroup.setRotationFromQuaternion(quaternion);
  
  // 设置位置
  arrowGroup.position.copy(startPos);
  
  return arrowGroup;
};

/**
 * 创建垂直指示箭头
 */
const createPointerArrow = (position, color = 0x00AAFF) => {
  const THREE = window.THREE;
  const height = 15;
  const headHeight = 5;
  const radius = 2;
  
  // 复用几何体逻辑，或者简单创建
  const group = new THREE.Object3D();
  
  // 简单创建 Mesh (少量使用无所谓)
  const coneGeo = new THREE.CylinderGeometry(0, radius * 2, headHeight, 16, 1);
  coneGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, -headHeight/2, 0)); // Pivot at top to rotate easier? Or just keep standard
  const coneMat = new THREE.MeshPhongMaterial({ color: color, shininess: 100 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = height; 
  cone.rotation.x = Math.PI; // Point down
  group.add(cone);
  
  // 杆
  const bodyGeo = new THREE.CylinderGeometry(radius, 0, height - headHeight, 8, 1);
  bodyGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, (height - headHeight)/2, 0));
  const bodyMat = new THREE.MeshPhongMaterial({ color: color, opacity: 0.8, transparent: true });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = headHeight; // 
  // group.add(body); // 简化，只显示箭头头 或 浮动箭头
  
  group.add(cone);
  group.position.copy(position).add(new THREE.Vector3(0, 5, 0));
  return group;
};

/**
 * 检查构件是否属于"线管"类别
 */
const isConduit = (dbId) => {
  if (!viewer) return Promise.resolve(false);
  return new Promise((resolve) => {
    viewer.getProperties(dbId, (result) => {
      if (!result || !result.properties) {
        resolve(false);
        return;
      }
      const isConduit = result.properties.some(prop => {
        const name = prop.displayName || prop.attributeName;
        const val = String(prop.displayValue);
        return (name === '类别' || name === 'Category') && (val.includes('线管') || val.includes('Conduit') || val.includes('Cable'));
      });
      resolve(isConduit);
    }, () => resolve(false));
  });
};

/**
 * 显示电源追溯覆盖层
 */
const showPowerTraceOverlay = async (traceData) => {
  if (!viewer || !traceData) return;
  
  console.log('⚡ [MainView] 显示电源追溯覆盖层:', traceData);
  
  // 1. 收集所有节点的 dbId 和类型信息
  const nodeDbIdMap = new Map();
  const nodeIsConduitMap = new Map(); // nodeId -> boolean
  const isolateDbIds = []; 
  let startNodeDbId = null;
  
  // 并行处理所有节点以提高速度
  await Promise.all(traceData.nodes.map(async (node) => {
    let dbId = null;
    
    // 查找 dbId
    if (node.bimGuid && viewer.model) {
      try {
        dbId = await new Promise((resolve) => {
          viewer.model.getExternalIdMapping((mapping) => {
            for (const [id, extId] of Object.entries(mapping)) {
              if (extId === node.bimGuid) { resolve(parseInt(id)); return; }
            }
            resolve(null);
          });
        });
      } catch (e) {}
    }
    
    if (!dbId && node.mcCode && viewer.model) {
      try {
        const searchAttributes = [
          'MC编码', 'MC Code', 'DeviceCode', '设备编码', 'Tag Number', 
          'Name', '名称', 'Mark', '标记', 'Number', '编号', 'Label', '标签'
        ];
        dbId = await new Promise((resolve) => {
          viewer.search(node.mcCode, (dbIds) => {
            resolve(dbIds && dbIds.length > 0 ? dbIds[0] : null);
          }, () => resolve(null), searchAttributes);
        });
        if (!dbId) {
          const globalId = await new Promise((resolve) => {
             viewer.search(node.mcCode, (dbIds) => resolve(dbIds && dbIds.length > 0 ? dbIds[0] : null), () => resolve(null));
          });
          if (globalId) dbId = globalId;
        }
      } catch (e) {}
    }
    
    if (dbId) {
      nodeDbIdMap.set(node.id, dbId);
      
      const isCond = await isConduit(dbId);
      // 也可以根据 nodeType 辅助判断
      const isCableType = node.nodeType === 'Cable' || (node.label && (node.label.includes('电缆') || node.label.includes('线')));
      nodeIsConduitMap.set(node.id, isCond || isCableType);
      
      if (!isCond && !isCableType) {
        isolateDbIds.push(dbId);
      } else {
        console.log(`  👻 识别到线管/电缆: ${node.label} (dbId: ${dbId})，将在逻辑连接中跳过`);
      }
      
      if (traceData.startNodeId && node.id === traceData.startNodeId) {
        startNodeDbId = dbId;
      }
    } else {
      console.warn(`  ⚠️ 未找到 BIM 构件: ${node.label} (MC: ${node.mcCode}) - 将作为虚拟节点处理 (跳过但传递连接)`);
    }
  }));
  
  // 2. 隔离显示 (只显示非线管设备)
  if (isolateDbIds.length > 0) {
    setManualSelection();
    viewer.isolate(isolateDbIds);
    viewer.fitToView(isolateDbIds);
  }
  
  // 3. 绘制逻辑连线 (跳过 线管 OR 未找到模型的节点 -> 直连 Device)
  clearPowerTraceOverlay();
  
  const overlayName = 'power-trace-overlay';
  if (viewer.impl.overlayScenes && !viewer.impl.overlayScenes[overlayName]) {
    viewer.impl.createOverlayScene(overlayName);
  }
  
  const THREE = window.THREE;
  const nodeBoundsMap = new Map();
  nodeDbIdMap.forEach((dbId, nodeId) => {
    const bounds = getComponentBounds(dbId);
    if (bounds) nodeBoundsMap.set(nodeId, bounds);
  });

  // 构建邻接表用于遍历 (基于所有 traceData edge，不管是否有 BIM)
  const adj = new Map(); // nodeId -> [childNodeIds]
  traceData.edges.forEach(edge => {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source).push(edge.target);
  });

  // 辅助函数：查找下游的第一个可见设备 (有 BIM 且非线管)
  // 如果遇到 无BIM 或 是线管 的节点，则继续向下递归
  const findVisibleTargetDevices = (nodeId, visited = new Set()) => {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);
    
    const children = adj.get(nodeId) || [];
    let devices = [];
    
    for (const childId of children) {
       // 判断 child 是否为"可见设备"
       const hasBim = nodeDbIdMap.has(childId);
       const isCond = nodeIsConduitMap.get(childId);
       
       if (hasBim && !isCond) {
         // 找到目标：是可见的，且不是线管
         devices.push(childId);
       } else {
         // 不是目标（是线管 或 无BIM），则作为中间节点，继续穿透查找
         devices = devices.concat(findVisibleTargetDevices(childId, visited));
       }
    }
    return devices;
  };
  
  // 遍历所有"可见设备"作为起点
  for (const [nodeId, dbId] of nodeDbIdMap.entries()) {
    // 如果起点本身是线管，则不能作为箭头的起始端 (它只是中间路径)
    if (nodeIsConduitMap.get(nodeId)) continue;
    
    // 查找所有逻辑下游可见设备
    const targets = findVisibleTargetDevices(nodeId, new Set()); 
    
    for (const targetId of targets) {
      const targetDbId = nodeDbIdMap.get(targetId);
      const sourceBounds = nodeBoundsMap.get(nodeId);
      const targetBounds = nodeBoundsMap.get(targetId);
      
      if (!targetDbId || !sourceBounds || !targetBounds) continue;
      
      const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
      const targetCenter = targetBounds.getCenter(new THREE.Vector3());
      
      // 计算端点
      const dir = targetCenter.clone().sub(sourceCenter).normalize();
      const rayOut = new THREE.Ray(sourceCenter, dir);
      let startPoint = rayOut.intersectBox(sourceBounds);
      
      if (!startPoint) {
        startPoint = sourceCenter.clone(); 
        const size = sourceBounds.getSize(new THREE.Vector3());
        const offset = dir.clone().multiplyScalar(Math.min(size.x, size.y, size.z) * 0.45); 
        startPoint.add(offset);
      }
      
      const dirIn = sourceCenter.clone().sub(targetCenter).normalize();
      const rayIn = new THREE.Ray(targetCenter, dirIn);
      let endPoint = rayIn.intersectBox(targetBounds);
      
      if (!endPoint) {
        endPoint = targetCenter.clone();
        const size = targetBounds.getSize(new THREE.Vector3());
        const offset = dirIn.clone().multiplyScalar(Math.min(size.x, size.y, size.z) * 0.45);
        endPoint.add(offset);
      }
      
      
      // 这里的厚度从 0.4 调整为 0.15，使连线更细
      const arrow = createThickArrow(startPoint, endPoint, 0xff3300, 0.15);
      
      if (arrow && viewer.impl.overlayScenes && viewer.impl.overlayScenes[overlayName]) {
        viewer.impl.addOverlay(overlayName, arrow);
        powerTraceOverlayObjects.push({ name: overlayName, object: arrow });
      }
    }
  }
  
  // 4. 起点标记
  if (startNodeDbId) {
    const bounds = nodeBoundsMap.get(traceData.startNodeId);
    if (bounds) {
       const center = bounds.getCenter(new THREE.Vector3());
       const size = bounds.getSize(new THREE.Vector3());
       
       const markerPos = center.clone().add(new THREE.Vector3(0, size.y * 0.5 + 2, 0));
       const dir = new THREE.Vector3(0, -1, 0);
       
       const markerArrow = new THREE.ArrowHelper(dir, markerPos.clone().add(new THREE.Vector3(0, 8, 0)), 8, 0x00AAFF, 3, 2);
       if (viewer.impl.overlayScenes && viewer.impl.overlayScenes[overlayName]) {
         viewer.impl.addOverlay(overlayName, markerArrow);
         powerTraceOverlayObjects.push({ name: overlayName, object: markerArrow });
       }
    }
  }
  
  console.log(`  🔗 绘制 ${powerTraceOverlayObjects.length} 个可视对象 (逻辑连接)`);
  viewer.impl.invalidate(true, true, true);
};

/**
 * 清除电源追溯覆盖层
 */
const clearPowerTraceOverlay = () => {
  if (!viewer) return;
  
  // 移除所有覆盖层对象
  for (const item of powerTraceOverlayObjects) {
    if (viewer.impl.overlayScenes && viewer.impl.overlayScenes[item.name]) {
      viewer.impl.removeOverlay(item.name, item.object);
    }
  }
  
  powerTraceOverlayObjects = [];
  
  // 刷新渲染
  viewer.impl.invalidate(true, true, true);
  
  console.log('🧹 [MainView] 电源追溯覆盖层已清除');
};

// 暴露方法给父组件
defineExpose({
  highlightBimObjects,
  resizeViewer,
  loadNewModel,
  // 模型就绪后执行回调（如果已就绪则立即执行）
  onModelReady: (callback) => {
    if (modelFullyReady && !isLoadingModel) {
      // 模型已就绪，立即执行
      callback();
    } else {
      // 模型尚未就绪，加入队列
      modelReadyCallbacks.push(callback);
      console.log('📌 回调已加入队列，当前队列长度:', modelReadyCallbacks.length);
    }
  },
  showAllAssets,
  showAllRooms,
  isolateAndFocusAssets,
  isolateAndFocusRooms,
  getAssetProperties,
  getRoomProperties,
  showPowerTraceOverlay,
  clearPowerTraceOverlay,
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
    const currentFileId = roomTags.value[0]?.fileId || props.rooms[0]?.fileId;
    if (!(await isInfluxConfigured(currentFileId)) || !codes?.length) {
      overlaySeries.value = [];
      await refreshRoomSeriesCache().catch(() => {});
      setTagTempsAtCurrentTime();
      return;
    }
    const start = startDate.value.getTime();
    const end = endDate.value.getTime();
    const windowMs = 0; // 不聚合，显示原始数据点
    // 获取当前模型的 fileId
    const promises = codes.map(c => queryRoomSeries(c, start, end, windowMs, currentFileId));
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
