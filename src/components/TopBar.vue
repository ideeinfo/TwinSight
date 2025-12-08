<template>
  <div class="top-bar">
    <div class="left-section">
      <!-- Logo 区域 -->
      <div class="logo-container">
        <!-- 注意：这里使用了相对路径 ../assets/logo.png -->
        <img src="../assets/logo.png" alt="Logo" class="logo" />
      </div>
      <div class="app-info">
        <div class="divider"></div>
        <span class="app-name">乐龄汇</span>
      </div>
    </div>

    <div class="center-section">
      <div class="search-box">
        <!-- Search Icon -->
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="Search 乐龄汇" />
      </div>
    </div>

    <div class="right-section">


      <!-- 语言切换下拉列表 -->
      <div class="language-dropdown" ref="langDropdownRef">
        <div class="lang-trigger" @click="toggleLangDropdown">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span>{{ currentLangLabel }}</span>
          <svg class="arrow" :class="{ rotated: isLangDropdownOpen }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <transition name="fade">
          <div v-if="isLangDropdownOpen" class="lang-menu">
            <div class="lang-menu-item" :class="{ active: currentLocale === 'zh' }" @click="switchLanguage('zh')">
              中文
              <svg v-if="currentLocale === 'zh'" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div class="lang-menu-item" :class="{ active: currentLocale === 'en' }" @click="switchLanguage('en')">
              English
              <svg v-if="currentLocale === 'en'" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
        </transition>
      </div>

      <div class="icon-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </div>

      <div class="icon-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>

      <div class="user-avatar">韦翟</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

// 定义事件
defineEmits(['open-data-export']);

const { locale } = useI18n();
const currentLocale = computed(() => locale.value);
const isLangDropdownOpen = ref(false);
const langDropdownRef = ref(null);

const currentLangLabel = computed(() => {
  return currentLocale.value === 'zh' ? '中文' : 'English';
});

const toggleLangDropdown = () => {
  isLangDropdownOpen.value = !isLangDropdownOpen.value;
};

const switchLanguage = (lang) => {
  locale.value = lang;
  localStorage.setItem('language', lang);
  isLangDropdownOpen.value = false;
};

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  if (langDropdownRef.value && !langDropdownRef.value.contains(event.target)) {
    isLangDropdownOpen.value = false;
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
.top-bar {
  height: 48px;
  background-color: #2b2b2b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #111;
  color: #ccc;
  flex-shrink: 0;
  user-select: none;
}

.left-section, .center-section, .right-section {
  display: flex;
  align-items: center;
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
  background: #555;
  margin: 0 12px;
}

.app-name {
  font-size: 14px;
  color: #ddd;
  font-weight: 500;
}

.search-box {
  background: #1f1f1f;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  height: 28px;
  display: flex;
  align-items: center;
  width: 400px;
  padding: 0 8px;
}

.search-box:hover {
  border-color: #666;
}

.search-icon {
  color: #888;
  margin-right: 8px;
  flex-shrink: 0;
}

.search-box input {
  background: transparent;
  border: none;
  color: #fff;
  width: 100%;
  outline: none;
  font-size: 12px;
}

.nav-text {
  font-size: 12px;
  margin-right: 16px;
  cursor: pointer;
}

.nav-text:hover {
  color: #fff;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ccc;
}

.icon-btn:hover {
  background: #3e3e42;
  border-radius: 2px;
}

.user-avatar {
  background: #99c7fb;
  color: #000;
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



/* 语言切换下拉列表样式 */
.language-dropdown {
  position: relative;
  margin-right: 16px;
}

.lang-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1f1f1f;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 4px 10px;
  height: 28px;
  font-size: 12px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.lang-trigger:hover {
  background: #3e3e42;
  border-color: #666;
  color: #fff;
}

.lang-trigger .arrow {
  transition: transform 0.2s;
}

.lang-trigger .arrow.rotated {
  transform: rotate(180deg);
}

.lang-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 120px;
  background: #2b2b2b;
  border: 1px solid #444;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  padding: 4px 0;
  z-index: 1000;
}

.lang-menu-item {
  padding: 6px 12px;
  font-size: 12px;
  color: #ccc;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.lang-menu-item:hover {
  background: #3e3e42;
  color: #fff;
}

.lang-menu-item.active {
  color: #0078d4;
  font-weight: 500;
}

.lang-menu-item .check-icon {
  color: #0078d4;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>