<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { computed } from 'vue';
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

const elementLocale = computed(() => {
  return locale.value === 'zh' ? zhCn : en;
});
</script>

<style>
/* 全局样式保持不变 */
</style>
