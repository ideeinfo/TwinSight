<template>
  <div class="aspect-tree-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="title">{{ t('rds.aspectTree') }}</span>
      <div class="actions">
        <el-tooltip :content="t('rds.refreshTree')">
          <el-button text size="small" @click="refreshData">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 方面类型切换 -->
    <div class="aspect-tabs">
      <el-radio-group v-model="activeAspect" size="small" @change="handleAspectChange">
        <el-radio-button 
          v-for="(label, type) in aspectLabels" 
          :key="type" 
          :value="type"
        >
          <span class="aspect-prefix">{{ aspectPrefixes[type] }}</span>
          {{ label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 搜索栏 -->
    <div class="search-row">
      <el-input
        v-model="searchText"
        :placeholder="t('common.search')"
        :prefix-icon="Search"
        clearable
        size="small"
      />
    </div>

    <!-- 树形列表 -->
    <div ref="treeContainer" class="tree-content">
      <el-tree-v2
        v-if="containerHeight > 0"
        ref="treeRef"
        :data="filteredTreeData"
        :props="treeProps"
        :height="containerHeight"
        :item-size="36"
        node-key="code"
        show-checkbox
        :expand-on-click-node="false"
        @check-change="handleCheckChange"
        @node-click="handleNodeClick"
      >
        <template #default="{ node, data }">
          <div class="tree-node-content" :class="{ 'is-leaf': !data.children?.length }">
            <span class="node-label" :title="data.name || data.code">
              {{ data.name || data.code }}
            </span>
            <span v-if="data.code" class="node-code">{{ data.code }}</span>
            <span v-if="data.childCount" class="node-count">{{ data.childCount }}</span>
          </div>
        </template>
      </el-tree-v2>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <p>{{ t('common.loading') }}</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && treeData.length === 0" class="empty-state">
        <p>{{ t('rds.noData') }}</p>
      </div>
    </div>

    <!-- 已选中统计 -->
    <div v-if="selectedCodes.length > 0" class="selection-bar">
      <span class="selection-count">
        {{ t('common.selected', { count: selectedCodes.length }) }}
      </span>
      <el-button 
        type="primary" 
        text 
        size="small"
        @click="highlightInViewer"
      >
        <el-icon><View /></el-icon>
        {{ t('rds.highlightInModel') }}
      </el-button>
      <el-button 
        text 
        size="small"
        @click="traceUpstream"
      >
        <el-icon><Top /></el-icon>
        {{ t('rds.traceUpstream') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Search, Refresh, View, Top, Loading } from '@element-plus/icons-vue';
import { 
  getAspectHierarchy, 
  getBimGuidsByCode,
  traceTopology,
  AspectType, 
  AspectTypeLabels, 
  AspectTypePrefixes,
  TraceDirection
} from '../api/rds.js';

const { t } = useI18n();

const props = defineProps({
  fileId: { type: Number, required: true },
  initialAspect: { type: String, default: AspectType.FUNCTION }
});

const emit = defineEmits([
  'codes-selected',
  'highlight-guids',
  'trace-result'
]);

// ==================== 状态 ====================

// 当前激活的方面类型
const activeAspect = ref(props.initialAspect);

// 方面类型标签和前缀
const aspectLabels = AspectTypeLabels;
const aspectPrefixes = AspectTypePrefixes;

// 搜索文本
const searchText = ref('');

// 加载状态
const loading = ref(false);

// 树数据 (原始)
const treeData = ref([]);

// 选中的编码
const selectedCodes = ref([]);

// 树组件引用
const treeRef = ref(null);
const treeContainer = ref(null);
const containerHeight = ref(0);

// 树组件配置
const treeProps = {
  value: 'code',
  label: 'name',
  children: 'children'
};

// ==================== 计算属性 ====================

// 过滤后的树数据
const filteredTreeData = computed(() => {
  if (!searchText.value) return treeData.value;
  
  const search = searchText.value.toLowerCase();
  
  const filterNode = (node) => {
    const nameMatch = (node.name || '').toLowerCase().includes(search);
    const codeMatch = (node.code || '').toLowerCase().includes(search);
    
    if (nameMatch || codeMatch) {
      return { ...node };
    }
    
    if (node.children) {
      const filteredChildren = node.children
        .map(filterNode)
        .filter(Boolean);
      
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
    }
    
    return null;
  };
  
  return treeData.value
    .map(filterNode)
    .filter(Boolean);
});

// ==================== 生命周期 ====================

let resizeObserver = null;

onMounted(() => {
  // 监听容器尺寸变化
  if (treeContainer.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height;
      }
    });
    resizeObserver.observe(treeContainer.value);
  }
  
  // 加载初始数据
  loadTreeData();
});

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect();
});

// 监听 fileId 变化
watch(() => props.fileId, () => {
  loadTreeData();
});

// ==================== 方法 ====================

/**
 * 加载树数据
 */
