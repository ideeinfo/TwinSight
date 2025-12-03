<template>
  <div class="left-container">
    <!-- Icon Bar -->
    <div class="icon-bar">
      <!-- 上部按钮组 -->
      <div class="nav-group-top">
        <div class="nav-item disabled"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg><span class="label">{{ t('leftPanel.filters') }}</span></div>
        <div class="nav-item active-blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg><span class="label">{{ t('leftPanel.assets') }}</span></div>
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
      <div class="panel-header"><span class="title">{{ t('assetPanel.assets') }}</span><div class="actions"><span class="plus">+</span> {{ t('common.create') }}</div></div>
      <div class="search-row"><div class="search-input-wrapper"><svg class="search-icon-sm" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" :placeholder="t('common.search')" v-model="searchText" /></div><div class="filter-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg></div></div>

      <div class="status-row">
        <span class="status-label">{{ t('common.status') }}</span>
        <div class="status-dots"><span class="dot green"></span><span class="dot yellow"></span><span class="dot red"></span></div>
      </div>

      <div class="list-content">
        <!-- 树形结构 -->
        <div v-for="(group, index) in filteredTree" :key="index" class="tree-group">
          <div class="tree-header">
            <div
              class="group-checkbox"
              :class="{ checked: isGroupChecked(group), indeterminate: isGroupIndeterminate(group) }"
              @click.stop="toggleGroupSelection(group)"
            >
              <svg v-if="isGroupChecked(group)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <svg v-else-if="isGroupIndeterminate(group)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                <line x1="6" y1="12" x2="18" y2="12"></line>
              </svg>
            </div>
            <div class="group-label" @click="toggleGroup(index)">
              <svg class="chevron" :class="{ expanded: expandedGroups[index] }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span class="group-name">{{ group.name }}</span>
              <span class="group-count">{{ group.items.length }}</span>
            </div>
          </div>
          
          <div v-show="expandedGroups[index]" class="tree-items">
            <div
              v-for="item in group.items"
              :key="item.dbId"
              class="list-item"
              :class="{ selected: isSelected(item.dbId) }"
              @click="selectItem(item.dbId)"
            >
              <div
                class="checkbox"
                :class="{ checked: isSelected(item.dbId) }"
                @click.stop="selectItem(item.dbId)"
              >
                <svg v-if="isSelected(item.dbId)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>

              <div class="item-content"><div class="item-name">{{ item.name }}</div><div class="item-code">{{ item.mcCode }}</div></div>
              <svg class="link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </div>
          </div>
        </div>

        <!-- 加载提示 -->
        <div v-if="filteredTree.length === 0" class="empty-state">
          <p>{{ t('assetPanel.loading') }}</p>
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
  assets: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['open-properties', 'assets-selected', 'toggle-streams', 'switch-view']);

// 搜索文本
const searchText = ref('');

// 数据流按钮激活状态
const isStreamsActive = ref(false);

// 切换数据流面板
const toggleStreams = () => {
  isStreamsActive.value = !isStreamsActive.value;
  emit('toggle-streams', isStreamsActive.value);
};

// 展开的分组
const expandedGroups = ref({});

// 切换分组展开/折叠
const toggleGroup = (index) => {
  expandedGroups.value[index] = !expandedGroups.value[index];
};

// 构建树形结构
const assetTree = computed(() => {
  const tree = {};
  
  props.assets.forEach(asset => {
    const classification = asset.classification || t('assetPanel.uncategorized');
    if (!tree[classification]) {
      tree[classification] = [];
    }
    tree[classification].push(asset);
  });

  return Object.keys(tree).sort().map(key => ({
    name: key,
    items: tree[key]
  }));
});

// 过滤后的树形结构
const filteredTree = computed(() => {
  if (!searchText.value) {
    return assetTree.value;
  }
  
  const search = searchText.value.toLowerCase();
  return assetTree.value.map(group => ({
    name: group.name,
    items: group.items.filter(item => 
      item.name.toLowerCase().includes(search) || 
      item.mcCode.toLowerCase().includes(search)
    )
  })).filter(group => group.items.length > 0);
});

// 选中的资产 dbId 数组
const selectedDbIds = ref([]);

// 判断某个 dbId 是否被选中
const isSelected = (dbId) => {
  return selectedDbIds.value.includes(dbId);
};

// 选择/取消选择资产
const selectItem = (dbId) => {
  const index = selectedDbIds.value.indexOf(dbId);
  if (index > -1) {
    selectedDbIds.value.splice(index, 1);
  } else {
    selectedDbIds.value.push(dbId);
  }

  emit('assets-selected', selectedDbIds.value);

  if (selectedDbIds.value.length > 0) {
    emit('open-properties');
  }
};

// 判断分组是否全选
const isGroupChecked = (group) => {
  if (group.items.length === 0) return false;
  return group.items.every(item => selectedDbIds.value.includes(item.dbId));
};

