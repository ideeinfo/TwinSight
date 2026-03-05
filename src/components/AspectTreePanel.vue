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
        v-model="inputValue"
        :placeholder="t('common.search')"
        :prefix-icon="Search"
        clearable
        size="small"
        autocomplete="off"
        name="aspect-search"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
    </div>

    <!-- 树形列表 -->
    <div ref="treeContainer" class="tree-content">
      <!-- 只有非电源或强制显示树时才渲染树 -->
      <el-tree-v2
        v-if="activeAspect !== 'power' && containerHeight > 0"
        :key="activeAspect"
        ref="treeRef"
        :data="filteredTreeData"
        :props="treeProps"
        :height="containerHeight"
        :item-size="36"
        node-key="uitreeId"
        show-checkbox
        :expand-on-click-node="false"
        :expanded-keys="expandedKeys"
        @check-change="handleCheckChange"
        @node-click="handleNodeClick"
      >
        <template #default="{ node, data }">
          <div class="tree-node-content" :class="{ 'is-leaf': !data.children?.length }">
            <span 
              class="node-label" 
              :class="{ 'has-model': data.mcCode }"
              :title="data.name || data.code"
            >
              {{ data.name || data.code }}
            </span>
            <span v-if="data.code" class="node-code">{{ data.code }}</span>
            <!-- 图标已移除，改为文字高亮 -->
            <span v-if="data.childCount" class="node-count">{{ data.childCount }}</span>
          </div>
        </template>
      </el-tree-v2>

      <!-- 电源网络图 -->
      <PowerNetworkGraph
        v-if="activeAspect === 'power'"
        ref="powerGraphRef"
        :file-id="fileId"
        :search-text="searchText"
        @node-click="handleGraphNodeClick"
        @trace-complete="handleTraceComplete"
        @trace-clear="handleTraceClear"
      />

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
      <span class="selection-count">
        {{ t('common.selected', { count: selectedCodes.length }) }}
      </span>
      <!-- 按钮已移除，改为自动高亮 -->
      <el-button 
        text 
        size="small"
        :disabled="!canTrace"
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
import PowerNetworkGraph from './PowerNetworkGraph.vue';

const { t } = useI18n();

const props = defineProps({
  fileId: { type: Number, required: true },
  initialAspect: { type: String, default: AspectType.FUNCTION }
});

const emit = defineEmits([
  'codes-selected',
  'highlight-guids',
  'trace-result',
  'trace-complete',
  'trace-clear'
]);

// ==================== 状态 ====================

// 当前激活的方面类型
const activeAspect = ref(props.initialAspect);

// 方面类型标签和前缀
const aspectLabels = AspectTypeLabels;
const aspectPrefixes = AspectTypePrefixes;

// 搜索文本
// const searchText = ref(''); // (已移动到下方与 inputValue 一起管理)

// 加载状态
const loading = ref(false);

// 树数据 (原始)
const treeData = ref([]);

// 选中的编码
const selectedCodes = ref([]);

// 树组件引用
const treeRef = ref(null);
const treeContainer = ref(null);
const powerGraphRef = ref(null); // 新增图组件引用
const containerHeight = ref(0);
const expandedKeys = ref([]); // 展开的节点 keys

// 树组件配置
const treeProps = {
  value: 'uitreeId', // 使用前端生成的唯一 ID，避免 ID 重复导致的多选联动
  label: 'name',
  children: 'children'
};

// ==================== 计算属性
// 搜索相关
const inputValue = ref(''); // 输入框的值
const searchText = ref(''); // 实际生效的搜索词 (Enter 后更新)

const handleSearch = () => {
  searchText.value = inputValue.value;
  // 如果是电源图，searchText 变化会自动触发 Graph 组件的 watch
};

// 监听 activeAspect 变化，切换时清空搜索和展开状态
watch(activeAspect, () => {
  inputValue.value = '';
  searchText.value = '';
  expandedKeys.value = []; // 重置展开状态，避免跨 Aspect 干扰
});

