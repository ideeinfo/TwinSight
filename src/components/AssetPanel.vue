<template>
  <div class="left-container">
    <!-- List Panel -->
    <div class="list-panel">
      <div class="panel-header"><span class="title">{{ t('assetPanel.assets') }}</span><div class="actions"><span class="plus">+</span> {{ t('common.create') }}</div></div>
      <div class="search-row"><div class="search-input-wrapper"><svg class="search-icon-sm" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" :placeholder="t('common.search')" v-model="searchText" /></div><div class="filter-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg></div></div>



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
              <span class="group-name">
                <span class="classification-code">{{ group.code }}</span>
                <span v-if="group.description" class="classification-desc">{{ group.description }}</span>
              </span>
              <span class="group-count">{{ group.items.length }}</span>
            </div>
          </div>
          
          <div v-show="expandedGroups[index]" class="tree-items">
            <div
              v-for="item in group.items"
              :key="item.dbId"
              :data-dbid="item.dbId"
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
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  assets: { type: Array, default: () => [] },
  selectedDbIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['open-properties', 'assets-selected']);

// 搜索文本
const searchText = ref('');

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
    // 使用分类编码作为 key
    const classificationCode = asset.classification || asset.classification_code || t('assetPanel.uncategorized');
    const classificationDesc = asset.classification_desc || '';
    
    if (!tree[classificationCode]) {
      tree[classificationCode] = {
        code: classificationCode,
        description: classificationDesc,
        items: []
      };
    }
    tree[classificationCode].items.push(asset);
  });

  return Object.keys(tree).sort().map(key => ({
    code: tree[key].code,
    description: tree[key].description,
    name: tree[key].code, // 保持后向兼容
    items: tree[key].items
  }));
});

// 过滤后的树形结构
// 过滤后的树形结构
const filteredTree = computed(() => {
  if (!searchText.value) {
    return assetTree.value;
  }
  
  const search = searchText.value.toLowerCase();
  return assetTree.value.map(group => ({
    ...group, // 保留 group 的所有原始属性 (code, description 等)
    items: group.items.filter(item => 
      (item.name || '').toLowerCase().includes(search) || 
      (item.mcCode || '').toLowerCase().includes(search) ||
      (item.classification_code || '').toLowerCase().includes(search) ||
      (item.classification_desc || '').toLowerCase().includes(search) ||
      // 同时如果搜索词匹配该组的分类描述，也应该显示该组的所有项吗？
      // 用户需求是"将资产分类编码、分类描述也加入检索范围"
      // 通常是指搜这些词能出结果。
      // 上面的 item.classification_code 检查已经覆盖了 item 级别。
      // 如果 item 自身没有这些字段，而是继承自 group？
      // 在 App.vue 中 asset 对象就有 classification_code/desc，所以上面的 item 检查是正确的。
      (group.code || '').toLowerCase().includes(search) ||
      (group.description || '').toLowerCase().includes(search)
    )
  })).filter(group => group.items.length > 0);
});

// 监听搜索结果变化，自动展开所有分组
watch(filteredTree, (val) => {
  if (searchText.value && val.length > 0) {
    const newState = {};
    val.forEach((_, idx) => newState[idx] = true);
    expandedGroups.value = newState;
  }
});

// 选中的资产 dbId 数组（由父级传入以在视图切换时保留）
const selectedDbIdsLocal = ref([...(props.selectedDbIds || [])]);

// 同步父级选择（视图切换或外部更新）
watch(() => props.selectedDbIds, (val) => {
  selectedDbIdsLocal.value = [...(val || [])];
});
// 当资产列表变化时，过滤不存在的选择
watch(assetTree, (tree) => {
  const ids = new Set(tree.flatMap(g => g.items.map(i => i.dbId)));
  selectedDbIdsLocal.value = selectedDbIdsLocal.value.filter(id => ids.has(id));
});