async function loadTreeData() {
  if (!props.fileId) {
    treeData.value = [];
    return;
  }
  
  loading.value = true;
  
  try {
    const response = await getAspectHierarchy(props.fileId, activeAspect.value);
    
    if (response.success) {
      // 添加子节点数量
      const addChildCount = (nodes) => {
        return nodes.map(node => ({
          ...node,
          childCount: node.children?.length || 0,
          children: node.children ? addChildCount(node.children) : []
        }));
      };
      
      treeData.value = addChildCount(response.data);
    } else {
      ElMessage.warning(response.error || t('rds.loadFailed'));
      treeData.value = [];
    }
  } catch (error) {
    console.error('加载方面树失败:', error);
    ElMessage.error(t('rds.loadFailed'));
    treeData.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * 刷新数据
 */
function refreshData() {
  loadTreeData();
}

/**
 * 切换方面类型
 */
function handleAspectChange() {
  selectedCodes.value = [];
  loadTreeData();
}

/**
 * 处理节点勾选变化
 */
function handleCheckChange() {
  const checkedNodes = treeRef.value?.getCheckedNodes(false) || [];
  selectedCodes.value = checkedNodes.map(node => node.code);
  emit('codes-selected', selectedCodes.value);
}

/**
 * 处理节点点击
 */
function handleNodeClick(data) {
  const isChecked = treeRef.value?.getCheckedKeys().includes(data.code);
  treeRef.value?.setChecked(data.code, !isChecked);
  handleCheckChange();
}

/**
 * 在模型中高亮选中的编码
 */
async function highlightInViewer() {
  if (selectedCodes.value.length === 0) return;
  
  try {
    // 获取所有选中编码对应的 BIM GUID 和 RefCode
    const allGuids = [];
    const allRefCodes = [];
    
    for (const code of selectedCodes.value) {
      const response = await getBimGuidsByCode(props.fileId, code, true);
      if (response.success) {
        if (response.guids) allGuids.push(...response.guids);
        if (response.refCodes) allRefCodes.push(...response.refCodes);
      }
    }
    
    // 去重
    const uniqueGuids = [...new Set(allGuids)];
    const uniqueRefCodes = [...new Set(allRefCodes)];
    
    if (uniqueGuids.length > 0 || uniqueRefCodes.length > 0) {
      // 传递对象格式 { guids, refCodes }
      emit('highlight-guids', { guids: uniqueGuids, refCodes: uniqueRefCodes });
      
      const count = uniqueGuids.length + uniqueRefCodes.length;
      ElMessage.success(t('rds.highlightCount', { count: count }));
    } else {
      ElMessage.warning(t('rds.noGuidFound'));
    }
  } catch (error) {
    console.error('获取 BIM GUID 失败:', error);
    ElMessage.error(t('rds.highlightFailed'));
  }
}

/**
 * 追溯上游电源
 */
async function traceUpstream() {
  if (selectedCodes.value.length === 0) return;
  
  try {
    // 对第一个选中的编码进行追溯
    const response = await traceTopology(
      selectedCodes.value[0],
      TraceDirection.UPSTREAM
    );
    
    if (response.success) {
      emit('trace-result', response.nodes);
      ElMessage.success(t('rds.traceComplete', { count: response.total }));
    } else {
      ElMessage.warning(response.error || t('rds.traceFailed'));
    }
  } catch (error) {
    console.error('追溯失败:', error);
    ElMessage.error(t('rds.traceFailed'));
  }
}

/**
 * 展开并定位到指定编码
 */
function expandAndScrollToCode(code) {
  if (!code) return;
  
  treeRef.value?.setCheckedKeys([code]);
  selectedCodes.value = [code];
  emit('codes-selected', selectedCodes.value);
}

// 暴露方法给父组件
defineExpose({
  refreshData,
  expandAndScrollToCode
});
</script>

<style scoped>
.aspect-tree-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--list-bg);
}

.panel-header {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.title {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  text-transform: uppercase;
}

.aspect-tabs {
  padding: 8px 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.aspect-tabs :deep(.el-radio-group) {
  width: 100%;
  display: flex;
}

.aspect-tabs :deep(.el-radio-button) {
  flex: 1;
}

.aspect-tabs :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 4px 8px;
  font-size: 11px;
}

.aspect-prefix {
  font-family: monospace;
  font-weight: bold;
  margin-right: 4px;
  color: var(--md-sys-color-primary);
}

.search-row {
  padding: 8px 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.tree-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  width: 100%;
  overflow: hidden;
  padding-right: 8px;
}

.tree-node-content.is-leaf {
  gap: 8px;
}

.node-label {
  font-size: 12px;
  color: var(--list-item-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tree-node-content.is-leaf .node-label {
  flex: 0 1 auto;
  max-width: 60%;
}

.node-code {
  font-size: 10px;
  font-family: monospace;
  color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.node-count {
  font-size: 10px;
  color: var(--list-item-text-secondary);
  background: var(--md-sys-color-surface-container-high);
  padding: 2px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.loading-state,
.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}

.loading-state .el-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.selection-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  flex-shrink: 0;
}

.selection-count {
  font-size: 12px;
  color: var(--md-sys-color-primary);
  flex: 1;
}

/* 覆盖 el-tree-v2 样式 */
:deep(.el-tree-v2) {
  background: transparent;
  color: var(--list-item-text);
}

:deep(.el-tree-node__content) {
  box-shadow: inset 0 -1px 0 var(--md-sys-color-outline-variant);
  background-color: transparent;
}

:deep(.el-tree-node__content:hover) {
  background-color: var(--list-item-bg-hover);
}

:deep(.el-checkbox__inner) {
  background-color: transparent;
  border-color: var(--md-sys-color-outline);
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner),
:deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  background-color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
}
</style>