// 判断分组是否部分选中
const isGroupIndeterminate = (group) => {
  const selectedCount = group.items.filter(item => selectedDbIds.value.includes(item.dbId)).length;
  return selectedCount > 0 && selectedCount < group.items.length;
};

// 切换分组选择
const toggleGroupSelection = (group) => {
  const groupIndex = filteredTree.value.indexOf(group);

  // 展开分组
  expandedGroups.value[groupIndex] = true;

  // 判断是否全选
  const allSelected = isGroupChecked(group);

  if (allSelected) {
    // 取消选中该分组的所有资产
    group.items.forEach(item => {
      const index = selectedDbIds.value.indexOf(item.dbId);
      if (index > -1) {
        selectedDbIds.value.splice(index, 1);
      }
    });
  } else {
    // 选中该分组的所有资产
    group.items.forEach(item => {
      if (!selectedDbIds.value.includes(item.dbId)) {
        selectedDbIds.value.push(item.dbId);
      }
    });
  }

  emit('assets-selected', selectedDbIds.value);

  if (selectedDbIds.value.length > 0) {
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
.nav-item:hover { background: #333; }
.nav-item.active-blue { border-left: 2px solid #00b0ff; background: #2a2d2e; color: #00b0ff; }
.nav-item.active-blue svg { stroke: #00b0ff; }
.nav-item.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
.nav-item svg { margin-bottom: 4px; }
.nav-item .label { font-size: 10px; text-align: center; }
.spacer { height: 1px; width: 80%; background: #444; margin: 8px 0; }
.list-panel { flex: 1; display: flex; flex-direction: column; background: #252526; }
.panel-header { height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid #1e1e1e; }
.title { font-size: 11px; font-weight: 600; color: #ccc; text-transform: uppercase; }
.actions { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #888; cursor: pointer; }
.actions:hover { color: #00b0ff; }
.plus { font-size: 14px; font-weight: bold; }
.search-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #1e1e1e; }
.search-input-wrapper { flex: 1; position: relative; }
.search-input-wrapper input { width: 100%; background: #1e1e1e; border: 1px solid #333; border-radius: 3px; padding: 4px 8px 4px 24px; color: #ccc; font-size: 11px; }
.search-input-wrapper input:focus { outline: none; border-color: #00b0ff; }
.search-icon-sm { position: absolute; left: 6px; top: 50%; transform: translateY(-50%); }
.filter-icon { cursor: pointer; padding: 4px; }
.filter-icon:hover svg { stroke: #00b0ff; }
.status-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #1e1e1e; }
.status-label { font-size: 10px; color: #888; text-transform: uppercase; }
.status-dots { display: flex; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.green { background: #4caf50; }
.dot.yellow { background: #ffc107; }
.dot.red { background: #f44336; }
.list-content { flex: 1; overflow-y: auto; }
.tree-group { border-bottom: 1px solid #1e1e1e; }
.tree-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #2a2a2a; }
.tree-header:hover { background: #333; }
.group-checkbox { width: 16px; height: 16px; border: 1px solid #555; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s; cursor: pointer; }
.group-checkbox:hover { border-color: #00b0ff; }
.group-checkbox.checked { background: #00b0ff; border-color: #00b0ff; }
.group-checkbox.indeterminate { background: #555; border-color: #555; }
.group-checkbox svg { width: 12px; height: 12px; stroke: #fff; }
.group-label { flex: 1; display: flex; align-items: center; gap: 8px; cursor: pointer; }
.chevron { transition: transform 0.2s; stroke: #888; }
.chevron.expanded { transform: rotate(90deg); }
.group-name { flex: 1; font-size: 11px; color: #ccc; font-weight: 600; }
.group-count { font-size: 10px; color: #888; background: #1e1e1e; padding: 2px 6px; border-radius: 10px; }
.tree-items { background: #252526; }
.list-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 32px; cursor: pointer; border-bottom: 1px solid #1e1e1e; }
.list-item:hover { background: #2a2a2a; }
.list-item.selected { background: #2a2d2e; border-left: 2px solid #00b0ff; }
.checkbox { width: 16px; height: 16px; border: 1px solid #555; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.checkbox:hover { border-color: #00b0ff; }
.checkbox.checked { background: #00b0ff; border-color: #00b0ff; }
.checkbox svg { width: 12px; height: 12px; stroke: #fff; }
.item-content { flex: 1; min-width: 0; }
.item-name { font-size: 12px; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-code { font-size: 10px; color: #888; margin-top: 2px; }
.link-icon { flex-shrink: 0; opacity: 0.5; }
.link-icon:hover { opacity: 1; stroke: #00b0ff; }
.empty-state { padding: 40px 20px; text-align: center; color: #666; font-size: 12px; }

/* 滚动条样式 */
.list-content::-webkit-scrollbar { width: 10px; }
.list-content::-webkit-scrollbar-track { background: #1e1e1e; }
.list-content::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 5px; }
.list-content::-webkit-scrollbar-thumb:hover { background: #4e4e52; }
</style>

