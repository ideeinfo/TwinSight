<template>
  <div class="power-network-graph">
    <!-- 工具栏 -->
    <div class="graph-toolbar">
      <el-button-group size="small">
        <el-button @click="fitView" :icon="FullScreen">适应画布</el-button>
        <el-button @click="zoomIn" :icon="ZoomIn">放大</el-button>
        <el-button @click="zoomOut" :icon="ZoomOut">缩小</el-button>
      </el-button-group>
      <el-select v-model="layoutType" size="small" placeholder="布局" style="width: 100px; margin-left: 10px;">
        <el-option label="层次" value="dagre" />
        <el-option label="力导向" value="force" />
        <el-option label="紧凑树" value="compactBox" />
      </el-select>
    </div>
    
    <!-- 图容器 -->
    <div ref="graphContainer" class="graph-container"></div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载电源网络...</span>
    </div>
    
    <!-- 空状态 -->
    <el-empty v-if="!loading && (!graphData.nodes || graphData.nodes.length === 0)" description="暂无电源网络数据" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { Graph } from '@antv/g6';
import { FullScreen, ZoomIn, ZoomOut, Loading } from '@element-plus/icons-vue';
import { getPowerGraph } from '@/api/rds';

// Props
const props = defineProps({
  fileId: {
    type: [Number, String],
    required: true
  },
  // 当节点被点击时的回调
  onNodeClick: {
    type: Function,
    default: null
  }
});

// Emits
const emit = defineEmits(['node-click', 'node-select']);

// Refs
const graphContainer = ref(null);
const loading = ref(false);
const graphData = ref({ nodes: [], edges: [] });
const layoutType = ref('dagre');

// Graph instance
let graph = null;

// 初始化图
const initGraph = () => {
  if (!graphContainer.value) return;
  
  const width = graphContainer.value.clientWidth || 800;
  const height = graphContainer.value.clientHeight || 600;

  graph = new Graph({
    container: graphContainer.value,
    width,
    height,
    autoFit: 'view',
    
    // 布局配置
    layout: getLayoutConfig(layoutType.value),
    
    // 节点配置
    node: {
      type: 'rect',
      style: {
        size: [120, 40],
        radius: 6,
        fill: (d) => d.style?.fill || '#74c0fc',
        stroke: '#228be6',
        lineWidth: 1,
        labelText: (d) => d.label || d.shortCode || '',
        labelFill: '#fff',
        labelFontSize: 12,
        labelPlacement: 'center',
      },
      state: {
        selected: {
          stroke: '#ffd43b',
          lineWidth: 3,
        },
        hover: {
          fill: '#339af0',
        },
      },
    },
    
    // 边配置
    edge: {
      type: 'polyline',
      style: {
        stroke: '#adb5bd',
        lineWidth: 2,
        endArrow: true,
        endArrowSize: 8,
      },
    },
    
    // 交互
    behaviors: ['drag-canvas', 'zoom-canvas', 'click-select'],
  });

  // 事件监听
  graph.on('node:click', (evt) => {
    const nodeData = evt.itemId ? graph.getNodeData(evt.itemId) : null;
    if (nodeData) {
      emit('node-click', nodeData);
      if (props.onNodeClick) {
        props.onNodeClick(nodeData);
      }
    }
  });

  graph.on('node:dblclick', (evt) => {
    const nodeData = evt.itemId ? graph.getNodeData(evt.itemId) : null;
    if (nodeData) {
      emit('node-select', nodeData);
    }
  });
};

// 获取布局配置
const getLayoutConfig = (type) => {
  switch (type) {
    case 'dagre':
      return {
        type: 'dagre',
        rankdir: 'LR', // 从左到右
        nodesep: 40,
        ranksep: 80,
      };
    case 'force':
      return {
        type: 'force',
        preventOverlap: true,
        nodeStrength: -500,
        linkDistance: 150,
      };
    case 'compactBox':
      return {
        type: 'compactBox',
        direction: 'LR',
        getHeight: () => 40,
        getWidth: () => 120,
        getVGap: () => 20,
        getHGap: () => 80,
      };
    default:
      return { type: 'dagre', rankdir: 'LR' };
  }
};

// 加载数据
const loadData = async () => {
  if (!props.fileId) return;
  
  loading.value = true;
  try {
    const res = await getPowerGraph(props.fileId);
    if (res && res.nodes) {
      graphData.value = {
        nodes: res.nodes || [],
        edges: res.edges || []
      };
      
      if (graph && graphData.value.nodes.length > 0) {
        graph.setData(graphData.value);
        await graph.render();
        graph.fitView();
      }
    }
  } catch (err) {
    console.error('加载电源网络失败:', err);
  } finally {
    loading.value = false;
  }
};

// 工具栏方法
const fitView = () => {
  if (graph) graph.fitView();
};

const zoomIn = () => {
  if (graph) {
    const currentZoom = graph.getZoom();
    graph.zoomTo(currentZoom * 1.2);
  }
};

const zoomOut = () => {
  if (graph) {
    const currentZoom = graph.getZoom();
    graph.zoomTo(currentZoom / 1.2);
  }
};

// 窗口大小变化
const handleResize = () => {
  if (graph && graphContainer.value) {
    graph.setSize(graphContainer.value.clientWidth, graphContainer.value.clientHeight);
  }
};

// 监听布局变化
watch(layoutType, async (newType) => {
  if (graph) {
    graph.setLayout(getLayoutConfig(newType));
    await graph.layout();
  }
});

// 监听 fileId 变化
watch(() => props.fileId, () => {
  loadData();
});

// 生命周期
onMounted(async () => {
  await nextTick();
  initGraph();
  loadData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (graph) {
    graph.destroy();
    graph = null;
  }
});

// 暴露方法给父组件
defineExpose({
  refresh: loadData,
  fitView,
  getGraph: () => graph
});
</script>

<style scoped>
.power-network-graph {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar, #1a1a2e);
  border-radius: 8px;
  overflow: hidden;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-header, #16213e);
  border-bottom: 1px solid var(--border-color, #2a2a4a);
}

.graph-container {
  flex: 1;
  min-height: 400px;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary, #888);
}

.loading-overlay .el-icon {
  font-size: 32px;
}
</style>
