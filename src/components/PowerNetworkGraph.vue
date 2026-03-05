<template>
  <div class="power-network-graph" ref="rootContainer">
    <!-- 工具栏 -->
    <div class="graph-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">电源拓扑网络</span>
        <el-tag size="small" effect="dark" type="success" v-if="stats.nodes">{{ stats.nodes }} 节点</el-tag>
      </div>
      
      <div class="toolbar-actions">
        <el-tooltip content="自适应视图">
          <el-button @click="fitView" link class="graph-action-btn">
            <el-icon :size="16"><FullScreen /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="放大">
          <el-button @click="zoomIn" link class="graph-action-btn">
            <el-icon :size="16"><ZoomIn /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="缩小">
          <el-button @click="zoomOut" link class="graph-action-btn">
            <el-icon :size="16"><ZoomOut /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>
    
    <!-- 图容器 -->
    <div ref="graphContainer" class="graph-container">
      <!-- 悬浮提示 -->
      <div v-show="tooltip.show" class="graph-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
        <div class="tooltip-header">
          <span class="tooltip-icon">{{ getNodeIcon(tooltip.data?.nodeType) }}</span>
          <span class="tooltip-title">{{ tooltip.data?.label || tooltip.data?.shortCode }}</span>
        </div>
        
        <div class="tooltip-section">
          <!-- 移除类型显示，避免冗余 -->
          <!-- 
          <div class="tooltip-row" v-if="tooltip.data?.nodeType">
            <span class="label">类型:</span> {{ getNodeTypeLabel(tooltip.data.nodeType) }}
          </div>
          -->
          <div class="tooltip-row" v-if="tooltip.data?.mcCode">
            <span class="label">{{ $t('rds.deviceCode') }}:</span> {{ tooltip.data.mcCode }}
          </div>
        </div>
        
        <!-- 方面编码区域 -->
        <div class="tooltip-section aspects" v-if="tooltip.data?.aspects?.length">
          <div class="section-title">{{ $t('rds.aspectCode') }}</div>
          <div class="tooltip-row aspect-row" v-for="aspect in getGroupedAspects(tooltip.data.aspects)" :key="aspect.fullCode">
            <span class="aspect-prefix" :class="aspect.aspectType">{{ aspect.prefix }}</span>
            <span class="aspect-code">{{ aspect.fullCode }}</span>
          </div>
        </div>
        
        <!-- 如果没有方面编码但有电源编码，显示电源编码 -->
        <div class="tooltip-section" v-else-if="tooltip.data?.code">
          <div class="tooltip-row">
            <span class="label">{{ $t('rds.powerCode') }}:</span> {{ tooltip.data.code }}
          </div>
        </div>
      </div>
      
      <!-- 右下角追溯操作按钮 -->
      <div class="floating-actions" v-if="selectedNode || isTracing">
        <el-button v-if="selectedNode && !isTracing" @click="traceUpstream" type="primary" size="small">
          <el-icon><Top /></el-icon>{{ $t('rds.traceUpstream') }}
        </el-button>
        <el-button v-if="isTracing" @click="clearTrace" type="warning" size="small">
          {{ $t('rds.cancelTrace') }}
        </el-button>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
      <span>{{ $t('rds.loadingPowerData') }}</span>
    </div>
    
    <!-- 空状态 -->
    <div v-if="!loading && (!graphData.nodes || graphData.nodes.length === 0)" class="empty-state">
      <el-empty :description="$t('rds.noData')" />
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
  searchText: {
    type: String,
    default: ''
  },
  onNodeClick: {
    type: Function,
    default: null
  }
});

// Emits
const emit = defineEmits(['node-click', 'node-select', 'trace-complete', 'trace-clear']);

// Refs
const rootContainer = ref(null);
const graphContainer = ref(null);
const loading = ref(false);
const graphData = ref({ nodes: [], edges: [] });
const fullGraphData = ref({ nodes: [], edges: [] }); // 完整数据备份
const stats = ref({ nodes: 0, edges: 0 });
const layoutType = ref('dagre');
const tooltip = ref({ show: false, x: 0, y: 0, data: null });
const selectedNode = ref(null); // 当前选中的节点
const isTracing = ref(false); // 是否处于追溯模式

