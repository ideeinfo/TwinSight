<template>
  <div class="power-network-graph">
    <!-- 工具栏 -->
    <div class="graph-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">电源拓扑网络</span>
        <el-tag size="small" effect="dark" type="success" v-if="stats.nodes">{{ stats.nodes }} 节点</el-tag>
        <el-tag size="small" effect="dark" type="warning" v-if="isTracing">追溯模式</el-tag>
      </div>
      
      <div class="toolbar-actions">
        <!-- 追溯操作按钮 -->
        <el-button-group v-if="selectedNode">
          <el-tooltip content="追溯上游电源">
            <el-button @click="traceUpstream" size="small" type="primary" :icon="Top">上游</el-button>
          </el-tooltip>
        </el-button-group>
        <el-button v-if="isTracing" @click="clearTrace" size="small" type="warning">清除追溯</el-button>
        <el-divider direction="vertical" v-if="selectedNode || isTracing" />
        
        <el-tooltip content="自适应视图">
          <el-button @click="fitView" circle size="small" :icon="FullScreen" />
        </el-tooltip>
        <el-tooltip content="放大">
          <el-button @click="zoomIn" circle size="small" :icon="ZoomIn" />
        </el-tooltip>
        <el-tooltip content="缩小">
          <el-button @click="zoomOut" circle size="small" :icon="ZoomOut" />
        </el-tooltip>
        <el-divider direction="vertical" />
        <el-select v-model="layoutType" size="small" style="width: 110px" class="layout-select">
          <el-option label="逻辑层级" value="dagre" />
          <el-option label="力导向" value="force" />
          <el-option label="紧凑树" value="compactBox" />
          <el-option label="环形" value="circular" />
        </el-select>
      </div>
    </div>
    
    <!-- 图容器 -->
    <div ref="graphContainer" class="graph-container">
      <!-- 悬浮提示 -->
      <div v-show="tooltip.show" class="graph-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
        <div class="tooltip-title">{{ tooltip.data?.label || tooltip.data?.shortCode }}</div>
        <div class="tooltip-row" v-if="tooltip.data?.fullCode"><span class="label">编码:</span> {{ tooltip.data.fullCode }}</div>
        <div class="tooltip-row" v-if="tooltip.data?.nodeType"><span class="label">类型:</span> {{ getNodeTypeLabel(tooltip.data.nodeType) }}</div>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
      <span>加载电源网络数据...</span>
    </div>
    
    <!-- 空状态 -->
    <div v-if="!loading && (!graphData.nodes || graphData.nodes.length === 0)" class="empty-state">
      <el-empty description="暂无电源网络数据" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, shallowRef } from 'vue';
import { Graph } from '@antv/g6';
import { FullScreen, ZoomIn, ZoomOut, Loading, Top } from '@element-plus/icons-vue';
import { getPowerGraph, tracePowerPath } from '@/api/rds';

