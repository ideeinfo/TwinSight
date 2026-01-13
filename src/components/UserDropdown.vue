<template>
  <div ref="dropdownRef" class="user-dropdown">
    <!-- 头像触发按钮 -->
    <div class="avatar-trigger" @click="toggleDropdown">
      <div class="avatar" :style="avatarStyle">
        <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="avatar" />
        <span v-else>{{ initials }}</span>
      </div>
    </div>

    <!-- 下拉面板 -->
    <transition name="dropdown-fade">
      <div v-if="isOpen" class="dropdown-panel">
        <!-- 头部：用户信息 -->
        <div class="panel-header">
          <div class="header-avatar" :style="avatarStyle">
            <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="avatar" />
            <span v-else>{{ initials }}</span>
          </div>
          <div class="header-info">
            <div class="user-name">{{ user?.username || $t('account.guest') }}</div>
            <div class="user-email">{{ user?.email || '' }}</div>
          </div>
          <button class="close-btn" @click="closeDropdown">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- 语言选择 -->
        <div class="theme-section">
          <span class="section-label">{{ $t('common.language') || 'Language' }}</span>
          <el-select
            v-model="currentLang"
            size="small"
            class="theme-select"
            @change="handleLangChange"
          >
            <el-option value="zh" label="中文">
              <div class="theme-option">
                 <span>🇨🇳 中文</span>
              </div>
            </el-option>
            <el-option value="en" label="English">
              <div class="theme-option">
                 <span>🇺🇸 English</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <!-- 主题选择 -->
        <div class="theme-section">
          <span class="section-label">{{ $t('account.theme') }}</span>
          <el-select
            v-model="currentTheme"
            size="small"
            class="theme-select"
            @change="handleThemeChange"
          >
            <el-option value="light" :label="$t('account.themeLight')">
              <div class="theme-option">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                </svg>
                <span>{{ $t('account.themeLight') }}</span>
              </div>
            </el-option>
            <el-option value="dark" :label="$t('account.themeDark')">
              <div class="theme-option">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span>{{ $t('account.themeDark') }}</span>
              </div>
            </el-option>
            <el-option value="system" :label="$t('account.themeSystem')">
              <div class="theme-option">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <span>{{ $t('account.themeSystem') }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <!-- 操作按钮 -->
        <div class="panel-actions">
          <el-button type="primary" size="small" @click="openAccountSettings">
            {{ $t('account.settings') }}
          </el-button>
          <el-button size="small" @click="handleSignOut">
            {{ $t('account.signOut') }}
          </el-button>
        </div>
      </div>
    </transition>

    <!-- 账户设置对话框 -->
    <AccountDialog v-model="showAccountDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import * as authService from '@/services/auth';
import AccountDialog from './AccountDialog.vue';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

const dropdownRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const showAccountDialog = ref(false);

// 用户信息
const user = computed(() => authStore.user);

// 头像首字母
const initials = computed(() => {
  const name = user.value?.username || '';
  if (!name) return '?';
  // 只取第一个字符
  return name.charAt(0).toUpperCase();
});

// 头像背景色（根据用户 ID 生成固定颜色）
const avatarStyle = computed(() => {
  if (user.value?.avatarUrl) return {};
  const colors = [
    '#00bcd4', '#4caf50', '#ff9800', '#9c27b0', 
    '#f44336', '#2196f3', '#e91e63', '#009688'
  ];
  const id = user.value?.id || 0;
  const color = colors[id % colors.length];
  return { backgroundColor: color };
});

// 当前主题
const currentTheme = computed({
  get: () => themeStore.mode,
  set: (val) => themeStore.setMode(val)
});

// 切换下拉菜单
const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const closeDropdown = () => {
  isOpen.value = false;
};

// 语言切换
const { locale } = useI18n();
const currentLang = ref(locale.value);

const handleLangChange = (val: string) => {
  locale.value = val;
  localStorage.setItem('language', val);
  currentLang.value = val;
};

// 主题切换
const handleThemeChange = (val: string) => {
  themeStore.setMode(val as 'light' | 'dark' | 'system');
};

// 打开账户设置
const openAccountSettings = () => {
  showAccountDialog.value = true;
  closeDropdown();
};

// 注销
const handleSignOut = async () => {
  try {
    await authService.logout();
  } catch (error) {
    console.error('Sign out API failed:', error);
  }
  // 无论 API 是否成功，都清理本地状态并跳转
  authStore.clearAuth();
  localStorage.removeItem('accessToken');
  ElMessage.success(t('account.signOutSuccess'));
  closeDropdown();
  router.push('/');
};

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown();
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
.user-dropdown {
  position: relative;
}

/* 头像触发器 */
.avatar-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 20px;
  transition: background 0.2s;
}

.avatar-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 400;
  color: #fff;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-name-short {
  font-size: 13px;
  color: #ccc;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 下拉面板 */
.dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 280px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  z-index: 2000;
  overflow: hidden;
}

:root.dark .dropdown-panel {
  background: #1a1a24;
  border-color: rgba(255, 255, 255, 0.1);
}

/* 头部 */
.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
}

:root.dark .panel-header {
  border-color: rgba(255, 255, 255, 0.08);
}

.header-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  flex-shrink: 0;
}

.header-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
}

.user-email {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

/* 主题选择 */
.theme-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color);
}

:root.dark .theme-section {
  border-color: rgba(255, 255, 255, 0.08);
}

.section-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.theme-select {
  width: 140px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 操作按钮 */
.panel-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
}

.panel-actions .el-button {
  flex: 1;
}

/* 动画 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