// 计算属性：过滤后的树数据
const filteredTreeData = computed(() => {
  if (!searchText.value) return treeData.value;

  const search = searchText.value.toLowerCase();
  
  const filterNode = (nodes) => {
    let hasMatch = false;
    const result = [];
    // console.log(`🔍 [AspectTree] 过滤节点: ${nodes.length} 个, 关键词: ${search}`);
    
    if (!nodes) return { nodes: [], hasMatch: false };
    
    for (const node of nodes) {
      const name = (node.name || '').toLowerCase();
      const code = (node.code || '').toLowerCase();
      const mcCode = (node.mcCode || '').toLowerCase(); // 增加对关联编码的搜索
      
      const isMatch = name.includes(search) || code.includes(search) || mcCode.includes(search);
      
      let childrenMatch = false;
      let filteredChildren = [];
      
      if (node.children && node.children.length > 0) {
        const childResult = filterNode(node.children);
        filteredChildren = childResult.nodes;
        childrenMatch = childResult.hasMatch;
      }
      
      if (isMatch || childrenMatch) {
         hasMatch = true;
         result.push({
           ...node,
           children: filteredChildren
         });
      }
    }
    return { nodes: result, hasMatch };
  };

  const { nodes } = filterNode(treeData.value);
  // console.log(`🔍 [AspectTree] 过滤结果: ${nodes.length} 个顶级节点`);
  return nodes;
});

