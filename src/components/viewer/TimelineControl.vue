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
  'select-time-range', 'open-custom-modal', 'scrub-start'
]);

const dropdownRef = ref(null);
const trackRef = ref(null);
const isTimeRangeMenuOpen = ref(false);

const selectTimeRange = (option) => {
  emit('select-time-range', option);
  isTimeRangeMenuOpen.value = false;
};

const onTrackMouseDown = (e) => {
  emit('scrub-start', e);
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
});
</script>

<style scoped>
/* 时间轴组件样式将在后续从 MainView.vue 提取 */
/* 暂时保持空白，组件实际使用时需要迁移样式 */
</style>
