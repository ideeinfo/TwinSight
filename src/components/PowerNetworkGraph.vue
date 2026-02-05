<template>
  <div class="power-network-graph">
    <!-- 工具栏 -->
    <div class="graph-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">电源拓扑网络</span>
        <el-tag size="small" effect="dark" type="success" v-if="stats.nodes">{{ stats.nodes }} 节点</el-tag>
      </div>
      
      <div class="toolbar-actions">
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
import { FullScreen, ZoomIn, ZoomOut, Loading } from '@element-plus/icons-vue';
import { getPowerGraph } from '@/api/rds';

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
const stats = ref({ nodes: 0, edges: 0 });
const layoutType = ref('dagre');
const tooltip = ref({ show: false, x: 0, y: 0, data: null });

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
        // 基础形状
        fill: '#1f1f1f',
        stroke: (d) => getNodeColor(d.nodeType),
        lineWidth: 2,
        shadowColor: (d) => getNodeColor(d.nodeType),
        shadowBlur: 10,
        radius: 4,
        
        // 标签样式 - 显示完整名称
        labelText: (d) => {
          // 优先显示 label (描述名称)，如果没有则显示 label (目前后端逻辑 label=name or code)
          // 如果想同时显示: return `${d.label}\n${d.shortCode}`;
          return d.label || d.shortCode || 'Unknown';
        },
        labelFill: '#e0e0e0',
        labelFontSize: 12,
        labelPlacement: 'bottom', // 标签在下方，避免遮挡
        labelBackground: true,
        labelBackgroundFill: 'rgba(0,0,0,0.6)',
        labelBackgroundRadius: 2,
        labelBackgroundPadding: [2, 4],
        
        // 图标/徽章
        badge: true,
        badgeText: (d) => NODE_ICONS[d.nodeType] || '',
        badgePlacement: 'right-top',
        badgeFill: 'transparent',
        badgeColor: (d) => getNodeColor(d.nodeType),
        badgeFontSize: 16,

        // 尺寸动态化
        size: (d) => d.nodeType === 'source' ? [50, 50] : [40, 40],
        iconText: (d) => NODE_ICONS[d.nodeType] || '', // 中心图标
        iconFontSize: 18,
        iconFill: (d) => getNodeColor(d.nodeType),
      },
      state: {
        selected: {
          stroke: '#ffffff',
          lineWidth: 3,
          shadowBlur: 20,
          shadowColor: '#ffffff',
        },
        active: {
          fill: '#2a2a2a',
          shadowBlur: 15,
        },
        inactive: {
          opacity: 0.2,
        }
      },
      palette: {
          type: 'group',
          field: 'nodeType',
      }
    },
    
    edge: {
      type: 'cubic-horizontal', // 曲线连接，更现代
      style: {
        stroke: '#444444',
        lineWidth: 2,
        opacity: 0.8,
        endArrow: true,
        endArrowType: 'vee',
        endArrowSize: 10,
        endArrowFill: '#444444',
      },
      state: {
        selected: {
          stroke: '#1890FF',
          lineWidth: 3,
          shadowBlur: 5,
          shadowColor: '#1890FF',
        },
        active: {
          stroke: '#40a9ff',
          lineWidth: 2,
        },
        inactive: {
          opacity: 0.1,
        }
      },
    },
    
    plugins: [
        { type: 'grid-line', size: 30, stroke: '#222', lineWidth: 1 }, // 这里的插件需要在 new Graph 时根据 G6 v5 API 使用，暂时简化
    ],

    behaviors: [
        'drag-canvas', 
        'zoom-canvas', 
        'click-select',
        {
            type: 'hover-activate',
            degree: 1, // 高亮相邻节点
        }
    ],
  });

  // 事件监听
  graph.on('node:click', (evt) => {
    const { id } = evt.target;
    // G6 v5 事件结构可能不同，确保获取数据
    // 这里的 evt.target.id 可能是图形 ID，需要通过 graph.getNodeData 获取
    // 简单起见，使用 click-select 行为后的 selection change 或者直接拿数据
    
    // 尝试获取点击的节点 ID (在 v5 中，evt.id 可能直接是节点 ID，或者 evt.target.id)
    // 调试发现 v5 事件对象结构：evt.target 是 shape，evt.id 是 item id
    
    // 最可靠的方式：使用 getElementType 和 id
    // 或者利用 behavior 的 selection
  });
  
  // 补充：手动处理点击，因为 v5 behavior 主要是视觉
  graph.on('click', (evt) => {
      if (evt.targetType === 'node') {
          const nodeData = graph.getNodeData(evt.target.id);
          if (nodeData) {
              emit('node-click', nodeData);
              if (props.onNodeClick) props.onNodeClick(nodeData);
          }
      } else if (evt.targetType === 'canvas') {
          // 点击空白处
          tooltip.value.show = false;
      }
  });

  // 悬浮提示 (Tooltip)
  graph.on('node:pointerenter', (evt) => {
    const nodeData = graph.getNodeData(evt.target.id);
    if (nodeData) {
        // 计算位置 (相对于画布容器)
        // G6 v5 clientXY
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
        nodesep: 40,
        ranksep: 80,
        controlPoints: true, 
      };
    case 'force':
      return {
        type: 'd3-force', // G6 v5 内置 d3-force
        preventOverlap: true,
        nodeSize: 30,
        linkDistance: 100,
        manyBodyStrength: -500,
      };
    case 'circular':
      return { type: 'circular' };
    case 'compactBox':
      // G6 v5 树图布局需要特定 tree 数据结构，这里是 graph data，可能需要转换
      // 暂时回退到 dagre 作为默认层级布局
      return { type: 'dagre', rankdir: 'TB', nodesep: 30, ranksep: 60 };
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
    try {
        const res = await getPowerGraph(props.fileId);
        if (res && res.nodes) {
            graphData.value = {
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
