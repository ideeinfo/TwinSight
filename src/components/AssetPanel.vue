<template>
  <div class="asset-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="title">{{ t('assetPanel.assets') }}</span>
      <div class="actions">
        <template v-if="selectedAssetsForDeletion.length > 0 && authStore.hasPermission('asset:delete')">
          <span class="selection-count">{{ t('common.selected', { count: selectedAssetsForDeletion.length }) }}</span>
          <el-button 
            type="danger" 
            text 
            size="small" 
            class="delete-btn"
            style="color: #F56C6C !important;"
            @click="handleDeleteAssets"
          >
           <el-icon><Delete /></el-icon>
            {{ t('common.delete') }}
          </el-button>
        </template>
        <!-- 移除“+ 创建”按钮 -->
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-row">
      <el-input
        v-model="searchText"
        :placeholder="t('common.search')"
        :prefix-icon="Search"
        clearable
        size="small"
        autocomplete="off"
        name="asset-search"
      />
    </div>

    <!-- 树形列表 (Virtual Scroll) -->
    <div ref="treeContainer" class="tree-content">
      <el-tree-v2
        v-if="containerHeight > 0"
        ref="treeRef"
        :data="treeData"
        :props="treeProps"
        :height="containerHeight"
        :item-size="36"
        :filter-method="filterMethod"
        show-checkbox
        :expand-on-click-node="false"
        @check-change="handleCheckChange"
        @node-click="handleNodeClick"
      >
        <template #default="{ node, data }">
          <div class="tree-node-content" :class="{ 'is-asset': data.isAsset }">
            <span class="node-label" :title="node.label">{{ node.label }}</span>
            <span v-if="data.count" class="node-count">{{ data.count }}</span>
            <span v-if="data.mcCode" class="node-code">{{ data.mcCode }}</span>
          </div>
        </template>
      </el-tree-v2>

      <!-- 加载提示 -->
      <div v-if="treeData.length === 0" class="empty-state">
        <p>{{ t('assetPanel.loading') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Search, Delete } from '@element-plus/icons-vue';
import { deleteAssets } from '../services/postgres.js';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const { t } = useI18n();

const props = defineProps({
  assets: { type: Array, default: () => [] },
  selectedDbIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['open-properties', 'assets-selected', 'assets-deleted']);

// 搜索文本
const searchText = ref('');

// 树组件引用和容器
const treeRef = ref(null);
const treeContainer = ref(null);
const containerHeight = ref(0);

// 树组件配置
const treeProps = {
  value: 'id',
  label: 'label',
  children: 'children'
};

// 动态计算高度
let resizeObserver = null;
onMounted(() => {
  if (treeContainer.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height;
      }
    });
    resizeObserver.observe(treeContainer.value);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect();
});

// 构建三级树形数据：分类编码 → 资产规格 → 资产
const treeData = computed(() => {
  const tree = {};
  
  props.assets.forEach(asset => {
    // 第一级：分类编码
    const classificationCode = asset.classification || asset.classification_code || '未分类';
    const classificationDesc = asset.classification_desc || '';
    const classificationKey = classificationCode;
    
    if (!tree[classificationKey]) {
      tree[classificationKey] = {
        id: `class-${classificationKey}`,
        label: classificationDesc ? `${classificationCode} - ${classificationDesc}` : classificationCode,
        isClassification: true,
        children: {}
      };
    }
    
    // 第二级：资产规格
    const specName = asset.specName || asset.spec_name || '未指定规格';
    const specKey = specName;
    
    if (!tree[classificationKey].children[specKey]) {
      tree[classificationKey].children[specKey] = {
        id: `spec-${classificationKey}-${specKey}`,
        label: specName,
        isSpec: true,
        children: []
      };
    }
    
    // 第三级：资产
    // 确保有 dbId 才能被操作
    if (asset.dbId) {
      tree[classificationKey].children[specKey].children.push({
        id: `asset-${asset.dbId}`,
        label: asset.name || 'Unnamed Asset',
        dbId: asset.dbId,
        mcCode: asset.mcCode,
        isAsset: true
      });
    }
  });

  // 转换为数组并添加计数
  return Object.values(tree).map(classNode => ({
    ...classNode,
    count: Object.values(classNode.children).reduce((sum, spec) => sum + spec.children.length, 0),
    children: Object.values(classNode.children).map(specNode => ({
      ...specNode,
      count: specNode.children.length
    }))
  })).sort((a, b) => a.label.localeCompare(b.label));
});

// 监听搜索文本，过滤树节点
watch(searchText, (val) => {
  treeRef.value?.filter(val);
});

// 过滤节点方法
const filterMethod = (value, data) => {
  if (!value) return true;
  const search = value.toLowerCase();
  return data.label.toLowerCase().includes(search) ||
         (data.mcCode || '').toLowerCase().includes(search);
};

// 防抖函数
const debounce = (fn, delay) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

// 选中的资产 ID 列表 (用于删除等操作)
const selectedAssetsForDeletion = ref([]);

// 处理节点勾选变化（使用防抖优化性能）
const handleCheckChange = debounce(() => {
  // el-tree-v2 获取选中节点的方法不同
  const checkedNodes = treeRef.value?.getCheckedNodes(false) || []; // v2 不支持第二个参数(includeHalfChecked)
  
  const assetDbIds = checkedNodes
    .filter(node => node.isAsset && node.dbId)
    .map(node => node.dbId);
  
  selectedAssetsForDeletion.value = assetDbIds; // 记录选中用于删除

  emit('assets-selected', assetDbIds);
  if (assetDbIds.length > 0) {
    emit('open-properties');
  }
}, 100);

