<template>
  <div class="left-container">
    <!-- List Panel -->
    <div class="list-panel">
      <div class="panel-header"><span class="title">{{ t('leftPanel.connections') }}</span><div class="actions"><span class="plus">+</span> {{ t('common.create') }}</div></div>
      <div class="search-row">
        <el-input
          v-model="searchText"
          :placeholder="t('common.search')"
          :prefix-icon="Search"
          size="small"
          clearable
          style="flex: 1"
        />
        <div class="filter-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg></div>
      </div>

      
      <div class="item-list">
        <!-- 加载提示 -->
        <div v-if="items.length === 0" class="loading-hint">
          {{ t('leftPanel.noRooms') }}
        </div>

        <div
          v-for="(item, index) in items"
          :key="item.dbId || index"
          class="list-item"
          :class="{ selected: isSelected(index) }"
          @click="selectItem(index)"
        >
          <!-- 修改点：Checkbox 增加 checked 样式和内部 SVG -->
          <div
            class="checkbox"
            :class="{ checked: isSelected(index) }"
            @click.stop="selectItem(index)"
          >
            <!-- 对勾图标，仅在选中时显示 -->
            <svg v-if="isSelected(index)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div class="item-content"><div class="item-name">{{ item.name }}</div><div class="item-code">{{ item.code }}</div></div>
          <svg 
            class="link-icon" 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#888" 
            stroke-width="2"
            :title="t('leftPanel.copyStreamUrl')"
            @click.stop="copyStreamUrl(item.fileId, item.code)"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
      </div>

      <!-- 复制成功提示 -->
      <Transition name="toast">
        <div v-if="showCopyToast" class="copy-toast">
          {{ t('leftPanel.urlCopied') }}
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();

// Helper to get auth headers
const getHeaders = () => {
  const headers = {};
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  return headers;
};

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  selectedDbIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['open-properties', 'rooms-selected']);

// 复制提示状态
const showCopyToast = ref(false);
const searchText = ref('');
let toastTimer = null;

// 使用从模型获取的房间列表，如果为空则显示加载提示
const items = computed(() => {
  if (props.rooms && props.rooms.length > 0) {
    return props.rooms.map(room => ({
      name: room.name,
      code: room.code,
      dbId: room.dbId,
      fileId: room.fileId  // 包含 fileId 用于生成唯一的 Stream URL
    }));
  }
  return [];
});

// 多选：存储选中的 dbId 数组（由父级传入以在视图切换时保留）
const selectedDbIdsLocal = ref([...(props.selectedDbIds || [])]);

// 同步父级选择（在视图切换或外部更新时保留）
watch(() => props.selectedDbIds, (val) => {
  selectedDbIdsLocal.value = [...(val || [])];
});
// 当房间列表变化时，过滤不存在的选择
watch(items, (list) => {
  if (!list || list.length === 0) return;
  const ids = new Set(list.map(i => i.dbId));
  selectedDbIdsLocal.value = selectedDbIdsLocal.value.filter(id => ids.has(id));
});

// 判断某个索引是否被选中
const isSelected = (index) => {
  const dbId = items.value[index]?.dbId;
  return selectedDbIdsLocal.value.includes(dbId);
};

// 切换选中状态（支持多选）
const selectItem = (index) => {
  const dbId = items.value[index]?.dbId;
  if (!dbId) return;
  const idx = selectedDbIdsLocal.value.indexOf(dbId);
  if (idx > -1) {
    selectedDbIdsLocal.value.splice(idx, 1);
  } else {
    selectedDbIdsLocal.value.push(dbId);
  }
  emit('rooms-selected', selectedDbIdsLocal.value);
  if (selectedDbIdsLocal.value.length > 0) emit('open-properties');
};

// 复制 Stream URL 到剪贴板（需要 fileId 确保唯一性）
const copyStreamUrl = async (fileId, spaceCode) => {
  try {
    if (!fileId) {
      console.error('无法复制 Stream URL: 缺少 fileId');
      return;
    }
    // 从服务器获取完整的 Stream URL（包含 API Key 和 fileId）
    const response = await fetch(`/api/v1/timeseries/stream-url/${fileId}/${encodeURIComponent(spaceCode)}`, { headers: getHeaders() });
    const result = await response.json();
    
    if (result.success && result.data?.streamUrl) {
      // 复制到剪贴板
      await navigator.clipboard.writeText(result.data.streamUrl);
      
      // 显示成功提示
      showCopyToast.value = true;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        showCopyToast.value = false;
      }, 2000);
    } else {
      console.error('获取 Stream URL 失败:', result.error);
    }
  } catch (error) {
    console.error('复制 Stream URL 失败:', error);
  }
};

</script>

<style scoped>
.left-container { display: flex; height: 100%; width: 100%; background: var(--md-sys-color-surface); border-right: 1px solid var(--md-sys-color-outline-variant); }
/* icon-bar removed or handled elsewhere? In template it wasn't visible in snippet. Assuming only list-panel matters here. */
/* Using tokens for list styles */
.list-panel { flex: 1; display: flex; flex-direction: column; background: var(--list-bg); }
.panel-header { height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.title { font-size: 11px; font-weight: 600; color: var(--md-sys-color-on-surface); text-transform: uppercase; }
.actions { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--md-sys-color-secondary); cursor: pointer; }
.actions:hover { color: var(--md-sys-color-primary); }
.plus { font-size: 14px; font-weight: bold; }
.search-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
/* .search-input-wrapper removed in favor of el-input */
.filter-icon { cursor: pointer; padding: 4px; color: var(--md-sys-color-secondary); }
.filter-icon:hover { color: var(--md-sys-color-primary); }
.filter-icon svg { stroke: currentColor; }

.item-list { flex: 1; overflow-y: auto; }
.list-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--md-sys-color-outline-variant); cursor: pointer; transition: background-color 0.2s; }
.list-item:hover { background: var(--list-item-bg-hover); }
.list-item.selected { background: var(--list-item-bg-selected); border-left: 2px solid var(--md-sys-color-primary); }

/* Custom Checkbox styled like Element Plus */
.checkbox { width: 16px; height: 16px; border: 1px solid var(--md-sys-color-outline); border-radius: 2px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s; margin-right: 8px; background: transparent; }
.checkbox:hover { border-color: var(--md-sys-color-primary); }
.checkbox.checked { background: var(--md-sys-color-primary); border-color: var(--md-sys-color-primary); }
.checkbox svg { width: 12px; height: 12px; stroke: var(--md-sys-color-on-primary); }

.item-content { flex: 1; min-width: 0; }
.item-name { font-size: 12px; color: var(--list-item-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-code { font-size: 10px; color: var(--list-item-text-secondary); margin-top: 2px; }
.link-icon { flex-shrink: 0; opacity: 0.5; cursor: pointer; transition: all 0.2s; stroke: var(--md-sys-color-secondary); }
.link-icon:hover { opacity: 1; stroke: var(--md-sys-color-primary); }
.loading-hint { padding: 40px 20px; text-align: center; color: #666; font-size: 12px; }

/* 复制成功提示 */
.copy-toast {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #38ABDF 0%, #0091ea 100%);
  color: #fff;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 176, 255, 0.3);
  z-index: 100;
  white-space: nowrap;
}

/* Toast 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

/* 滚动条样式 */
.item-list::-webkit-scrollbar { width: 10px; }
.item-list::-webkit-scrollbar-track { background: #1e1e1e; }
.item-list::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 5px; }
</style>
