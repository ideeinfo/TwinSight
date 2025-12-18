<template>
  <div class="icon-bar">
    <!-- 上部按钮组 -->
    <div class="nav-group-top">
      <div class="nav-item disabled">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        <span class="label">{{ t('leftPanel.filters') }}</span>
      </div>
      <div class="nav-item" :class="{ 'active-blue': currentView === 'assets' }" @click="$emit('switch-view', 'assets')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <span class="label">{{ t('leftPanel.assets') }}</span>
      </div>
      <div class="nav-item" :class="{ 'active-blue': currentView === 'files' }" @click="$emit('switch-view', 'files')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="label">{{ t('leftPanel.files') }}</span>
      </div>
      <div class="nav-item disabled">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="5" r="3"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="12" x2="6" y2="15"></line>
          <line x1="12" y1="12" x2="18" y2="15"></line>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="18" r="3"></circle>
        </svg>
        <span class="label">{{ t('leftPanel.systems') }}</span>
      </div>
      <div class="nav-item" :class="{ 'active-blue': currentView === 'connect' }" @click="$emit('switch-view', 'connect')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
        <span class="label">{{ t('leftPanel.connect') }}</span>
      </div>
    </div>

    <!-- 下部按钮组 -->
    <div class="nav-group-bottom">
      <div class="nav-item" :class="{ 'active-blue': isStreamsOpen }" @click="$emit('toggle-streams')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="isStreamsOpen ? '#38ABDF' : 'currentColor'" stroke-width="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        <span class="label" :style="{ color: isStreamsOpen ? '#38ABDF' : '' }">{{ t('leftPanel.streams') }}</span>
      </div>
      <div class="nav-item disabled">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span class="label">{{ t('leftPanel.history') }}</span>
      </div>
      <div class="nav-item disabled">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span class="label">{{ t('leftPanel.inventory') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
  currentView: { type: String, default: 'connect' },
  isStreamsOpen: { type: Boolean, default: false }
});

defineEmits(['switch-view', 'toggle-streams']);
</script>

<style scoped>
.icon-bar { 
  width: 48px; 
  flex-shrink: 0; 
  background: #2b2b2b; 
  border-right: 1px solid #1e1e1e; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: space-between; 
}
.nav-group-top { 
  width: 100%; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  padding-top: 8px; 
}
.nav-group-bottom { 
  width: 100%; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  padding-bottom: 8px; 
}
.nav-item { 
  width: 100%; 
  height: 56px; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  color: #999; 
  cursor: pointer; 
  margin-bottom: 4px; 
}
.nav-item:hover { 
  background: #333; 
}
.nav-item.active-blue { 
  border-left: 2px solid #38ABDF; 
  background: #2a2d2e; 
  color: #38ABDF; 
}
.nav-item.active-blue svg { 
  stroke: #38ABDF; 
}
.nav-item.disabled { 
  opacity: 0.3; 
  cursor: not-allowed; 
  pointer-events: none; 
}
.nav-item .label { 
  font-size: 10px; 
  text-align: center; 
}
</style>