// Props
const props = defineProps({
  fileId: {
    type: [Number, String],
    required: true
  },
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
const fullGraphData = ref({ nodes: [], edges: [] }); // 完整数据备份
const stats = ref({ nodes: 0, edges: 0 });
const layoutType = ref('dagre');
const tooltip = ref({ show: false, x: 0, y: 0, data: null });
const selectedNode = ref(null); // 当前选中的节点
const isTracing = ref(false); // 是否处于追溯模式

// Graph instance (use shallowRef to avoid deep reactivity overhead for complex G6 instance)
const graphInstance = shallowRef(null);
let resizeObserver = null;

// ==================== 配置常量 ====================

const NODE_COLORS = {
  source: '#FF4D4F', // 电源 - 红/橙
  bus: '#FAAD14',   // 母线 - 黄
  feeder: '#1890FF', // 馈线/开关 - 蓝
  device: '#52C41A', // 设备 - 绿
  default: '#8C8C8C'
};

const NODE_ICONS = {
  source: '⚡',
  bus: '━',
  feeder: '🔌',
  device: '💡',
  default: '●'
};

// ==================== 初始化与渲染 ====================

const initGraph = () => {
  if (!graphContainer.value) return;
  
  // 清理旧实例
  if (graphInstance.value) {
    graphInstance.value.destroy();
  }

  const { clientWidth, clientHeight } = graphContainer.value;

  const graph = new Graph({
    container: graphContainer.value,
    width: clientWidth,
    height: clientHeight,
    autoFit: 'view',
    background: '#121212', // 深色背景
    
    layout: getLayoutConfig(layoutType.value),
    
    node: {
      style: {
        // 矩形卡片样式
        fill: '#1f1f1f',
        stroke: (d) => getNodeColor(d.nodeType),
        lineWidth: 1,
        shadowColor: (d) => getNodeColor(d.nodeType),
        shadowBlur: 4,
        radius: 4,
        
        // 尺寸: 统一为宽矩形
        size: [180, 42],
        
        // 标签: 图标 + 文字，居中显示
        labelText: (d) => {
          const icon = NODE_ICONS[d.nodeType] || '';
          const text = d.label || d.shortCode || 'Unknown';
          return `${icon}  ${text}`;
        },
        labelFill: '#f0f0f0',
        labelFontSize: 13,
        labelPlacement: 'center',
        background: false, 
        
        // 移除原来的中心大图标配置
        iconText: '', 
        
        // 徽章
        badge: false,
      },
      state: {
        selected: {
          stroke: '#ffffff',
          lineWidth: 2,
          fill: '#2a2a2a',
          shadowBlur: 10,
        },
        active: {
          fill: '#333333',
        },
        inactive: {
          opacity: 0.3,
        }
      },
      palette: {
          type: 'group',
          field: 'nodeType',
      }
    },
    
    edge: {
      type: 'cubic-horizontal',
      style: {
        stroke: '#555',
        lineWidth: 1.5,
        opacity: 0.8,
        endArrow: true,
        endArrowType: 'vee',
        endArrowSize: 8,
        endArrowFill: '#555',
      },
      state: {
        selected: {
          stroke: '#1890FF',
          lineWidth: 2,
          shadowBlur: 5,
          shadowColor: '#1890FF',
        },
      },
    },
    
    plugins: [
        { type: 'grid-line', size: 30, stroke: '#222', lineWidth: 1 }, 
    ],

    behaviors: [
        'drag-canvas', 
        'zoom-canvas', 
        'click-select',
        {
            type: 'hover-activate',
            degree: 1, 
        }
    ],
  });

  // 事件监听: 节点点击
  graph.on('node:click', (evt) => {
    // 空实现 - 使用下面的 click 事件处理
  });
  
  // 补充：手动处理点击
  graph.on('click', (evt) => {
      if (evt.targetType === 'node') {
          const nodeData = graph.getNodeData(evt.target.id);
          if (nodeData) {
              // 设置选中节点
              selectedNode.value = nodeData;
              emit('node-click', nodeData);
              if (props.onNodeClick) props.onNodeClick(nodeData);
          }
      } else if (evt.targetType === 'canvas') {
          tooltip.value.show = false;
          selectedNode.value = null; // 点击画布时取消选中
      }
  });

  // 悬浮提示
  graph.on('node:pointerenter', (evt) => {
    const nodeData = graph.getNodeData(evt.target.id);
    if (nodeData) {
        const { clientX, clientY } = evt; 
        const containerRect = graphContainer.value.getBoundingClientRect();
        
        tooltip.value = {
            show: true,
            x: clientX - containerRect.left + 15,
            y: clientY - containerRect.top + 15,
            data: nodeData
        };
    }
  });

  graph.on('node:pointerleave', () => {
    tooltip.value.show = false;
  });

  graphInstance.value = graph;
};

// 获取布局配置
const getLayoutConfig = (type) => {
  switch (type) {
    case 'dagre':
      return {
        type: 'dagre',
        rankdir: 'LR',
        align: 'UL',
        nodesep: 40,      // 垂直间距
        ranksep: 120,     // 水平间距 (加大以容纳宽节点)
        controlPoints: true, 
      };
    case 'force':
      return {
        type: 'd3-force',
        preventOverlap: true,
        nodeSize: [180, 42],
        linkDistance: 200,
        manyBodyStrength: -800,
      };
    case 'circular':
      return { type: 'circular' };
    case 'compactBox':
      return { type: 'dagre', rankdir: 'TB', nodesep: 40, ranksep: 100 };
    default:
      return { type: 'dagre', rankdir: 'LR' };
  }
};

const getNodeColor = (type) => {
  return NODE_COLORS[type] || NODE_COLORS.default;
};

const getNodeTypeLabel = (type) => {
    const map = {
        'source': '电源',
        'bus': '母线',
        'feeder': '馈线/开关',
        'device': '设备'
    };
    return map[type] || type;
};

// 数据加载
const loadData = async () => {
    if (!props.fileId) return;
    
    loading.value = true;
    isTracing.value = false; // 重新加载时清除追溯模式
    selectedNode.value = null;
    
    try {
        const res = await getPowerGraph(props.fileId);
        if (res && res.nodes) {
            const processedData = {
                nodes: res.nodes.map(n => ({
                    ...n,
                    id: String(n.id), // 确保 ID 为字符串
                    // 样式映射
                    style: {
                        fill: getTypeFill(n.nodeType),
                        stroke: getNodeColor(n.nodeType),
                    }
                })),
                edges: res.edges.map(e => ({
                    source: String(e.source),
                    target: String(e.target),
                    id: String(e.id)
                }))
            };
            
            graphData.value = processedData;
            fullGraphData.value = JSON.parse(JSON.stringify(processedData)); // 备份完整数据
            
            stats.value = {
                nodes: res.nodes.length,
                edges: res.edges.length
            };

            if (graphInstance.value) {
                graphInstance.value.setData(graphData.value);
                await graphInstance.value.render();
                graphInstance.value.fitView();
            }
        }
    } catch (err) {
        console.error('加载电源图失败:', err);
    } finally {
        loading.value = false;
    }
};

const getTypeFill = (type) => {
    // 节点填充色：使用对应颜色的暗色调
    const color = getNodeColor(type);
    // 这里简单处理，实际可用 tinycolor 变暗
    return '#1f1f1f'; 
};

// ==================== 追溯功能 ====================

// 追溯上游电源
const traceUpstream = async () => {
    if (!selectedNode.value || !props.fileId) return;
    
    loading.value = true;
    try {
        // 获取节点的 full_code
        const nodeCode = selectedNode.value.fullCode || selectedNode.value.code || selectedNode.value.id;
        
        const res = await tracePowerPath(props.fileId, nodeCode, { direction: 'upstream' });
        
        if (res && res.nodes) {
            // 构建追溯结果的节点和边
            const traceNodeIds = new Set(res.nodes.map(n => String(n.id)));
            
            // 保留起始节点
            traceNodeIds.add(String(selectedNode.value.id));
            
            // 过滤数据
            const filteredNodes = fullGraphData.value.nodes.filter(n => traceNodeIds.has(n.id));
            const filteredEdges = fullGraphData.value.edges.filter(e => 
                traceNodeIds.has(e.source) && traceNodeIds.has(e.target)
            );
            
            graphData.value = {
                nodes: filteredNodes,
                edges: filteredEdges
            };
            
            isTracing.value = true;
            stats.value = {
                nodes: filteredNodes.length,
                edges: filteredEdges.length
            };
            
            if (graphInstance.value) {
                graphInstance.value.setData(graphData.value);
                await graphInstance.value.render();
                graphInstance.value.fitView();
            }
        }
    } catch (err) {
        console.error('追溯上游电源失败:', err);
    } finally {
        loading.value = false;
    }
};

// 清除追溯，恢复完整图
const clearTrace = async () => {
    if (!fullGraphData.value.nodes.length) return;
    
    graphData.value = JSON.parse(JSON.stringify(fullGraphData.value));
    isTracing.value = false;
    selectedNode.value = null;
    
    stats.value = {
        nodes: graphData.value.nodes.length,
        edges: graphData.value.edges.length
    };
    
    if (graphInstance.value) {
        graphInstance.value.setData(graphData.value);
        await graphInstance.value.render();
        graphInstance.value.fitView();
    }
};

// 工具方法
const fitView = () => graphInstance.value?.fitView();
const zoomIn = () => graphInstance.value?.zoomBy(1.2);
const zoomOut = () => graphInstance.value?.zoomBy(0.8);

// 监听
watch(() => props.fileId, loadData);
watch(layoutType, async (newType) => {
    if (graphInstance.value) {
        graphInstance.value.setLayout(getLayoutConfig(newType));
        await graphInstance.value.layout();
        await graphInstance.value.fitView();
    }
});

// 生命周期
onMounted(async () => {
    await nextTick();
    initGraph();
    loadData();
    
    // 响应式 Resize
    resizeObserver = new ResizeObserver(() => {
        if (graphInstance.value && graphContainer.value) {
            const { clientWidth, clientHeight } = graphContainer.value;
            graphInstance.value.setSize(clientWidth, clientHeight);
            graphInstance.value.fitView();
        }
    });
    if (graphContainer.value) {
        resizeObserver.observe(graphContainer.value);
    }
});

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (graphInstance.value) graphInstance.value.destroy();
});