// 判断某个 dbId 是否被选中
const isSelected = (dbId) => {
  return selectedDbIdsLocal.value.includes(dbId);
};

// 选择/取消选择资产
const selectItem = (dbId) => {
  const index = selectedDbIdsLocal.value.indexOf(dbId);
  if (index > -1) {
    selectedDbIdsLocal.value.splice(index, 1);
  } else {
    selectedDbIdsLocal.value.push(dbId);
  }
  emit('assets-selected', selectedDbIdsLocal.value);
  if (selectedDbIdsLocal.value.length > 0) emit('open-properties');
};

// 判断分组是否全选
const isGroupChecked = (group) => {
  if (group.items.length === 0) return false;
  return group.items.every(item => selectedDbIdsLocal.value.includes(item.dbId));
};

// 判断分组是否部分选中
const isGroupIndeterminate = (group) => {
  const selectedCount = group.items.filter(item => selectedDbIdsLocal.value.includes(item.dbId)).length;
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
    group.items.forEach(item => {
      const index = selectedDbIdsLocal.value.indexOf(item.dbId);
      if (index > -1) selectedDbIdsLocal.value.splice(index, 1);
    });
  } else {
    group.items.forEach(item => {
      if (!selectedDbIdsLocal.value.includes(item.dbId)) selectedDbIdsLocal.value.push(item.dbId);
    });
  }
  emit('assets-selected', selectedDbIdsLocal.value);
  if (selectedDbIdsLocal.value.length > 0) emit('open-properties');
};


// 🔑 反向定位：展开包含指定资产的分类并滚动到该资产
// 支持单个或多个资产ID
const expandAndScrollToAsset = (dbIds) => {
  // 统一处理为数组
  const idsArray = Array.isArray(dbIds) ? dbIds : [dbIds];
  
  if (idsArray.length === 0) {
    return;
  }
  
  // 收集所有需要展开的分组索引
  const groupsToExpand = new Set();
  const foundItems = [];
  
  idsArray.forEach(dbId => {
    for (let i = 0; i < assetTree.value.length; i++) {
      const group = assetTree.value[i];
      const item = group.items.find(it => it.dbId === dbId);
      if (item) {
        groupsToExpand.add(i);
        foundItems.push({ dbId, item, groupIndex: i });
        break;
      }
    }
  });
  
  if (foundItems.length === 0) {
    console.warn('⚠️ 未找到任何资产，dbIds:', idsArray);
    return;
  }
  
  // 展开所有相关分组
  groupsToExpand.forEach(index => {
    expandedGroups.value[index] = true;
  });
  
  // 滚动到最后一个找到的资产
  const lastFound = foundItems[foundItems.length - 1];
  
  // 等待DOM更新后滚动到该条目
  nextTick(() => {
    const listContent = document.querySelector('.list-content');
    const targetElement = listContent?.querySelector(`.list-item[data-dbid="${lastFound.dbId}"]`);
    
    if (targetElement && listContent) {
      // 滚动到元素位置，居中显示
      const elementTop = targetElement.offsetTop;
      const elementHeight = targetElement.offsetHeight;
      const containerHeight = listContent.offsetHeight;
      const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
      
      listContent.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      });
      
      console.log(`✅ 已展开 ${groupsToExpand.size} 个分类，滚动到最后一个资产:`, lastFound.item.name);
    }
  });
};

// 暴露方法给父组件
defineExpose({
  expandAndScrollToAsset
});
</script>

