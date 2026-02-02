<template>
  <div class="icon-bar">
    <!-- 上部按钮组 -->
    <div class="nav-group-top">
      <div class="nav-item" :class="{ 'active-blue': currentView === 'models' }" @click="$emit('switch-view', 'models')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span class="label">{{ t('leftPanel.models') }}</span>
      </div>
      <div class="nav-item" :class="{ 'active-blue': currentView === 'assets' }" @click="$emit('switch-view', 'assets')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <span class="label">{{ t('leftPanel.assets') }}</span>
      </div>
      <div class="nav-item" :class="{ 'active-blue': currentView === 'spaces' }" @click="$emit('switch-view', 'spaces')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        <span class="label">{{ t('leftPanel.spaces') }}</span>
      </div>
      <div class="nav-item" :class="{ 'active-blue': currentView === 'rds' }" @click="$emit('switch-view', 'rds')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <!-- 树形结构图标 - 表示编码层级 -->
          <line x1="6" y1="4" x2="6" y2="20" />
          <line x1="6" y1="8" x2="18" y2="8" />
          <line x1="6" y1="14" x2="14" y2="14" />
          <circle cx="18" cy="8" r="2" />
          <circle cx="14" cy="14" r="2" />
          <circle cx="6" cy="20" r="2" />
        </svg>
        <span class="label">{{ t('leftPanel.rds') }}</span>
      </div>
      <div class="nav-item" :class="{ 'active-blue': currentView === 'connect' }" @click="$emit('switch-view', 'connect')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <span class="label">{{ t('leftPanel.connect') }}</span>
      </div>
      <div class="nav-item" :class="{ 'active-blue': currentView === 'documents' }" @click="$emit('switch-view', 'documents')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span class="label">{{ t('leftPanel.documents') }}</span>
      </div>
    </div>

    <!-- 下部按钮组 -->
    <div class="nav-group-bottom">
      <!-- AI 分析开关 -->
      <div class="nav-item" :class="{ 'active-blue': isAIEnabled }" @click="$emit('toggle-ai')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
          <circle cx="9" cy="13" r="1.5" fill="currentColor" />
          <circle cx="15" cy="13" r="1.5" fill="currentColor" />
          <path d="M9 17h6" />
        </svg>
        <span class="label">{{ t('leftPanel.ai') }}</span>
      </div>
      <!-- 数据流 -->
      <div class="nav-item" :class="{ 'active-blue': isStreamsOpen }" @click="$emit('toggle-streams')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span class="label">{{ t('leftPanel.streams') }}</span>
      </div>
      <div class="nav-item disabled">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span class="label">{{ t('leftPanel.history') }}</span>
      </div>
      <div class="nav-item disabled">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
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
  isStreamsOpen: { type: Boolean, default: false },
  isAIEnabled: { type: Boolean, default: false }
});

defineEmits(['switch-view', 'toggle-streams', 'toggle-ai']);
</script>

<style scoped>
.icon-bar { 
  width: 48px; 
  flex-shrink: 0; 
  background: var(--md-sys-color-surface-container); 
  border-right: 1px solid var(--md-sys-color-outline-variant); 
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
  color: var(--md-sys-color-on-surface-variant); 
  cursor: pointer; 
  margin-bottom: 4px; 
  border-left: 2px solid transparent;
}
.nav-item:hover { 
  background: var(--md-sys-color-surface-container-high); 
}
.nav-item.active-blue { 
  border-left: 2px solid var(--md-sys-color-primary); 
  background: var(--md-sys-color-primary-container); 
  color: var(--md-sys-color-primary); 
}
.nav-item.active-blue svg { 
  stroke: currentColor; 
}
.nav-item.disabled { 
  color: var(--md-sys-color-outline); 
  cursor: not-allowed; 
  opacity: 0.4;
}
.nav-item.disabled:hover { 
  background: transparent; 
}
.nav-item .label { 
  font-size: 10px; 
  text-align: center; 
  margin-top: 2px;
  transform: scale(0.9);
}
</style>