// 监听过滤后的数据变化，如果是由搜索触发的，则自动展开
watch(filteredTreeData, (newData) => {
    if (searchText.value && newData.length > 0) {
        console.log(`📂 [AspectTree] 搜索结果更新，准备展开 ${newData.length} 个顶级节点`);
        // 收集所有需要展开的节点 keys
        const keys = [];
        const traverse = (list) => {
            for (const node of list) {
                if (node.children && node.children.length > 0) {
                    keys.push(node.uitreeId);
                    traverse(node.children);
                }
            }
        };
        traverse(newData);
        console.log(`📂 [AspectTree] 收集到 ${keys.length} 个需要展开的节点`);
        
        // 方法1: 更新 expandedKeys ref (响应式绑定)
        expandedKeys.value = keys;
        
        // 方法2: 使用 setTimeout + setExpandedKeys (作为补充)
        setTimeout(() => {
            if (treeRef.value && treeRef.value.setExpandedKeys) {
                console.log(`📂 [AspectTree] 调用 setExpandedKeys 展开 ${keys.length} 个节点`);
                treeRef.value.setExpandedKeys(keys);
            }
        }, 300);
    } else if (!searchText.value) {
        // 清空搜索时，折叠所有节点
        expandedKeys.value = [];
    }
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
  // 切换模块或关闭面板时，强制清除追溯状态（如果存在）
  emit('trace-clear');
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
      console.log('🌳 [AspectTree] 数据加载成功. 首个节点示例:', response.data[0]);
      
      // 递归处理节点，生成前端唯一的 UI ID
      const processNodes = (nodes) => {
        return nodes.map(node => ({
          ...node,
          // 原始 id 可能在不同分支重复（引用同一对象），导致 Tree 组件多选联动
          // 生成一个前端专用的唯一 ID 作为 node-key
          uitreeId: `${node.id || 'temp'}_${Math.random().toString(36).substr(2, 9)}`,
          // 确保 id 存在 (虽然这里不再用作 key，但业务逻辑需要)
          id: node.id || `temp_${Math.random().toString(36).substr(2, 9)}`,
          childCount: node.children?.length || 0,
          children: node.children ? processNodes(node.children) : []
        }));
      };
      
      treeData.value = processNodes(response.data);
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
  // 关键修改：存储 ID 而不是 code 或 refCode
  selectedCodes.value = checkedNodes.map(node => node.id);
  
  // 调试日志
  if (selectedCodes.value.length > 0) {
     console.log(`✅ [AspectTree] 选中 ${selectedCodes.value.length} 个节点 (ID). 示例:`, selectedCodes.value[0]);
  }
  
  emit('codes-selected', selectedCodes.value);

  // 立即触发高亮 (支持多选叠加)
  highlightInViewer();
}

/**
 * 处理节点点击
 */
function handleNodeClick(data) {
  // data 是节点对象，使用 uitreeId 作为 key
  const key = data.uitreeId;
  const isChecked = treeRef.value?.getCheckedKeys().includes(key);
  treeRef.value?.setChecked(key, !isChecked);
  handleCheckChange();
  
  // 🛠️ 只有当点击叶子节点时，且之前没有选中时（即本次操作是选中），
  // 可以考虑自动触发一次高亮，提升用户体验（可选）
  // 但目前先保持手动与多选逻辑一致
}

/**
 * 在模型中高亮选中的编码
 */
async function highlightInViewer() {
  if (selectedCodes.value.length === 0) {
    // 如果没有选中项，发送空事件以清除高亮
    console.log('🧹 [AspectTree] 没有选中项，发送清除高亮请求');
    emit('highlight-guids', { guids: [], refCodes: [], searchQueries: [] });
    return;
  }
  
  console.log('🔍 [AspectTree] 开始执行高亮查找 (基于 ID)...');
  
  try {
    const allGuids = [];
    const componentCodes = [];
    const roomCodes = [];
    
    // 构建父节点映射以便查找上级
    const parentMap = new Map();
    // 构建 ID 到节点的映射以便快速查找
    const nodeMap = new Map();
    
    // 使用 String(id) 确保 Map 键值类型一致，避免 string/number 混用导致查找失败
    const indexNodes = (nodes, parent = null) => {
      nodes.forEach(node => {
        if (node.id) nodeMap.set(String(node.id), node);
        if (parent && parent.id) parentMap.set(String(node.id), parent);
        if (node.children) indexNodes(node.children, node);
      });
    };
    indexNodes(treeData.value);

    // 递归收集子节点的 MC编码
    const collectDescendantCodes = (node, targetList) => {
      if (node.mcCode) targetList.push(node.mcCode);
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => collectDescendantCodes(child, targetList));
      }
    };

    // 遍历所有选中的节点 ID
    for (const rawId of selectedCodes.value) {
      const id = String(rawId);
      const node = nodeMap.get(id);
      
      if (!node) {
        console.warn(`⚠️ [AspectTree] 未找到 ID 为 ${id} 的节点，跳过高亮处理`);
        continue;
      }

      // 收集 GUID
      if (node.bimGuid) allGuids.push(node.bimGuid);
      
      // 注意：Element Tree 默认级联选中。如果父节点被选中，意味着其所有子节点也已被选中（并存在于 selectedCodes 中）。
      // 因此无需在此递归收集子节点，否则会导致处理重复，且逻辑上“选谁高亮谁”更为清晰。

      // 处理不同方面的逻辑
      const isLocation = activeAspect.value === AspectType.LOCATION;
      const isLeaf = !node.children || node.children.length === 0;

      if (isLocation) {
        // --- 位置树逻辑 ---
        if (isLeaf) {
          // 1. 叶子节点：作为构件
          if (node.mcCode) componentCodes.push(node.mcCode);
          
          // 2. 上级节点：作为房间
          const parent = parentMap.get(id);
          if (parent && parent.mcCode) {
            console.log(`🏠 [AspectTree] 找到位置节点 ${node.name} 的上级房间: ${parent.name} (${parent.mcCode})`);
            roomCodes.push(parent.mcCode);
          }
        } else {
          // 1. 非叶子节点：本身作为房间
          if (node.mcCode) roomCodes.push(node.mcCode);
        }
      } else {
        // --- 工艺/电源树逻辑 ---
        if (node.mcCode) componentCodes.push(node.mcCode);
      }
    }
    
    // 去重
    const uniqueGuids = [...new Set(allGuids)];
    const uniqueComponentCodes = [...new Set(componentCodes)];
    const uniqueRoomCodes = [...new Set(roomCodes)];
    
    console.log(`📊 [AspectTree] 查找结果: GUIDs=${uniqueGuids.length}, Components=${uniqueComponentCodes.length}, Rooms=${uniqueRoomCodes.length}`);
    if (uniqueComponentCodes.length > 0) console.log('  🔩 Components:', uniqueComponentCodes.slice(0, 5));
    if (uniqueRoomCodes.length > 0) console.log('  🏠 Rooms:', uniqueRoomCodes);

    if (uniqueGuids.length > 0 || uniqueComponentCodes.length > 0 || uniqueRoomCodes.length > 0) {
      // 构造多重查询 Payload
      const searchQueries = [];
      
      if (uniqueComponentCodes.length > 0) {
        searchQueries.push({
          values: uniqueComponentCodes,
          attributes: ['MC编码', 'MC Code', 'DeviceCode', '设备编码', 'Tag Number']
        });
      }
      
      if (uniqueRoomCodes.length > 0) {
        searchQueries.push({
          values: uniqueRoomCodes,
          attributes: ['编号', 'Number', 'Mark', 'Room Number']
        });
      }

      emit('highlight-guids', { 
        guids: uniqueGuids, 
        // 兼容旧RefCodes (设为组件代码)
        refCodes: uniqueComponentCodes, 
        // 新增查询结构
        searchQueries: searchQueries
      });
      
      const count = uniqueGuids.length + uniqueComponentCodes.length + uniqueRoomCodes.length;
      ElMessage.success(t('rds.highlightCount', { count: count }));
    } else {
      ElMessage.warning(t('rds.noGuidFound'));
    }
  } catch (error) {
    console.error('收集高亮数据失败:', error);
    ElMessage.error(t('rds.highlightFailed'));
  }
}