<style scoped>
.left-container { display: flex; height: 100%; width: 100%; background: #252526; border-right: 1px solid #1e1e1e; }
.icon-bar { width: 48px; flex-shrink: 0; background: #2b2b2b; border-right: 1px solid #1e1e1e; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.nav-group-top { width: 100%; display: flex; flex-direction: column; align-items: center; padding-top: 8px; }
.nav-group-bottom { width: 100%; display: flex; flex-direction: column; align-items: center; padding-bottom: 8px; }
.nav-item { width: 100%; height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999; cursor: pointer; margin-bottom: 4px; }
.nav-item:hover { background: #333; }
.nav-item.active-blue { border-left: 2px solid #38ABDF; background: #2a2d2e; color: #38ABDF; }
.nav-item.active-blue svg { stroke: #38ABDF; }
.nav-item.disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
.nav-item svg { margin-bottom: 4px; }
.nav-item .label { font-size: 10px; text-align: center; }
.list-panel { flex: 1; display: flex; flex-direction: column; background: #252526; }
.panel-header { height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid #1e1e1e; }
.title { font-size: 11px; font-weight: 600; color: #ccc; text-transform: uppercase; }
.actions { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #888; cursor: pointer; }
.actions:hover { color: #38ABDF; }
.plus { font-size: 14px; font-weight: bold; }
.search-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #1e1e1e; }
.search-input-wrapper { flex: 1; position: relative; }
.search-input-wrapper input { width: 100%; background: #1e1e1e; border: 1px solid #333; border-radius: 3px; padding: 4px 8px 4px 24px; color: #ccc; font-size: 11px; }
.search-input-wrapper input:focus { outline: none; border-color: #38ABDF; }
.search-icon-sm { position: absolute; left: 6px; top: 50%; transform: translateY(-50%); }
.filter-icon { cursor: pointer; padding: 4px; }
.filter-icon:hover svg { stroke: #38ABDF; }

.list-content { flex: 1; overflow-y: auto; }
.tree-group { border-bottom: 1px solid #1e1e1e; }
.tree-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #2a2a2a; }
.tree-header:hover { background: #333; }
.group-checkbox { width: 16px; height: 16px; border: 1px solid #555; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s; cursor: pointer; }
.group-checkbox:hover { border-color: #38ABDF; }
.group-checkbox.checked { background: #38ABDF; border-color: #38ABDF; }
.group-checkbox.indeterminate { background: #555; border-color: #555; }
.group-checkbox svg { width: 12px; height: 12px; stroke: #fff; }
.group-label { flex: 1; display: flex; align-items: center; gap: 8px; cursor: pointer; }
.chevron { transition: transform 0.2s; stroke: #888; }
.chevron.expanded { transform: rotate(90deg); }
.group-name { flex: 1; font-size: 11px; color: #ccc; display: flex; align-items: center; gap: 6px; overflow: hidden; }
.classification-code { font-weight: 600; white-space: nowrap; }
.classification-desc { color: #888; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.classification-desc::before { content: '-'; margin-right: 6px; color: #555; }
.group-count { font-size: 10px; color: #888; background: #1e1e1e; padding: 2px 6px; border-radius: 10px; flex-shrink: 0; }
.tree-items { background: #252526; }
.list-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 32px; cursor: pointer; border-bottom: 1px solid #1e1e1e; }
.list-item:hover { background: #2a2a2a; }
.list-item.selected { background: #2a2d2e; border-left: 2px solid #38ABDF; }
.checkbox { width: 16px; height: 16px; border: 1px solid #555; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.checkbox:hover { border-color: #38ABDF; }
.checkbox.checked { background: #38ABDF; border-color: #38ABDF; }
.checkbox svg { width: 12px; height: 12px; stroke: #fff; }
.item-content { flex: 1; min-width: 0; }
.item-name { font-size: 12px; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-code { font-size: 10px; color: #888; margin-top: 2px; }
.link-icon { flex-shrink: 0; opacity: 0.5; }
.link-icon:hover { opacity: 1; stroke: #38ABDF; }
.empty-state { padding: 40px 20px; text-align: center; color: #666; font-size: 12px; }

/* 滚动条样式 */
.list-content::-webkit-scrollbar { width: 10px; }
.list-content::-webkit-scrollbar-track { background: #1e1e1e; }
.list-content::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 5px; }
.list-content::-webkit-scrollbar-thumb:hover { background: #4e4e52; }
</style>