// 数据就绪 Promise（用于 AI 触发追溯时等待数据加载完成）
let _dataReadyResolve = null;
let dataReadyPromise = new Promise(resolve => { _dataReadyResolve = resolve; });

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
    theme: isDarkMode() ? 'dark' : 'light',
    background: 'transparent', // 让 CSS 控制背景，但设置 theme 影响默认文字颜色等
    
    layout: getLayoutConfig('LR'), // 默认水平布局
    
    node: {
      style: {
        // 矩形卡片样式
        fill: (d) => getNodeFill(d),
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
        labelFill: () => getNodeTextColor(),
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
          stroke: isDarkMode() ? '#ffffff' : '#1890FF',
          lineWidth: 2,
          fill: isDarkMode() ? '#2a2a2a' : '#E6F7FF',
          shadowBlur: 10,
        },
        active: {
          fill: isDarkMode() ? '#333333' : '#f0f7ff',
          opacity: 1,
          lineWidth: 2,
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
        active: {
          stroke: '#1890FF',
          lineWidth: 2,
          opacity: 1,
        },
        inactive: {
          opacity: 0.2,
          stroke: '#999',
        }
      },
    },
    
    plugins: [], // 移除网格线

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
  
  // 强制更新容器背景色 (JS 覆盖 CSS 以确保生效)
  updateThemeStyles();
};

const updateThemeStyles = () => {
    if (rootContainer.value) {
        const isDark = isDarkMode();
        rootContainer.value.style.backgroundColor = isDark ? '#121212' : '#ffffff';
        
        // 更新 CSS 变量 (作为双重保障)
        rootContainer.value.style.setProperty('--pg-bg', isDark ? '#121212' : '#ffffff');
        rootContainer.value.style.setProperty('--pg-text-title', isDark ? '#d1d1d1' : '#333333');
        rootContainer.value.style.setProperty('--pg-toolbar-bg', isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.95)');
        rootContainer.value.style.setProperty('--pg-border', isDark ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0');
        rootContainer.value.style.setProperty('--pg-btn-color', isDark ? '#a0a0a0' : '#606266');
        
        // Tooltip Theme Vars
        rootContainer.value.style.setProperty('--tt-bg', isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)');
        rootContainer.value.style.setProperty('--tt-text', isDark ? '#fff' : '#333');
        rootContainer.value.style.setProperty('--tt-border', isDark ? '#444' : '#ebeef5');
        rootContainer.value.style.setProperty('--tt-sub', isDark ? '#a0a0a0' : '#606266');
    }
};

// 监听主题变化
const observeThemeChange = () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                updateThemeStyles(); // 立即更新样式
                
                // 重新初始化以更新节点样式（文字颜色等）
                if (graphInstance.value) {
                   initGraph(); 
                   // 恢复数据
                   if (graphData.value && graphData.value.nodes.length) {
                       graphInstance.value.setData(graphData.value);
                       graphInstance.value.render();
                   }
                }
            }
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
    
    return observer;
};

let themeObserver = null;

// 获取布局配置
const getLayoutConfig = (direction = 'LR') => {
  // 强制使用优化后的 dagre 布局
  // direction: 'LR' (Left-to-Right) or 'TB' (Top-to-Bottom)
  return {
    type: 'dagre',
    rankdir: direction,
    align: 'UL',
    nodesep: 60,      // 垂直间距 (增加以避免拥挤)
    ranksep: 250,     // 水平间距 (节点宽180 + 箭头空间，设大一些防止重叠)
    controlPoints: true, 
  };
};

const getNodeColor = (type) => {
  return NODE_COLORS[type] || NODE_COLORS.default;
};

// 获取当前是否深色模式
const isDarkMode = () => document.documentElement.classList.contains('dark');

// 获取节点文字颜色
const getNodeTextColor = () => {
    return isDarkMode() ? '#f0f0f0' : '#333333';
};

