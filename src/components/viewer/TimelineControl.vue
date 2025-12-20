<template>
  <div :class="['top-navigation-area', isOpen ? 'docked' : 'floating']">
    <!-- Pill State (收起状态) -->
    <div v-if="!isOpen" class="time-pill" @click="$emit('open')">
      <div class="expand-action">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </div>
      <div class="divider"></div>
      <div class="pill-content">
        <svg class="cal-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span class="date-text">{{ currentDateStr }}</span>
        <span class="time-text">{{ currentTimeStr }}</span>
      </div>
      <div class="divider"></div>
      <div class="live-status-box">
        <div class="live-btn" :class="{ active: isLive }">
          <span class="dot">●</span> {{ t('timeline.live') }}
        </div>
      </div>
    </div>

    <!-- Timeline Dock (展开状态) -->
    <div v-else class="timeline-dock">
      <div class="timeline-toolbar">
        <div class="toolbar-left">
          <button class="tool-btn collapse" @click="$emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
            </svg>
          </button>
          <div class="divider-v"></div>
          <div class="current-info">
            <svg class="cal-icon-sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="info-text">{{ currentDateStr }} &nbsp; <strong>{{ currentTimeStr }}</strong></span>
          </div>
          <div class="live-indicator" :class="{ active: isLive }" @click="$emit('go-live')">
            <span class="dot">●</span> {{ t('timeline.live') }}
          </div>
        </div>
        <div class="toolbar-right">
          <!-- 时间范围选择 -->
          <div class="time-range-wrapper" ref="dropdownRef">
            <div class="dropdown-trigger" @click="isTimeRangeMenuOpen = !isTimeRangeMenuOpen">
              {{ selectedTimeRangeLabel }}
              <svg class="arrow" :class="{ rotated: isTimeRangeMenuOpen }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            <transition name="fade">
              <div v-if="isTimeRangeMenuOpen" class="dropdown-menu">
                <div 
                  v-for="option in timeOptions" 
                  :key="option.value" 
                  class="menu-item" 
                  :class="{ active: selectedTimeRange === option.value }"
                  @click="selectTimeRange(option)"
                >
                  {{ option.label }}
                  <svg v-if="selectedTimeRange === option.value" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div class="menu-divider"></div>
                <div class="menu-item" :class="{ active: selectedTimeRange === 'custom' }" @click="$emit('open-custom-modal')">
                  {{ t('timeline.custom') }}...
                </div>
              </div>
            </transition>
          </div>
          
          <!-- 缩放控制 -->
          <div class="control-group">
            <button class="circle-btn" @click="$emit('zoom-out')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="circle-btn" @click="$emit('zoom-in')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          
          <!-- 播放控制 -->
          <div class="control-group">
            <button class="icon-btn-lg" @click="$emit('toggle-play')">
              <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
            <button class="icon-btn-lg" :class="{ 'active-blue': isLooping }" @click="$emit('toggle-loop')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 21h5v-5"/>
              </svg>
            </button>
          </div>
          
          <!-- 速度控制 -->
          <div class="speed-box" @click="$emit('cycle-speed')">{{ playbackSpeed }}x</div>
        </div>
      </div>
      
      <!-- 时间轴轨道 -->
      <div class="timeline-track-row">
        <button class="nav-arrow left" @click="$emit('pan', -1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="track-container" ref="trackRef" @mousedown="onTrackMouseDown">
          <!-- 迷你图表层 -->
          <div class="mini-chart-layer">
            <svg class="svg-mini" viewBox="0 0 1000 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="miniAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#00b0ff;stop-opacity:0.2" />
                  <stop offset="100%" style="stop-color:#00b0ff;stop-opacity:0.0" />
                </linearGradient>
                <linearGradient id="miniStrokeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#ff0000" />
                  <stop offset="17%" stop-color="#ff6600" />
                  <stop offset="33%" stop-color="#ffcc00" />
                  <stop offset="50%" stop-color="#66cc00" />
                  <stop offset="67%" stop-color="#00cc66" />
                  <stop offset="83%" stop-color="#00b0ff" />
                  <stop offset="100%" stop-color="#0066ff" />
                </linearGradient>
              </defs>
              <path v-if="!overlayPaths.length" :d="areaPath" fill="url(#miniAreaGrad)" stroke="none" />
              <path v-if="!overlayPaths.length" :d="linePath" fill="none" stroke="url(#miniStrokeGrad)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
              <path v-for="(p, idx) in overlayPaths" :key="idx" :d="p" fill="none" stroke="url(#miniStrokeGrad)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
            </svg>
          </div>
          
          <!-- 刻度层 -->
          <div class="ticks-layer">
            <div 
              v-for="(tick, index) in ticks" 
              :key="index" 
              class="tick" 
              :class="[tick.type, { 'text-white': tick.highlight }]" 
              :style="{ left: tick.percent + '%' }"
            >
              <span v-if="tick.label">{{ tick.label }}</span>
            </div>
          </div>
          
          <!-- 播放头 -->
          <div class="scrubber" :style="{ left: progress + '%' }">
            <div class="head"></div>
            <div class="line"></div>
          </div>
        </div>
        <button class="nav-arrow right" @click="$emit('pan', 1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  isLive: { type: Boolean, default: true },
  isPlaying: { type: Boolean, default: false },
  isLooping: { type: Boolean, default: false },
  playbackSpeed: { type: Number, default: 1 },
  currentDateStr: { type: String, default: '' },
  currentTimeStr: { type: String, default: '' },
  selectedTimeRange: { type: String, default: '24h' },
  selectedTimeRangeLabel: { type: String, default: '' },
  timeOptions: { type: Array, default: () => [] },
  progress: { type: Number, default: 0 },
  ticks: { type: Array, default: () => [] },
  areaPath: { type: String, default: '' },
  linePath: { type: String, default: '' },
  overlayPaths: { type: Array, default: () => [] },
});