/**
 * 追溯能力检查
 */
const canTrace = computed(() => {
  // 允许选中多个节点，但在追溯时会自动选择层级最深（最具体）的一个作为起点
  // 这解决了父子节点同时被选中（级联选择）导致无法追溯的问题
  return selectedCodes.value.length > 0;
});

/**
 * 追溯上游电源
 */
async function traceUpstream() {
  if (!canTrace.value) {
    ElMessage.warning(t('rds.selectOneToTrace'));
    return;
  }
  
  // 获取所有选中的节点数据对象
  const checkedNodes = treeRef.value?.getCheckedNodes() || [];
  if (checkedNodes.length === 0) return;
  
  // 按层级降序排序 (Level 大的在前 -> 更深/更具体的节点)
  // 如果层级相同，任意取一个
  checkedNodes.sort((a, b) => (b.level || 0) - (a.level || 0));
  
  const startNode = checkedNodes[0];
  // 必须使用 node.id 而不是 uitreeId (key)，因为后端只认数据库 ID
  const startId = String(startNode.id);
  
  console.log(`🔌 [AspectTree] 开始追溯上游`);
  if (checkedNodes.length > 1) {
    console.log(`ℹ️ [AspectTree] 选中了多个节点，自动选择最深层级节点作为起点: ${startNode.name} (Level ${startNode.level})`);
  }
  
  try {
    const response = await traceTopology(
      startId,
      TraceDirection.UPSTREAM
    );
    
    // Logic Engine 直接返回 { nodes: [], total: 0 }，不包含 success 字段
    // 所以只要 nodes 存在且数组长度 > 0 即视为成功
    if (response && response.nodes && response.nodes.length > 0) {
      console.log('🔗 [AspectTree] 追溯 API 返回:', response.nodes);
      
      // 过滤出上游节点 (排除自身)
      // 注意：API 返回的 ID 类型可能与 startId 类型不一致 (Number vs String)，统一转为 String 比较
      const upstreamIds = response.nodes
        .filter(n => String(n.id) !== startId)
        .map(n => String(n.id));
      
      if (upstreamIds.length === 0) {
        console.warn('⚠️ [AspectTree] 追溯结果仅包含起点自身，无上游节点');
        ElMessage.warning(t('rds.noUpstreamFound'));
        return;
      }

      console.log('🎯 [AspectTree] 准备选中上游节点ID:', upstreamIds);
      
      // 检查这些 ID 是否在当前树中存在（防止选中了不在视图中的节点导致报错或无反应）
      // 简单的检查方式是看 highlightInViewer 能否找到它们，但这里我们先强制选中
      
      // 2. 自动选中上游节点 (保留当前选中，叠加显示)
      const currentSelection = selectedCodes.value.map(String);
      const newSelection = [...new Set([...currentSelection, ...upstreamIds])];
      
      selectedCodes.value = newSelection;
      treeRef.value?.setCheckedKeys(newSelection);
      
      // 3. 触发高亮孤立逻辑
      setTimeout(async () => {
         await highlightInViewer();
      }, 0);
      
      ElMessage.success(t('rds.traceSuccess', { count: upstreamIds.length }));
      
    } else {
      console.warn('⚠️ [AspectTree] 追溯未找到结果或失败:', response);
      ElMessage.warning(response.error || t('rds.noUpstreamFound'));
    }
  } catch (error) {
    console.error('❌ 追溯失败:', error);
    ElMessage.error(t('rds.traceFailed'));
  }
}

/**
 * 展开并定位到指定编码
 */
/**
 * 展开并定位到指定编码
 */
function expandAndScrollToCode(code) {
  if (!code) return;
  
  treeRef.value?.setCheckedKeys([code]);
  selectedCodes.value = [code];
  emit('codes-selected', selectedCodes.value);
}

/**
 * 根据 MC 编码列表反选树节点 (用于模型联动)
 */