// 获取节点填充色
const getNodeFill = (node) => {
    // 1. 如果有 BIM 关联，优先使用橙色高亮 (用户指定)
    if (node.bimGuid || node.externalId) {
        // 使用深橙色以区分于普通的黄色(Bus)
        return '#FF8800'; 
    }
    
    // 2. 否则使用类型对应的颜色 (恢复多色显示能力)
    const type = node.nodeType || 'default';
    if (NODE_COLORS[type]) {
        // 为了保持文字可读性及深色模式适应性，
        // 这里可以考虑返回带透明度的颜色，或者特定颜色
        // 目前恢复为实色以匹配用户"显示不同颜色"的期望
        return NODE_COLORS[type];
    }
    
    // 3. 默认回退
    return isDarkMode() ? '#1f1f1f' : '#ffffff';
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

// 获取节点图标
const getNodeIcon = (type) => {
    return NODE_ICONS[type] || NODE_ICONS.default;
};

// 获取分组后的方面编码（每种类型只取最具体的一个）
const getGroupedAspects = (aspects) => {
    if (!aspects || !Array.isArray(aspects)) return [];
    
    // 按 aspectType 分组，每组取 hierarchy_level 最高的（最具体的）
    const grouped = {};
    aspects.forEach(a => {
        const type = a.aspectType;
        if (!grouped[type] || a.level > grouped[type].level) {
            grouped[type] = a;
        }
    });
    
    // 按固定顺序返回：function, location, power
    const order = ['function', 'location', 'power'];
    return order
        .filter(t => grouped[t])
        .map(t => grouped[t]);
};

// 数据加载
const loadData = async () => {
    if (!props.fileId) return;
    
    // 重置数据就绪 Promise（用于重新加载场景）
    dataReadyPromise = new Promise(resolve => { _dataReadyResolve = resolve; });
    
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
        // 通知等待方数据已就绪
        if (_dataReadyResolve) {
            _dataReadyResolve();
            _dataReadyResolve = null;
        }
    }
};

const getTypeFill = (type) => {
    return getNodeFill(type);
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
                // 切换为垂直布局 (上游在上，下游在下)
                graphInstance.value.setLayout(getLayoutConfig('TB'));
                graphInstance.value.setData(graphData.value);
                await graphInstance.value.render();
                graphInstance.value.fitView();
            }
            
            // 发送追溯完成事件，供父组件进行 BIM 可视化
            emit('trace-complete', {
                startNodeId: selectedNode.value.id,
                nodes: filteredNodes.map(n => ({
                    id: n.id,
                    bimGuid: n.bimGuid,
                    mcCode: n.mcCode || n.shortCode,
                    nodeType: n.nodeType,
                    label: n.label
                })),
                edges: filteredEdges.map(e => ({
                    source: e.source,
                    target: e.target
                }))
            });
        }
    } catch (err) {
        console.error('追溯上游电源失败:', err);
    } finally {
        loading.value = false;
    }
};

// 处理搜索
const handleSearch = async (searchText) => {
    if (!graphInstance.value || !fullGraphData.value.nodes.length) return;
    
    // 如果处于追溯模式，不响应搜索（或者退出追溯模式？）
    // 逻辑上，如果在追溯模式下搜索，应该视为新的全局搜索，需退出追溯
    if (isTracing.value) {
        // 追溯模式下搜索，先清除追溯标志，重置布局
        isTracing.value = false;
        selectedNode.value = null;
        emit('trace-clear');
        graphInstance.value.setLayout(getLayoutConfig('LR'));
    }
    
    const search = (searchText || '').toLowerCase().trim();
    
    if (!search) {
        // 清除搜索，恢复完整图
        // 只有当前数据不完整时才恢复，避免重复渲染
        if (graphData.value.nodes.length !== fullGraphData.value.nodes.length) {
            graphData.value = JSON.parse(JSON.stringify(fullGraphData.value));
            stats.value = {
                nodes: graphData.value.nodes.length,
                edges: graphData.value.edges.length
            };
            graphInstance.value.setData(graphData.value);
            await graphInstance.value.render();
            graphInstance.value.fitView();
        }
        return;
    }
    
    // 过滤匹配的节点
    const matchedNodes = fullGraphData.value.nodes.filter(node => {
        const label = (node.label || '').toLowerCase();
        const code = (node.shortCode || node.fullCode || '').toLowerCase();
        // 搜索匹配 BIM ID 或 MC Code
        const bimGuid = (node.bimGuid || '').toLowerCase();
        const mcCode = (node.mcCode || '').toLowerCase();
        
        return label.includes(search) || 
               code.includes(search) || 
               bimGuid.includes(search) || 
               mcCode.includes(search);
    });
    
    const matchedNodeIds = new Set(matchedNodes.map(n => n.id));
    
    // 只保留匹配节点之间的边
    // 或者：显示匹配节点及其直接邻居？目前逻辑是只显示匹配子图。
    const matchedEdges = fullGraphData.value.edges.filter(e => 
        matchedNodeIds.has(e.source) && matchedNodeIds.has(e.target)
    );
    
    graphData.value = {
        nodes: matchedNodes,
        edges: matchedEdges
    };
    
    stats.value = {
        nodes: matchedNodes.length,
        edges: matchedEdges.length
    };
    
    graphInstance.value.setData(graphData.value);
    await graphInstance.value.render();
    graphInstance.value.fitView();
};