const emit = defineEmits([
  'open', 'close', 'go-live', 'toggle-play', 'toggle-loop',
  'zoom-in', 'zoom-out', 'pan', 'cycle-speed',
  'select-time-range', 'open-custom-modal', 'update:progress', 'scrub-start', 'scrub-end'
]);

const dropdownRef = ref(null);
const trackRef = ref(null);
const isTimeRangeMenuOpen = ref(false);
const isDragging = ref(false);

const selectTimeRange = (option) => {
  emit('select-time-range', option);
  isTimeRangeMenuOpen.value = false;
};

// 计算并更新进度
const updateProgress = (e) => {
  if (!trackRef.value) return;
  const r = trackRef.value.getBoundingClientRect();
  const newProgress = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
  emit('update:progress', newProgress);
};

const onTrackMouseDown = (e) => {
  isDragging.value = true;
  emit('scrub-start');
  updateProgress(e);
  window.addEventListener('mousemove', onTrackMouseMove);
  window.addEventListener('mouseup', onTrackMouseUp);
};

const onTrackMouseMove = (e) => {
  if (isDragging.value) {
    updateProgress(e);
  }
};

const onTrackMouseUp = () => {
  isDragging.value = false;
  emit('scrub-end');
  window.removeEventListener('mousemove', onTrackMouseMove);
  window.removeEventListener('mouseup', onTrackMouseUp);
};

// 点击外部关闭下拉菜单
const handleClickOutside = (e) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    isTimeRangeMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  // 清理可能残留的事件监听器
  window.removeEventListener('mousemove', onTrackMouseMove);
  window.removeEventListener('mouseup', onTrackMouseUp);
});
</script>

<style scoped>
/* 时间轴组件样式 */
.top-navigation-area { z-index: 100; transition: all 0.2s ease; }
.top-navigation-area.floating { position: absolute; top: 12px; left: 12px; }
.top-navigation-area.docked { position: relative; width: 100%; background: #202020; border-bottom: 1px solid #000; }

/* 收起状态 - 时间胶囊 */
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

/* 展开状态 - 时间轴面板 */
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

/* 下拉菜单 */
.dropdown-trigger { font-size: 12px; color: #ccc; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; }
.dropdown-trigger:hover { background: rgba(255,255,255,0.1); color: #fff; }
.arrow { font-size: 10px; transition: transform 0.2s; }
.arrow.rotated { transform: rotate(180deg); }
.dropdown-menu { position: absolute; top: 100%; right: 0; margin-top: 4px; width: 160px; background: #2b2b2b; border: 1px solid #444; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 200; padding: 4px 0; }
.menu-item { padding: 6px 12px; font-size: 12px; color: #ccc; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.menu-item:hover { background: #3e3e3e; color: #fff; }
.menu-item.active { color: #2196f3; font-weight: 500; }
.check-icon { color: #2196f3; }
.menu-divider { height: 1px; background: #444; margin: 4px 0; }

/* 控制按钮 */
.control-group { display: flex; align-items: center; gap: 4px; }
.circle-btn { width: 20px; height: 20px; border-radius: 50%; border: 1px solid #666; background: transparent; color: #ccc; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.circle-btn:hover { border-color: #999; color: #fff; }
.icon-btn-lg { width: 28px; height: 28px; background: transparent; border: none; color: #aaa; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.icon-btn-lg:hover { color: #fff; }
.active-blue { color: #2196f3; }
.speed-box { background: #333; border: 1px solid #555; border-radius: 3px; width: 24px; text-align: center; font-size: 11px; cursor: pointer; line-height: 18px; color: #ccc; }

/* 时间轴轨道 */
.timeline-track-row { flex: 1; display: flex; background: #1a1a1a; border-top: 1px solid #333; position: relative; height: 64px; }
.nav-arrow { width: 24px; background: #252526; border: none; border-right: 1px solid #333; border-left: 1px solid #333; color: #888; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 5; }
.nav-arrow:hover { color: #fff; background: #333; }
.track-container { flex: 1; position: relative; overflow: hidden; background: #1e1e1e; cursor: pointer; }

/* 刻度和迷你图表 */
.ticks-layer { position: absolute; top: 0; bottom: 0; width: 100%; pointer-events: none; z-index: 5; }
.tick { position: absolute; bottom: 24px; height: 10px; border-left: 1px solid #444; }
.tick.major { height: 16px; border-left: 1px solid #666; }
.tick span { position: absolute; top: 20px; left: -50%; transform: translateX(-2px); font-size: 10px; color: #777; white-space: nowrap; }
.tick.text-white span { color: #fff; font-weight: 500; }
.mini-chart-layer { position: absolute; top: 12px; bottom: 24px; left: 0; right: 0; pointer-events: none; z-index: 1; }
.svg-mini { width: 100%; height: 100%; }

/* 播放头 */
.scrubber { position: absolute; top: 0; bottom: 0; width: 16px; transform: translateX(-50%); pointer-events: none; z-index: 20; transition: left 0.1s linear; }
.scrubber .line { position: absolute; left: 50%; top: 6px; bottom: 0; width: 2px; background: #2196f3; transform: translateX(-50%); z-index: 1; }
.scrubber .head { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #2196f3; z-index: 2; }

/* 过渡动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 脉冲动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
