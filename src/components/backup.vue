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
          <div class="live-btn" :class="{ active: isLive }"><span class="dot">●</span> Live</div>
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
            <div class="live-indicator" :class="{ active: isLive }" @click="goLive"><span class="dot">●</span> Live</div>
          </div>
          <div class="toolbar-right">
            <div class="time-range-wrapper" ref="dropdownRef">
              <div class="dropdown-trigger" @click="toggleTimeRangeMenu">{{ selectedTimeRange.label }} <svg class="arrow" :class="{ rotated: isTimeRangeMenuOpen }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
              <transition name="fade">
                <div v-if="isTimeRangeMenuOpen" class="dropdown-menu">
                  <div v-for="option in timeOptions" :key="option.value" class="menu-item" :class="{ active: selectedTimeRange.value === option.value }" @click="selectTimeRange(option)">{{ option.label }}<svg v-if="selectedTimeRange.value === option.value" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                  <div class="menu-divider"></div>
                  <div class="menu-item" :class="{ active: selectedTimeRange.value === 'custom' }" @click="openCustomRangeModal">Custom range...<svg v-if="selectedTimeRange.value === 'custom'" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
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
                <path :d="miniAreaPath" fill="url(#miniAreaGrad)" stroke="none" />
                <path :d="miniLinePath" fill="none" stroke="url(#miniStrokeGrad)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
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
        <div class="modal-header"><span>Select Date Range</span><button class="close-btn" @click="closeCustomModal">×</button></div>
        <div class="calendar-widget">
          <div class="cal-header"><button @click="changeMonth(-1)">&#9664;</button><span>{{ calendarTitle }}</span><button @click="changeMonth(1)">&#9654;</button></div>
          <div class="cal-grid">
            <div class="cal-day-name" v-for="d in ['Su','Mo','Tu','We','Th','Fr','Sa']" :key="d">{{d}}</div>
            <div v-for="(day, idx) in calendarDays" :key="idx" class="cal-day" :class="{ 'empty': !day.inMonth, 'selected': isDaySelected(day.date), 'in-range': isDayInRange(day.date) }" @click="handleDayClick(day)">{{ day.date ? day.date.getDate() : '' }}</div>
          </div>
          <div class="range-preview"><div class="preview-box"><label>Start</label><span :class="{ placeholder: !tempStart }">{{ formatDate(tempStart) || 'Select date' }}</span></div><div class="arrow">→</div><div class="preview-box"><label>End</label><span :class="{ placeholder: !tempEnd }">{{ formatDate(tempEnd) || 'Select date' }}</span></div></div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" @click="closeCustomModal">Cancel</button><button class="btn-apply" @click="applyCustomRange" :disabled="!tempStart || !tempEnd">Apply</button></div>
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
          v-show="areTagsVisible && tag.visible"
          class="tag-wrapper" 
          :style="{ top: tag.y + 'px', left: tag.x + 'px' }"
        >
          <div class="heatmap-glow" :style="getHeatmapStyle(tag.currentTemp)"></div>
          <div class="tag-pin selected">
            <div class="pin-val blue" :style="getTagStyle(tag.currentTemp)">
              {{ tag.currentTemp }} °C
            </div>
          </div>
        </div>
      </div>

      <div class="heatmap-btn">Select heatmap</div>
    </div>

    <div class="resizer-y" @mousedown="startVerticalResize"></div>

    <div class="bottom-pane-wrapper" :style="{ height: chartHeight + 'px' }">
      <BottomChart :data="chartData" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, reactive } from 'vue';
import BottomChart from './BottomChart.vue';

// ================== 1. 所有响应式状态 (Top Level) ==================

// UI 状态
const isTimelineOpen = ref(false);
const isPlaying = ref(false);
const isLooping = ref(false);
const isDragging = ref(false);
const playbackSpeed = ref(1);
const progress = ref(95);
const trackRef = ref(null);
const chartHeight = ref(240);

