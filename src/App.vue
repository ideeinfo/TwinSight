<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { computed, watch, ref } from 'vue';
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useModelsStore } from '@/stores/models';
import { useControlChannel } from '@/composables/useControlChannel';

const { locale } = useI18n();

const elementLocale = computed(() => {
  return locale.value === 'zh' ? zhCn : en;
});

// 全局订阅 AI Hub 控制通道
const authStore = useAuthStore();
const modelsStore = useModelsStore();
const { connect, disconnect, switchFile } = useControlChannel({
  onCommand: (cmd) => {
    console.log('🤖 [App] 收到全局 UI 控制指令:', cmd);
    // 未来可扩展：分发到 EventBus 或对应的视图隔离监听器
  }
});

/**
 * 解析当前有效的 fileId：
 * 1. 优先使用 modelsStore.activeModelId
 * 2. 若为空，则调用 GET /api/files/active 尝试获取
 * 3. 都拿不到则返回 null
 */
async function resolveFileId() {
  if (modelsStore.activeModelId) {
    return modelsStore.activeModelId;
  }

  try {
    const token = authStore.token || localStorage.getItem('accessToken');
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${baseUrl}/api/files/active`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const json = await res.json();
      const file = json.data;
      if (file && file.id) {
        // 同步到 modelsStore
        modelsStore.setActiveModel(file.id);
        return file.id;
      }
    }
  } catch (err) {
    console.warn('[App] 获取活跃模型失败:', err.message);
  }

  return null;
}

// 监听登录状态
watch(() => authStore.isAuthenticated, async (isAuth) => {
  if (isAuth) {
    const fileId = await resolveFileId();
    if (fileId) {
      connect(fileId);
    } else {
      console.warn('[App] 未获取到有效 fileId，不建立 WS 连接');
    }
  } else {
    disconnect();
  }
}, { immediate: true });

// 监听模型切换 → 重连 WS
watch(() => modelsStore.activeModelId, (newFileId) => {
  if (authStore.isAuthenticated && newFileId) {
    switchFile(newFileId);
  }
});
</script>

<style>
/* 全局样式保持不变 */
</style>