function selectByMcCodes(mcCodes) {
  if (!mcCodes || mcCodes.length === 0) {
    // 如果传入空列表，清除选中 (除非你想保留)
    // 这里选择不清除，保持现状，或者根据需求清除
    return;
  }
  
  const targetMcCodes = new Set(mcCodes);
  const matchedUiTreeIds = [];
  const expandedUiTreeIds = new Set();
  
  // 递归查找匹配的节点及其路径
  const findAndCollect = (nodes, parentPathIds = []) => {
    for (const node of nodes) {
      if (node.mcCode && targetMcCodes.has(node.mcCode)) {
        matchedUiTreeIds.push(node.uitreeId);
        // 将路径上的所有父节点 ID 加入展开列表
        parentPathIds.forEach(id => expandedUiTreeIds.add(id));
      }
      
      if (node.children && node.children.length > 0) {
        findAndCollect(node.children, [...parentPathIds, node.uitreeId]);
      }
    }
  };
  
  findAndCollect(treeData.value);
  
  if (matchedUiTreeIds.length > 0) {
    console.log(`🔗 [AspectTree] 根据 MC 编码联动选中 ${matchedUiTreeIds.length} 个节点`);
    
    if (treeRef.value) {
      // 使用 nextTick 确保组件状态同步，并添加 try-catch 防止内部错误崩溃
      import('vue').then(({ nextTick }) => {
        nextTick(() => {
          try {
            // 1. 展开父节点
            if (treeRef.value?.setExpandedKeys) {
               console.log(`📂 [AspectTree] 展开 ${expandedUiTreeIds.size} 个父节点`);
               treeRef.value.setExpandedKeys(Array.from(expandedUiTreeIds));
            }
            
            // 2. 选中目标节点
            selectedCodes.value = matchedUiTreeIds;
            if (treeRef.value?.setCheckedKeys) {
               console.log(`☑️ [AspectTree] 勾选 ${matchedUiTreeIds.length} 个目标节点`);
               treeRef.value.setCheckedKeys(matchedUiTreeIds);
            }
          } catch (err) {
            console.error('❌ [AspectTree] 联动选中失败 (el-tree-v2 内部错误):', err);
          }
        });
      });
    }
    // 但我们需要 update selectedCodes 以便 Trace 功能可用
  } else {
    console.log('ℹ️ [AspectTree] 未找到匹配的 MC 编码节点');
  }
}

/**
 * 处理电源图节点点击
 */
function handleGraphNodeClick(nodeData) {
  console.log('⚡️ [AspectTree] 电源图节点点击:', nodeData);
  
  if (!nodeData) return;
  
  // 1. 高亮 BIM 模型
  const guids = [];
  const searchQueries = [];
  
  if (nodeData.bimGuid) {
    guids.push(nodeData.bimGuid);
  }
  
  if (nodeData.mcCode) {
    searchQueries.push({
      values: [nodeData.mcCode],
      attributes: ['MC编码', 'MC Code', 'DeviceCode', '设备编码', 'Tag Number']
    });
  }
  
  if (guids.length > 0 || searchQueries.length > 0) {
    emit('highlight-guids', {
      guids,
      refCodes: nodeData.mcCode ? [nodeData.mcCode] : [],
      searchQueries
    });
  }
}

/**
 * 处理电源追溯完成事件
 */
function handleTraceComplete(traceData) {
  console.log('⚡️ [AspectTree] 电源追溯完成:', traceData);
  // 转发给 MainView 进行 BIM 可视化
  emit('trace-complete', traceData);
}

/**
 * 处理电源追溯清除事件
 */
function handleTraceClear() {
  console.log('⚡️ [AspectTree] 电源追溯清除');
  // 转发给 MainView 清除覆盖层
  emit('trace-clear');
}

/**
 * 切换到电源方面并执行追溯 (AI)
 */
async function switchToPowerAndTrace(mcCode) {
    if (activeAspect.value !== 'power') {
        activeAspect.value = 'power';
        await import('vue').then(v => v.nextTick());
        // 轮询等待 PowerGraph 组件挂载（最多 5 秒，每 100ms 检查一次）
        for (let i = 0; i < 50; i++) {
            if (powerGraphRef.value?.selectNodeByMcCode) break;
            await new Promise(r => setTimeout(r, 100));
        }
    }
    
    if (powerGraphRef.value && powerGraphRef.value.selectNodeByMcCode) {
        return await powerGraphRef.value.selectNodeByMcCode(mcCode);
    } else {
        console.warn('PowerGraph ref not ready after 5s');
        return false;
    }
}

// 暴露方法给父组件
defineExpose({
  refreshData,
  expandAndScrollToCode,
  selectByMcCodes,
  switchToPowerAndTrace
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

.node-label.has-model {
  color: #ff9800; /* 橙色高亮，表示关联了模型 */
  font-weight: 500;
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

/* .model-icon removed */

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