// 标签与房间状态
const roomTags = ref([]); // 存储所有房间标签对象
const areTagsVisible = ref(true); // 全局显隐控制
let foundRoomDbIds = [];
let roomFragData = {}; // 材质缓存 {fragId: material}

// Viewer 状态
const viewerContainer = ref(null);
let viewer = null;
const MODEL_URL = '/models/my-building/output/3d.svf';

// 时间状态
const MOCK_NOW = new Date(); 
const endDate = ref(new Date(MOCK_NOW));
const startDate = ref(new Date(MOCK_NOW.getTime() - 3 * 24 * 60 * 60 * 1000)); 

// Dropdown & Modal 状态
const isTimeRangeMenuOpen = ref(false);
const dropdownRef = ref(null);
const selectedTimeRange = ref({ label: 'Last 3 days', value: '3d' });
const isCustomModalOpen = ref(false);
const calendarViewDate = ref(new Date());
const tempStart = ref(null);
const tempEnd = ref(null);
const timeOptions = [{ label: 'Last 24 hours', value: '24h' }, { label: 'Last 3 days', value: '3d' }, { label: 'Last 7 days', value: '7d' }, { label: 'Last 30 days', value: '30d' }];

// ================== 2. 计算属性 (Computed) ==================

// 必须放在 isLive 之前
const chartData = computed(() => {
  const start = startDate.value.getTime();
  const end = endDate.value.getTime();
  const points = [];
  const count = 300; 
  const step = (end - start) / (count - 1);
  for (let i = 0; i < count; i++) {
    const timestamp = start + i * step;
    const time = new Date(timestamp);
    const hour = time.getHours() + time.getMinutes() / 60;
    const dailyComponent = Math.sin(((hour - 8) / 24) * 2 * Math.PI) * 4; 
    const noise = (Math.random() - 0.5) * 2;
    let value = 28 + dailyComponent + noise;
    value = Math.max(20, Math.min(38, value));
    points.push({ timestamp, value });
  }
  return points;
});

const currentTemp = computed(() => {
  if (!chartData.value.length) return 0;
  const index = Math.round((progress.value / 100) * (chartData.value.length - 1));
  const point = chartData.value[index];
  return point ? parseFloat(point.value.toFixed(1)) : 0;
});

// 监听温度变化，更新房间标签数值
watch(currentTemp, (val) => {
  if (roomTags.value.length > 0) {
    roomTags.value.forEach(tag => {
      tag.currentTemp = (val + tag.offset).toFixed(1);
    });
  }
});

// isLive 放在这里，确保 progress 已定义
const isLive = computed(() => progress.value > 99.5);

const currentDisplayDate = computed(() => new Date(startDate.value.getTime() + (progress.value/100)*(endDate.value-startDate.value)));
const currentDateStr = computed(() => currentDisplayDate.value.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
const currentTimeStr = computed(() => currentDisplayDate.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' EDT');

const miniLinePath = computed(() => chartData.value.length ? chartData.value.map((p, i) => `${i===0?'M':'L'} ${(i/(chartData.value.length-1))*1000} ${100-((p.value-0)/40)*100}`).join(' ') : '');
const miniAreaPath = computed(() => miniLinePath.value ? `${miniLinePath.value} L 1000 100 L 0 100 Z` : '');

const generatedTicks = computed(() => {
  const s = startDate.value.getTime(), e = endDate.value.getTime(), d = e - s; if(d<=0) return [];
  const steps = [{v:36e5},{v:72e5},{v:144e5},{v:216e5},{v:432e5},{v:864e5},{v:1728e5},{v:6048e5},{v:2592e6},{v:31536e6}];
  const step = steps.find(x => x.v >= d/10) || steps[steps.length-1]; const interval = step.v;
  const ticks = []; let c = Math.floor(s/interval)*interval; if(c<s) c+=interval;
  while(c<=e) { const p=((c-s)/d)*100; const dt=new Date(c); let l='', h=false, t='major'; if(interval<864e5){ if(dt.getHours()===0){l=dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});h=true;}else{l=dt.toLocaleTimeString('en-US',{hour:'numeric'}).replace(' ','');t='minor';}}else{l=dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});h=true;} ticks.push({percent:p,type:t,label:l,highlight:h}); c+=interval; } return ticks;
});

