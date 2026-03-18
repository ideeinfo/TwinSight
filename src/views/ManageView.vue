<template>
  <ConsoleShell active-nav="manage" :context-label="t('managePage.navContext')">
    <section class="manage-placeholder">
      <div class="placeholder-card">
        <span class="eyebrow">{{ t('managePage.badge') }}</span>
        <h1>{{ t('managePage.title') }}</h1>
        <p>{{ t('managePage.description') }}</p>
      </div>
    </section>
  </ConsoleShell>
</template>

<script setup lang="ts">
import ConsoleShell from '@/components/dashboard/ConsoleShell.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.manage-placeholder {
  min-height: calc(100vh - 64px);
  padding: 32px;
  background: var(--md-sys-color-background);
}

.placeholder-card {
  max-width: 720px;
  padding: 32px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 16px;
  background: var(--md-sys-color-surface-container-low);
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent);
  color: var(--md-sys-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h1 {
  margin: 18px 0 10px;
  font-size: 36px;
  line-height: 1.1;
}

p {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 15px;
}
</style>