defineExpose({ refresh: loadData });
</script>

<style scoped>
.power-network-graph {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar, #121212);
  position: relative;
  overflow: hidden;
}

.graph-toolbar {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: rgba(30, 30, 30, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
  z-index: 10;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
  margin-right: 12px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.graph-container {
  flex: 1;
  position: relative;
  width: 100%;
  height: calc(100% - 40px);
  overflow: hidden;
}

.graph-tooltip {
    position: absolute;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid #444;
    border-radius: 4px;
    padding: 8px 12px;
    color: #fff;
    font-size: 12px;
    z-index: 100;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
}

.tooltip-title {
    font-weight: bold;
    margin-bottom: 4px;
    color: #40a9ff;
    border-bottom: 1px solid #444;
    padding-bottom: 4px;
}

.tooltip-row {
    margin: 2px 0;
    color: #ccc;
}
.tooltip-row .label {
    color: #888;
    margin-right: 4px;
}

/* 覆盖 Element UI 样式适配暗黑主题 */
:deep(.el-button--circle) {
    background: transparent;
    border: 1px solid #444;
    color: #aaa;
}
:deep(.el-button--circle:hover) {
    color: #40a9ff;
    border-color: #40a9ff;
    background: rgba(24, 144, 255, 0.1);
}

.loading-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #888;
    gap: 12px;
}
.loading-spinner {
    font-size: 32px;
    color: #40a9ff;
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
}
</style>