const calendarTitle = computed(() => calendarViewDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
const calendarDays = computed(() => { const y = calendarViewDate.value.getFullYear(), m = calendarViewDate.value.getMonth(), fd = new Date(y, m, 1), ld = new Date(y, m + 1, 0), g = []; for(let i=0; i<fd.getDay(); i++) g.push({ date: null, inMonth: false }); for(let i=1; i<=ld.getDate(); i++) g.push({ date: new Date(y, m, i), inMonth: true }); return g; });

// 辅助样式计算
const getTagStyle = (t) => {
  if (t > 35) return { backgroundColor: '#ff4d4d', borderColor: '#d32f2f' }; 
  if (t > 30) return { backgroundColor: '#4caf50', borderColor: '#388e3c' }; 
  return { backgroundColor: '#0078d4', borderColor: '#005a9e' }; 
};
const getHeatmapStyle = (tempVal) => {
  const minT = 25, maxT = 35;
  let t = (tempVal - minT) / (maxT - minT);
  t = Math.max(0, Math.min(1, t));
  let hue = 200 - (t * 200); 
  const color = `hsla(${hue}, 100%, 50%, 0.6)`;
  const centerColor = `hsla(${hue}, 100%, 60%, 0.9)`;
  return {
    background: `radial-gradient(circle, ${centerColor} 0%, ${color} 40%, transparent 70%)`,
    transform: `translate(-50%, -50%) scale(${0.8 + t * 0.4})`,
    opacity: 0.8
  };
};

// ================== 3. Viewer 逻辑 ==================

const initViewer = () => {
  if (!window.Autodesk) return;
  const options = { env: 'Local', document: null, language: 'en' };
  window.Autodesk.Viewing.Initializer(options, () => {
    viewer = new window.Autodesk.Viewing.GuiViewer3D(viewerContainer.value);
    
    viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onModelLoaded);
    viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged);
    viewer.addEventListener(window.Autodesk.Viewing.CAMERA_CHANGE_EVENT, updateAllTagPositions);
    viewer.addEventListener(window.Autodesk.Viewing.viewerResizeEvent, updateAllTagPositions);
    
    if (viewer.start() > 0) return;
    viewer.loadModel(MODEL_URL, {}, () => { viewer.setTheme('dark-theme'); });
  });
};

// 自定义材质单例
let customRoomMat = null;
const getRoomMaterial = () => {
  if (customRoomMat) return customRoomMat;
  customRoomMat = new window.THREE.MeshBasicMaterial({
    color: 0x43ABC9, opacity: 0.5, transparent: true, 
    side: window.THREE.DoubleSide, depthWrite: false, depthTest: true 
  });
  viewer.impl.matman().addMaterial('custom-room-mat', customRoomMat, true);
  return customRoomMat;
};

// 1. 模型加载
const onModelLoaded = () => {
  viewer.search('Rooms', (dbIds) => {
    if (!dbIds || dbIds.length === 0) {
      viewer.search('房间', (cnDbIds) => {
        if (cnDbIds && cnDbIds.length > 0) processRooms(cnDbIds);
      });
    } else {
      processRooms(dbIds);
    }
  });
};

// 2. 处理房间 (缓存材质 + 生成标签)
const processRooms = (dbIds) => {
  foundRoomDbIds = dbIds;
  const fragList = viewer.model.getFragmentList();
  const tree = viewer.model.getInstanceTree();
  
  const newTags = [];

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
        x: 0, y: 0, visible: false,
        offset: (Math.random() - 0.5) * 2,
        currentTemp: 25
      });
    }
  });

  roomTags.value = newTags;
  applyRoomStyle();
};