// 视口控制
const fitView = () => {
    if (graphInstance.value) {
        graphInstance.value.fitView();
    }
};

const zoomIn = () => {
    if (graphInstance.value) {
        // G6 v5: 放大 20%
        const currentZoom = graphInstance.value.getZoom();
        graphInstance.value.zoomTo(currentZoom * 1.2);
    }
};

const zoomOut = () => {
    if (graphInstance.value) {
        // G6 v5: 缩小 20%
        const currentZoom = graphInstance.value.getZoom();
        graphInstance.value.zoomTo(currentZoom * 0.8);
    }
};

// 监听搜索词变化
watch(() => props.searchText, handleSearch);

// 清除追溯
const clearTrace = async () => {
    // 重置追溯状态
    isTracing.value = false;
    selectedNode.value = null;
    emit('trace-clear');
    
    if (graphInstance.value) {
        // 恢复水平布局
        graphInstance.value.setLayout(getLayoutConfig('LR'));
        
        // 重新应用当前的搜索过滤 (如果搜索框有值)
        await handleSearch(props.searchText);
        
        // 如果没有搜索词（handleSearch 内部会处理恢复全图），确保视图适配
        if (!props.searchText) {
             // 已经在 handleSearch 处理了
        }
    }
};

// 生命周期
onMounted(async () => {
    await nextTick();
    
    // 初始化主题监听
    themeObserver = observeThemeChange();
    
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
    if (themeObserver) themeObserver.disconnect();
    if (resizeObserver) resizeObserver.disconnect();
    if (graphInstance.value) graphInstance.value.destroy();
    
    // 如果组件卸载时处于追溯模式，通知父组件清除
    if (isTracing.value) {
        emit('trace-clear');
    }
});


/**
 * 根据 MC 编码选中节点并触发追溯 (AI 调用)
 */
const selectNodeByMcCode = async (mcCode, autoTrace = true) => {
    // 等待数据加载完成（最多 10 秒超时，解决 AI 触发时的时序竞争问题）
    await Promise.race([
        dataReadyPromise,
        new Promise(resolve => setTimeout(resolve, 10000))
    ]);
    
    if (!fullGraphData.value || !fullGraphData.value.nodes || fullGraphData.value.nodes.length === 0) {
        console.warn(`[PowerGraph] 数据未就绪或为空, 无法查找节点: ${mcCode}`);
        return false;
    }
    
    // 尝试匹配（全字匹配）
    const targetNode = fullGraphData.value.nodes.find(n => 
        n.mcCode === mcCode || 
        n.code === mcCode ||
        n.fullCode === mcCode ||
        (n.label && n.label.includes(mcCode))
    );
    
    if (!targetNode) {
        console.warn(`[PowerGraph] 未找到节点: ${mcCode}`);
        return false;
    }
    
    console.log(`[PowerGraph] AI 定位到节点:`, targetNode);
    selectedNode.value = targetNode;
    
    // 视觉定位与选中状态更新
    if (graphInstance.value) {
        const nodeId = String(targetNode.id);
        
        // 1. 尝试聚焦节点
        if (typeof graphInstance.value.focusItem === 'function') {
             try {
                graphInstance.value.focusItem(nodeId, true, { duration: 500 });
             } catch (e) {
                console.warn('[PowerGraph] focusItem failed', e);
             }
        } else {
             // 尝试 v3/v5 API 或回退
             console.log('[PowerGraph] focusItem API 不可用，跳过自动聚焦');
        }

        // 2. 更新选中状态样式
        try {
            // 清除所有节点的选中状态
            const allNodes = graphInstance.value.getNodes();
            allNodes.forEach(node => {
                graphInstance.value.clearItemStates(node, 'selected');
            });

            // 设置目标节点选中
            const item = graphInstance.value.findById(nodeId);
            if (item) {
                graphInstance.value.setItemState(item, 'selected', true);
            }
        } catch (e) {
            console.warn('[PowerGraph] 更新选中样式失败', e);
        }
    }
    
    // 3. 触发选中事件 (替代 handleNodeClick)
    emit('node-click', targetNode);
    if (props.onNodeClick) {
        props.onNodeClick(targetNode);
    }
    
    // 4. 执行自动追溯
    if (autoTrace) {
        // 延迟一点以展示定位效果
        setTimeout(() => traceUpstream(), 300);
    }
    
    return true;
};

