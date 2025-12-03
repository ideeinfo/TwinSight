<template>
  <div class="left-container">
    <!-- Icon Bar -->
    <div class="icon-bar">
      <!-- 上部按钮组 -->
      <div class="nav-group-top">
        <div class="nav-item disabled"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg><span class="label">{{ t('leftPanel.filters') }}</span></div>
        <div class="nav-item" @click="$emit('switch-view', 'assets')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg><span class="label">{{ t('leftPanel.assets') }}</span></div>
        <div class="nav-item disabled"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span class="label">{{ t('leftPanel.files') }}</span></div>
        <div class="spacer"></div>
        <div class="nav-item disabled"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="5" r="3"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="12" x2="6" y2="15"></line><line x1="12" y1="12" x2="18" y2="15"></line><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="18" r="3"></circle></svg><span class="label">{{ t('leftPanel.systems') }}</span></div>
        <div class="nav-item" @click="$emit('switch-view', 'connect')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg><span class="label">{{ t('leftPanel.connect') }}</span></div>
      </div>

      <!-- 下部按钮组 -->
      <div class="nav-group-bottom">
        <div class="nav-item" :class="{ 'active-blue': isStreamsActive }" @click="toggleStreams"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="isStreamsActive ? '#00b0ff' : 'currentColor'" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg><span class="label" :style="{ color: isStreamsActive ? '#00b0ff' : '' }">{{ t('leftPanel.streams') }}</span></div>
        <div class="nav-item disabled"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span class="label">{{ t('leftPanel.history') }}</span></div>
        <div class="nav-item disabled"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg><span class="label">{{ t('leftPanel.inventory') }}</span></div>
      </div>
    </div>

    <!-- List Panel -->
    <div class="list-panel">
      <div class="panel-header"><span class="title">{{ t('leftPanel.connections') }}</span><div class="actions"><span class="plus">+</span> {{ t('common.create') }}</div></div>
      <div class="search-row"><div class="search-input-wrapper"><svg class="search-icon-sm" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" :placeholder="t('common.search')" /></div><div class="filter-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg></div></div>
      <div class="status-bar"><span>{{ t('common.status') }}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div>
      
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
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>

          <div class="item-content"><div class="item-name">{{ item.name }}</div><div class="item-code">{{ item.code }}</div></div>
          <svg class="link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  rooms: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['open-properties', 'rooms-selected', 'toggle-streams', 'switch-view']);

// 数据流按钮激活状态
const isStreamsActive = ref(false);

// 切换数据流面板
const toggleStreams = () => {
  isStreamsActive.value = !isStreamsActive.value;
  emit('toggle-streams', isStreamsActive.value);
};

// 使用从模型获取的房间列表，如果为空则显示加载提示
const items = computed(() => {
  if (props.rooms && props.rooms.length > 0) {
    return props.rooms.map(room => ({
      name: room.name,
      code: room.code,
      dbId: room.dbId
    }));
  }
  return [];
});

// 改为多选：存储选中的索引数组
const selectedIndices = ref([]);

// 判断某个索引是否被选中
const isSelected = (index) => {
  return selectedIndices.value.includes(index);
};

// 切换选中状态（支持多选）
const selectItem = (index) => {
  const idx = selectedIndices.value.indexOf(index);

  if (idx > -1) {
    // 已选中，取消选中
    selectedIndices.value.splice(idx, 1);
  } else {
    // 未选中，添加到选中列表
    selectedIndices.value.push(index);
  }

  // 发送选中的房间 dbId 数组到父组件
  const selectedDbIds = selectedIndices.value.map(i => items.value[i].dbId);
  emit('rooms-selected', selectedDbIds);

  if (selectedDbIds.length > 0) {
    emit('open-properties');
  }
};
</script>

<style scoped>
.left-container { display: flex; height: 100%; width: 100%; background: #252526; border-right: 1px solid #1e1e1e; }
.icon-bar { width: 48px; flex-shrink: 0; background: #2b2b2b; border-right: 1px solid #1e1e1e; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.nav-group-top { width: 100%; display: flex; flex-direction: column; align-items: center; padding-top: 8px; }
.nav-group-bottom { width: 100%; display: flex; flex-direction: column; align-items: center; padding-bottom: 8px; }
.nav-item { width: 100%; height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999; cursor: pointer; margin-bottom: 4px; }
.nav-item:hover { color: #fff; } .nav-item.active { color: #fff; border-left: 2px solid transparent; } .nav-item.active-blue { border-left: 2px solid #00b0ff; background: #2a2d2e; color: #00b0ff; }
.nav-item.active-blue svg { stroke: #00b0ff; }
.nav-item.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
.nav-item .label { font-size: 9px; margin-top: 4px; }
.list-panel { width: 100%; display: flex; flex-direction: column; background: #252526; overflow: hidden; }
.panel-header { height: 36px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid #333; flex-shrink: 0; }
.title { font-size: 11px; font-weight: 600; color: #eee; } .actions { color: #0099ff; font-size: 11px; cursor: pointer; display: flex; align-items: center; } .plus { font-size: 14px; margin-right: 2px; }
.search-row { padding: 8px 12px; display: flex; gap: 8px; flex-shrink: 0; }
.search-input-wrapper { flex: 1; display: flex; align-items: center; border: 1px solid #3e3e42; border-radius: 2px; background: #1e1e1e; height: 24px; }
.search-icon-sm { margin-left: 6px; flex-shrink: 0; } .search-input-wrapper input { width: 100%; background: transparent; border: none; color: #fff; font-size: 11px; padding-left: 6px; outline: none; }
.filter-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.status-bar { padding: 4px 12px; font-size: 11px; color: #888; border-bottom: 1px solid #333; display: flex; justify-content: flex-end; align-items: center; gap: 4px; flex-shrink: 0; }
.item-list { flex: 1; overflow-y: auto; overflow-x: hidden; }
.list-item { display: flex; align-items: center; height: 44px; padding: 0 12px; border-bottom: 1px solid #2d2d2d; cursor: pointer; }
.list-item:hover { background: #2a2d2e; } 
.list-item.selected { background: #37373d; }

/* Checkbox 样式更新 */
.checkbox { 
  width: 14px; height: 14px; 
  border: 1px solid #888; 
  border-radius: 2px; 
  margin-right: 12px; 
  flex-shrink: 0; 
  display: flex; align-items: center; justify-content: center;
  transition: all 0.1s;
}
/* 选中状态：蓝色背景，白色勾 */
.checkbox.checked {
  background: #0078d4;
  border-color: #0078d4;
  color: #fff;
}
.checkbox:hover { border-color: #fff; }
/* 对勾 SVG 大小 */
.checkbox svg { width: 10px; height: 10px; }

.item-content { flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; margin-right: 8px; }
.item-name { color: #ddd; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-code { color: #777; font-size: 10px; margin-top: 2px; }
.link-icon { opacity: 0.5; flex-shrink: 0; }
.loading-hint { padding: 20px 12px; color: #888; font-size: 12px; text-align: center; }

/* 滚动条样式 */
.item-list::-webkit-scrollbar { width: 10px; }
.item-list::-webkit-scrollbar-track { background: #1e1e1e; }
.item-list::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 5px; }
.item-list::-webkit-scrollbar-thumb:hover { background: #4e4e52; }
</style>