// 3. 应用样式
const applyRoomStyle = () => {
  if (foundRoomDbIds.length === 0) return;
  const mat = getRoomMaterial();
  const fragList = viewer.model.getFragmentList();
  const tree = viewer.model.getInstanceTree();

  foundRoomDbIds.forEach(dbId => {
    tree.enumNodeFragments(dbId, (fragId) => {
      fragList.setMaterial(fragId, mat);
    });
  });
  
  viewer.impl.invalidate(true);
  viewer.isolate(foundRoomDbIds);
  areTagsVisible.value = true; // 显示标签
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

// 5. 选择变更
const onSelectionChanged = (event) => {
  const dbIds = event.dbIdArray;
  
  if (dbIds && dbIds.length > 0) {
    // 选中模式
    const selectedId = dbIds[0];
    areTagsVisible.value = false; // 隐藏标签
    removeRoomStyle();            // 卸载材质
    viewer.isolate([selectedId]); // 孤立
    viewer.fitToView([selectedId]);
  } else {
    // 默认模式
    applyRoomStyle(); // 挂载材质 + 显示标签
  }
};

// 6. 更新所有标签位置
const updateAllTagPositions = () => {
  if (!areTagsVisible.value) return;
  roomTags.value.forEach(tag => {
    const p = viewer.worldToClient(tag.worldPos);
    if (p.z > 1) tag.visible = false;
    else {
      tag.visible = true;
      tag.x = p.x;
      tag.y = p.y;
    }
  });
};

// ================== 4. 辅助逻辑 (Timeline/Chart/Event) ==================

const panTimeline = (d) => { const s = startDate.value.getTime(), e = endDate.value.getTime(), off = d * ((e - s) / 3); startDate.value = new Date(s + off); endDate.value = new Date(e + off); };
const toggleTimeRangeMenu = () => isTimeRangeMenuOpen.value = !isTimeRangeMenuOpen.value;
const selectTimeRange = (o) => { selectedTimeRange.value = o; isTimeRangeMenuOpen.value = false; const now = new Date(); let ms = { '24h': 864e5, '3d': 3*864e5, '7d': 7*864e5, '30d': 30*864e5 }[o.value] || 0; endDate.value = now; startDate.value = new Date(now - ms); progress.value = 100; };
const changeMonth = (d) => calendarViewDate.value = new Date(calendarViewDate.value.setMonth(calendarViewDate.value.getMonth() + d));
const isSameDay = (d1, d2) => d1 && d2 && d1.toDateString() === d2.toDateString();
const isDaySelected = (d) => isSameDay(d, tempStart.value) || isSameDay(d, tempEnd.value);
const isDayInRange = (d) => d && tempStart.value && tempEnd.value && d > tempStart.value && d < tempEnd.value;
const handleDayClick = (d) => { if (!d.date) return; if (!tempStart.value || (tempStart.value && tempEnd.value)) { tempStart.value = d.date; tempEnd.value = null; } else { if (d.date < tempStart.value) { tempEnd.value = tempStart.value; tempStart.value = d.date; } else tempEnd.value = d.date; } };
const formatDate = (d) => d ? d.toLocaleDateString() : '';
const openCustomRangeModal = () => { isTimeRangeMenuOpen.value = false; selectedTimeRange.value = { label: 'Custom', value: 'custom' }; tempStart.value = new Date(startDate.value); tempEnd.value = new Date(endDate.value); calendarViewDate.value = new Date(startDate.value); isCustomModalOpen.value = true; };
const closeCustomModal = () => isCustomModalOpen.value = false;
const applyCustomRange = () => { if (tempStart.value && tempEnd.value) { startDate.value = new Date(tempStart.value); endDate.value = new Date(tempEnd.value); endDate.value.setHours(23,59,59); progress.value = 100; isCustomModalOpen.value = false; } };
const zoomIn = () => { const d = endDate.value.getTime() - startDate.value.getTime(); startDate.value = new Date(endDate.value.getTime() - d / 1.5); };
const zoomOut = () => { const d = endDate.value.getTime() - startDate.value.getTime(); startDate.value = new Date(endDate.value.getTime() - d * 1.5); };
let fId;
const animate = () => { if(!isPlaying.value) return; const step=0.05*playbackSpeed.value; if(progress.value+step>=100) { if(isLooping.value) progress.value=0; else {progress.value=100; isPlaying.value=false;} } else progress.value+=step; fId=requestAnimationFrame(animate); };
const togglePlay = () => { isPlaying.value=!isPlaying.value; if(isPlaying.value) { if(progress.value>=100) progress.value=0; animate(); } else cancelAnimationFrame(fId); };
const cycleSpeed = () => { const s=[1,2,4,8]; playbackSpeed.value=s[(s.indexOf(playbackSpeed.value)+1)%4]; };
const goLive = () => { progress.value=100; isPlaying.value=false; };
const startDrag = (e) => { isDragging.value=true; isPlaying.value=false; updateP(e); window.addEventListener('mousemove',onDrag); window.addEventListener('mouseup',stopDrag); };
const onDrag = (e) => isDragging.value && updateP(e);
const stopDrag = () => { isDragging.value=false; window.removeEventListener('mousemove',onDrag); window.removeEventListener('mouseup',stopDrag); };
const updateP = (e) => { if(!trackRef.value)return; const r=trackRef.value.getBoundingClientRect(); progress.value=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)); };
let startY=0, startH=0;
const startVerticalResize = (e) => { startY=e.clientY; startH=chartHeight.value; document.addEventListener('mousemove',onVResize); document.addEventListener('mouseup',stopVResize); document.body.style.cursor='row-resize'; };
const onVResize = (e) => { const h = startH + (startY - e.clientY); if(h>50 && h<600) chartHeight.value = h; if(viewer) viewer.resize(); };
const stopVResize = () => { document.removeEventListener('mousemove',onVResize); document.removeEventListener('mouseup',stopVResize); document.body.style.cursor=''; if(viewer) viewer.resize(); };
const openTimeline = () => isTimelineOpen.value=true;
const closeTimeline = () => { isTimelineOpen.value=false; isPlaying.value=false; };
const handleClickOutside = (e) => { if(dropdownRef.value && !dropdownRef.value.contains(e.target)) isTimeRangeMenuOpen.value=false; };
watch(isTimelineOpen, (newVal) => { setTimeout(() => { if(viewer) { viewer.resize(); updateAllTagPositions(); } }, 300); });
onMounted(() => { document.addEventListener('click', handleClickOutside); nextTick(() => initViewer()); });
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
.overlay-tags { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }
.tag-wrapper { position: absolute; transform: translate(-50%, -100%); margin-top: -10px; pointer-events: auto; }
.heatmap-glow { position: absolute; top: 50%; left: 50%; width: 120px; height: 120px; border-radius: 50%; filter: blur(20px); mix-blend-mode: screen; z-index: -1; transition: all 0.2s ease-out; }
.tag-pin { position: relative; }
.pin-val { background: rgba(30,30,30,0.8); backdrop-filter: blur(4px); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 1px solid #555; white-space: nowrap; }
.pin-val.blue { background: #0078d4; border-color: #005a9e; font-weight: bold; }
.pin-val.alert-bg { background: #ff4d4d; border-color: #d32f2f; font-weight: bold; }
.heatmap-btn { position: absolute; bottom: 20px; left: 20px; background: #333; color: #fff; padding: 6px 12px; border-radius: 2px; font-size: 12px; cursor: pointer; z-index: 20; }
.resizer-y { height: 5px; background: #111; cursor: row-resize; z-index: 60; flex-shrink: 0; border-top: 1px solid #333; border-bottom: 1px solid #000; transition: background 0.2s; }
.resizer-y:hover { background: #0078d4; }
.bottom-pane-wrapper { background: #1e1e1e; z-index: 50; flex-shrink: 0; }
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
</style>