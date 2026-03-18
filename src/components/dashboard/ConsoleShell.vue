<template>
  <div class="console-shell">
    <TopBar
      :active-file-name="contextLabel"
      :show-views-button="false"
    >
      <template #center>
        <nav class="main-nav">
          <RouterLink
            v-for="item in navItems"
            :key="item.label"
            :to="item.disabled ? route.path : item.path"
            class="nav-link"
            :class="{ active: activeNav === item.key, disabled: item.disabled }"
            @click.prevent="handleNavClick(item)"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </template>
    </TopBar>

    <main class="console-main">
      <slot></slot>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import TopBar from '@/components/TopBar.vue';

interface NavItem {
  key: string;
  label: string;
  path: string;
  disabled?: boolean;
}

defineProps({
  activeNav: {
    type: String,
    default: 'facilities',
  },
  contextLabel: {
    type: String,
    default: 'Facility Portfolio',
  },
});

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const navItems = computed<NavItem[]>(() => [
  { key: 'home', label: t('consoleNav.home'), path: '/home' },
  { key: 'facilities', label: t('consoleNav.facilities'), path: '/facilities' },
  { key: 'manage', label: t('consoleNav.manage'), path: '/manage' },
]);

function handleNavClick(item: NavItem) {
  if (item.disabled || item.path === route.path) {
    return;
  }

  router.push(item.path);
}
</script>

<style scoped>
.console-shell {
  min-height: 100vh;
  background: var(--md-sys-color-background);
  color: var(--md-sys-color-on-surface);
}

.main-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 92px;
  height: 36px;
  padding: 0 16px;
  border-radius: 14px;
  color: var(--md-sys-color-on-surface-variant);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-link:hover {
  color: var(--md-sys-color-on-surface);
  background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
}

.nav-link.active {
  background: color-mix(in srgb, var(--md-sys-color-primary) 18%, var(--md-sys-color-surface-container-high));
  color: var(--md-sys-color-primary);
}

.console-main {
  min-height: calc(100vh - 48px);
}

@media (max-width: 1200px) {
  .main-nav {
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
    padding: 0 4px;
  }
}
</style>
