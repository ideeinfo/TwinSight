<template>
  <div class="top-bar">
    <div class="left-section">
      <!-- Logo 区域 -->
      <div class="logo-container" style="cursor: pointer;" @click="goToHome">
        <!-- 注意：这里使用了相对路径 ../assets/logo.png -->
        <img src="../assets/logo.png" alt="Logo" class="logo" />
      </div>
      <div class="app-info">
        <div class="divider"></div>
        <span class="app-name">{{ displayName }}</span>
      </div>
    </div>

    <div class="center-section">
    <div class="center-section">
      <!-- Search bar removed -->
    </div>
    </div>

    <div class="right-section">
      <!-- 当前视图名称 -->
      <span v-if="currentViewName" class="current-view-label">{{ currentViewName }}</span>

      <!-- 视图按钮 -->
      <el-button text class="icon-btn-el" :class="{ active: isViewsPanelOpen }" :title="$t('views.title')" @click="$emit('toggle-views')">
        <el-icon :size="18">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </el-icon>
      </el-button>



      <el-button text class="icon-btn-el">
        <el-icon :size="18">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </el-icon>
      </el-button>

      <el-button text class="icon-btn-el" :title="$t('userManual.title')" @click="showManual = true">
        <el-icon :size="18">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </el-icon>
      </el-button>

      <!-- 用户头像下拉菜单 -->
      <UserDropdown />
    </div>

    <!-- 操作手册面板 -->
    <UserManualPanel :visible="showManual" @close="showManual = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useThemeStore } from '../stores/theme';

import UserDropdown from './UserDropdown.vue';
import UserManualPanel from './UserManualPanel.vue';

// 定义 props
const props = defineProps({
  isViewsPanelOpen: { type: Boolean, default: false },
  currentViewName: { type: String, default: '' },
  activeFileName: { type: String, default: '' }
});

// 计算属性：显示名称（优先使用激活文件名，否则使用默认名称）
const displayName = computed(() => props.activeFileName || '乐龄汇');

// 定义事件
defineEmits(['open-data-export', 'toggle-views']);

const router = useRouter();
const themeStore = useThemeStore();
const isDarkTheme = computed(() => themeStore.isDark);
const showManual = ref(false);

const toggleTheme = () => {
  themeStore.toggleTheme();
};

// 返回首页
const goToHome = () => {
  router.push('/');
};
</script>

<style scoped>
.top-bar {
  height: 48px;
  background-color: var(--md-sys-color-surface-container);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface);
  flex-shrink: 0;
  user-select: none;
}

.left-section, .center-section, .right-section {
  display: flex;
  align-items: center;
}

.right-section {
  gap: 8px;
}

.logo {
  height: 24px;
  width: auto;
  display: block;
}

.app-info {
  display: flex;
  align-items: center;
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--md-sys-color-outline-variant);
  margin: 0 12px;
}

.app-name {
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
  font-weight: 500;
}



/* Custom styles for Element Plus components */
.icon-btn-el {
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  margin-left: 0 !important;
  color: var(--md-sys-color-on-surface-variant);
}

.icon-btn-el:hover {
  color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-surface-container-high);
}

.icon-btn-el.active {
  color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-primary-container);
}



.current-view-label {
  font-size: 12px;
  color: var(--md-sys-color-primary);
  margin-right: 8px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-avatar {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  margin-left: 10px;
  flex-shrink: 0;
}




</style>