// 删除选中的资产
const handleDeleteAssets = async () => {
    const count = selectedAssetsForDeletion.value.length;
    if (count === 0) return;

    try {
        await ElMessageBox.confirm(
            t('common.confirmDelete', { count }),
            t('common.warning'),
            {
                confirmButtonText: t('common.confirm'),
                cancelButtonText: t('common.cancel'),
                type: 'warning',
            }
        );

        // 调用删除 API
        await deleteAssets(selectedAssetsForDeletion.value);
        
        ElMessage.success(t('common.deleteSuccess') || '删除成功');
        
        // 触发父组件刷新列表
        emit('assets-deleted');
        
        // 不需要手动清空 selectedAssetsForDeletion，
        // 因为父组件刷新 props.assets 后，树会重建，选中状态会重置
    } catch (error) {
        if (error !== 'cancel') {
            console.error('删除失败:', error);
            ElMessage.error(t('common.deleteFailed') || '删除失败: ' + error.message);
        }
    }
};

// 处理节点点击
const handleNodeClick = (data) => {
  // 只有点击资产节点才触发选择切换
  if (data.isAsset && data.dbId) {
    const isChecked = treeRef.value?.getCheckedKeys().includes(data.id);
    treeRef.value?.setChecked(data.id, !isChecked); 
    handleCheckChange();
  }
};

// 反向定位：展开并滚动到指定资产
const expandAndScrollToAsset = (dbIds) => {
  const idsArray = Array.isArray(dbIds) ? dbIds : [dbIds];
  if (idsArray.length === 0) return;
  
  // 设置选中状态
  const nodeIds = idsArray.map(dbId => `asset-${dbId}`);
  treeRef.value?.setCheckedKeys(nodeIds);
  
  // 从 treeData 中查找路径并展开
  const targetId = nodeIds[0];
  const expandPath = [];
  
  const findPath = (nodes, currentPath) => {
    for (const node of nodes) {
      if (node.id === targetId) {
         return true;
      }
      if (node.children) {
        currentPath.push(node.id);
        if (findPath(node.children, currentPath)) {
          return true;
        }
        currentPath.pop();
      }
    }
    return false;
  };
  
  if (findPath(treeData.value, expandPath)) {
    treeRef.value?.setExpandedKeys(expandPath);
    // 等待展开动画
    nextTick(() => {
       // v2 暂不处理精确滚动，展开即可让用户看到
    });
  }
};

// 同步外部选择状态
watch(() => props.selectedDbIds, (dbIds) => {
  if (treeRef.value) {
    const nodeIds = (dbIds || []).map(dbId => `asset-${dbId}`);
    treeRef.value.setCheckedKeys(nodeIds);
  }
}, { immediate: true });

// 暴露方法给父组件
defineExpose({
  expandAndScrollToAsset
});
</script>

<style scoped>
.asset-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* Use list background token */
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

.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--md-sys-color-secondary);
  cursor: pointer;
}

.actions:hover {
  color: var(--md-sys-color-primary);
}

.plus {
  font-size: 14px;
  font-weight: bold;
}

.search-row {
  padding: 8px 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.tree-content {
  flex: 1;
  overflow: hidden; /* 必须隐藏溢出，由虚拟滚动接管 */
  position: relative;
}

/* 适配 el-tree-v2 的内容样式 */
.tree-node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  width: 100%;
  overflow: hidden;
  padding-right: 8px; /* 右侧留白 */
}

.tree-node-content.is-asset {
  gap: 8px;
}

.node-label {
  font-size: 12px;
  color: var(--list-item-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 非资产节点（分类/规格）：Label 占据剩余空间，将 Count 推到最右侧 */
.tree-node-content:not(.is-asset) .node-label {
  flex: 1;
}

/* 资产节点：Label 自适应宽度，Code 紧随其后 */
.tree-node-content.is-asset .node-label {
  flex: 0 1 auto; /* 不强制占满 */
  max-width: 75%; /* 防止过长挤掉 Code */
}

.node-count {
  font-size: 10px;
  color: var(--list-item-text-secondary);
  background: var(--md-sys-color-surface-container-high);
  padding: 2px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.node-code {
  font-size: 10px;
  color: var(--list-item-text-secondary);
  background: var(--md-sys-color-surface-container-high);
  padding: 2px 6px;
  border-radius: 2px;
  flex-shrink: 0;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

/* 覆盖 el-tree-v2 样式以匹配原有设计 */
:deep(.el-tree-v2) {
  background: transparent;
  color: var(--list-item-text);
}

/* 修正选择器：从 .el-tree-v2__content 改为 .el-tree-node__content */
:deep(.el-tree-node__content) {
  position: relative;
  /* 使用内阴影绘制分割线，稳健且层级较高 */
  box-shadow: inset 0 -1px 0 var(--md-sys-color-outline-variant);
  background-color: transparent; /* 默认透明（适配浅色模式） */
}

/* 
  移除了 scoped 中可能不生效的 dark 模式规则
  改为在下方非 scoped 样式块中定义，确保优先级 
*/

:deep(.el-tree-v2 .el-tree-node) {
  background-color: transparent !important;
}
/* 二级节点（规格）样式 - 已统一在 .el-tree-node__content 中设置背景色 */

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

.selection-count {
  font-size: 12px;
  color: var(--md-sys-color-primary);
  margin-right: 8px;
}

.delete-btn {
  padding: 4px 8px;
  color: var(--el-color-danger) !important; /* 强制使用红色，解决浅色主题下看不清的问题 */
}

.delete-btn:hover {
  color: var(--el-color-danger-light-3) !important;
  background-color: var(--el-color-danger-light-9);
}
</style>

<!-- 非 scoped 样式，确保能够覆盖 Element Plus 的内部样式 -->
<style>
/* Remove hardcoded dark mode overrides - rely on tokens */
/* If overrides are still needed for specificity, use html.dark selector */
</style>
