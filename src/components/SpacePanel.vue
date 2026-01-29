<template>
  <div class="space-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="title">{{ t('leftPanel.spaces') }}</span>
      <div class="actions">
        <template v-if="selectedSpacesForDeletion.length > 0">
          <span class="selection-count">{{ t('common.selected', { count: selectedSpacesForDeletion.length }) }}</span>
          <el-button 
            type="danger" 
            text 
            size="small" 
            class="delete-btn"
            style="color: #F56C6C !important;"
            @click="handleDeleteSpaces"
          >
           <el-icon><Delete /></el-icon>
            {{ t('common.delete') }}
          </el-button>
        </template>
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
          <div class="tree-node-content" :class="{ 'is-space': data.isSpace }">
            <span class="node-label" :title="node.label">{{ node.label }}</span>
            <span v-if="data.count" class="node-count">{{ data.count }}</span>
            <span v-if="data.code" class="node-code">{{ data.code }}</span>
          </div>
        </template>
      </el-tree-v2>

      <!-- 加载提示 -->
      <div v-if="treeData.length === 0" class="empty-state">
        <p>{{ t('leftPanel.noRooms') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Search, Delete } from '@element-plus/icons-vue';
import { deleteSpaces } from '../services/postgres.js';

const { t } = useI18n();

const props = defineProps({
  spaces: { type: Array, default: () => [] },
  selectedDbIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['open-properties', 'spaces-selected', 'spaces-deleted']);

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

// 构建二级树形数据：楼层 → 空间
const treeData = computed(() => {
  const floorMap = {};
  
  props.spaces.forEach(space => {
    // 第一级：楼层
    const floor = space.floor || t('spacePanel.noFloor');
    const floorKey = floor;
    
    if (!floorMap[floorKey]) {
      floorMap[floorKey] = {
        id: `floor-${floorKey}`,
        label: floor,
        isFloor: true,
        children: []
      };
    }
    
    // 第二级：空间
    if (space.dbId) {
      floorMap[floorKey].children.push({
        id: `space-${space.dbId}`,
        label: space.name || space.code || '未命名空间',
        code: space.code,
        dbId: space.dbId,
        isSpace: true
      });
    }
  });

  // 转换为数组并添加计数，按楼层名称排序
  return Object.values(floorMap)
    .map(floorNode => ({
      ...floorNode,
      count: floorNode.children.length
    }))
    .sort((a, b) => {
      // 尝试按数字排序（如 "1F", "2F"）
      const aNum = parseInt(a.label);
      const bNum = parseInt(b.label);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.label.localeCompare(b.label);
    });
});


// 过滤节点方法
const filterMethod = (value, data) => {
  if (!value) return true;
  const search = value.toLowerCase();
  return data.label.toLowerCase().includes(search) ||
         (data.code || '').toLowerCase().includes(search);
};

// 防抖函数
const debounce = (fn, delay) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

// 选中的空间 ID 列表 (用于删除等操作)
const selectedSpacesForDeletion = ref([]);

// 检查节点是否通过当前搜索过滤
const isNodeVisible = (node) => {
  if (!searchText.value) return true; // 无搜索时所有节点可见
  return filterMethod(searchText.value, node);
};

// 处理节点勾选变化（使用防抖优化性能）
const handleCheckChange = debounce(() => {
  // el-tree-v2 获取选中节点
  const checkedNodes = treeRef.value?.getCheckedNodes(false) || [];
  
  // 🔑 关键修复：只选择当前可见的空间节点
  // 如果有搜索过滤，只包含通过过滤的节点
  const spaceDbIds = checkedNodes
    .filter(node => {
      // 必须是空间节点且有 dbId
      if (!node.isSpace || !node.dbId) return false;
      // 必须通过当前搜索过滤
      return isNodeVisible(node);
    })
    .map(node => node.dbId);
  
  selectedSpacesForDeletion.value = spaceDbIds; // 记录选中用于删除

  emit('spaces-selected', spaceDbIds);
  if (spaceDbIds.length > 0) {
    emit('open-properties');
  }
}, 100);

// 🔑 监听搜索文本变化
// 1. 过滤树节点
// 2. 重新计算选中状态，确保模型隔离只显示可见的选中空间
watch(searchText, (val) => {
  // 先执行过滤
  treeRef.value?.filter(val);
  // 等待过滤完成后再计算选中状态
  setTimeout(() => handleCheckChange(), 150);
});

// 删除选中的空间
const handleDeleteSpaces = async () => {
    const count = selectedSpacesForDeletion.value.length;
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
        await deleteSpaces(selectedSpacesForDeletion.value);
        
        ElMessage.success(t('common.deleteSuccess') || '删除成功');
        
        // 触发父组件刷新列表
        emit('spaces-deleted');
    } catch (error) {
        if (error !== 'cancel') {
            console.error('删除失败:', error);
            ElMessage.error(t('common.deleteFailed') || '删除失败: ' + error.message);
        }
    }
};

// 处理节点点击
const handleNodeClick = (data) => {
  // 只有点击空间节点才触发选择切换
  if (data.isSpace && data.dbId) {
    const isChecked = treeRef.value?.getCheckedKeys().includes(data.id);
    treeRef.value?.setChecked(data.id, !isChecked); 
    handleCheckChange();
  }
};

// 反向定位：展开并滚动到指定空间
const expandAndScrollToSpace = (dbIds) => {
  const idsArray = Array.isArray(dbIds) ? dbIds : [dbIds];
  if (idsArray.length === 0) return;
  
  // 设置选中状态
  const nodeIds = idsArray.map(dbId => `space-${dbId}`);
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
  }
};

// 同步外部选择状态
watch(() => props.selectedDbIds, (dbIds) => {
  if (treeRef.value) {
    const nodeIds = (dbIds || []).map(dbId => `space-${dbId}`);
    treeRef.value.setCheckedKeys(nodeIds);
  }
}, { immediate: true });

// 暴露方法给父组件
defineExpose({
  expandAndScrollToSpace
});
</script>

<style scoped>
.space-panel {
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

.tree-node-content.is-space {
  gap: 8px;
}

.node-label {
  font-size: 12px;
  color: var(--list-item-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 非空间节点（楼层）：Label 占据剩余空间，将 Count 推到最右侧 */
.tree-node-content:not(.is-space) .node-label {
  flex: 1;
}

/* 空间节点：Label 自适应宽度，Code 紧随其后 */
.tree-node-content.is-space .node-label {
  flex: 0 1 auto; /* 不强制占满 */
  max-width: 60%; /* 防止过长挤掉 Code */
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

:deep(.el-tree-v2 .el-tree-node) {
  background-color: transparent !important;
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