defineExpose({ 
    refresh: loadData,
    selectNodeByMcCode,
    clearTrace
});
</script>

<style scoped>
/* CSS Variables for Theming */
.power-network-graph {
  /* Default Dark Theme Variables */
  --pg-bg: #121212;
  --pg-toolbar-bg: rgba(30, 30, 30, 0.8);
  --pg-border: rgba(255, 255, 255, 0.1);
  --pg-text-title: #d1d1d1;
  --pg-btn-color: #a0a0a0;
  --pg-btn-hover-bg: rgba(255, 255, 255, 0.1);
  --pg-btn-hover-color: #fff;
  
  /* Container Styles */
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--pg-bg);
  position: relative;
  overflow: hidden;
  transition: background-color 0.3s ease;
}

/* Light Theme Overrides */
:global(html.light) .power-network-graph {
  --pg-bg: #ffffff;
  --pg-toolbar-bg: rgba(255, 255, 255, 0.95);
  --pg-border: #e0e0e0;
  --pg-text-title: #333333;
  --pg-btn-color: #606266;
  --pg-btn-hover-bg: rgba(0, 0, 0, 0.05);
  --pg-btn-hover-color: var(--el-color-primary, #409EFF);
}

.graph-toolbar {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--pg-toolbar-bg);
  border-bottom: 1px solid var(--pg-border);
  backdrop-filter: blur(4px);
  z-index: 10;
  transition: all 0.3s ease;
}

.toolbar-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--pg-text-title);
  margin-right: 12px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.graph-action-btn {
  color: var(--pg-btn-color) !important; /* Force override element-plus styles if needed */
  padding: 4px;
  height: 28px;
  width: 28px;
  border-radius: 4px;
  transition: all 0.2s;
  border: none !important;
  background: transparent !important;
}

.graph-action-btn:hover {
  color: var(--pg-btn-hover-color) !important;
  background-color: var(--pg-btn-hover-bg) !important;
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
    background: var(--tt-bg, rgba(0, 0, 0, 0.9));
    border: 1px solid var(--tt-border, #444);
    border-radius: 6px;
    padding: 10px 14px;
    color: var(--tt-text, #fff);
    font-size: 12px;
    z-index: 100;
    pointer-events: none;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(8px);
    width: auto;
    min-width: 180px;
    max-width: 320px;
}

/* Tooltip internal elements adapted via vars */
.tooltip-section,
.tooltip-row {
  border-color: var(--tt-border, #444);
}

.label,
.aspect-prefix {
  color: var(--tt-sub, #a0a0a0);
}

.aspect-code {
  color: var(--tt-text, #fff);
}

/* 增强 Tooltip 样式 */
.tooltip-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #444;
}

.tooltip-icon {
    font-size: 16px;
}

.tooltip-title {
    font-weight: bold;
    color: #40a9ff;
    font-size: 13px;
}

.tooltip-section {
    margin-top: 6px;
}

.tooltip-section.aspects {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px dashed var(--tt-border, #444);
}

.section-title {
    font-size: 11px;
    color: var(--tt-sub, #666);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.tooltip-row {
    margin: 3px 0;
    color: var(--tt-text, #ccc);
}

.tooltip-row .label {
    color: var(--tt-sub, #888);
    margin-right: 4px;
}

.aspect-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0;
}

.aspect-prefix {
    font-family: monospace;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    min-width: 32px;
    text-align: center;
}

.aspect-prefix.function {
    background: rgba(82, 196, 26, 0.2);
    color: #52C41A;
}

.aspect-prefix.location {
    background: rgba(250, 173, 20, 0.2);
    color: #FAAD14;
}

.aspect-prefix.power {
    background: rgba(255, 77, 79, 0.2);
    color: #FF4D4F;
}

.aspect-code {
    font-family: monospace;
    color: var(--tt-text, #ddd);
    font-size: 12px;
    /* 过长时截断 */
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

/* 右下角悬浮操作按钮 */
.floating-actions {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 100;
}

.floating-actions .el-button {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}
</style>
