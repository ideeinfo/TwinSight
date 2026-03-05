<template>
  <div class="root-container">
    <!-- 全景比对模式 -->
    <PanoCompareView 
      v-if="isPanoCompareMode"
      :file-id="panoFileId"
      :model-path="panoModelPath"
      :file-name="panoFileName"
    />

    <!-- 正常模式 -->
    <div v-else class="app-layout" @mouseup="stopResize" @mouseleave="stopResize">
      <TopBar :is-views-panel-open="isViewsPanelOpen" :current-view-name="currentViewName" :active-file-name="activeFileName" @open-data-export="openDataExportPanel" @toggle-views="toggleViewsPanel" />

      <div ref="mainBody" class="main-body" @mousemove="onMouseMove">
        <!-- 左侧区域：IconBar + 内容面板 -->
        <div class="left-section" :style="currentView === 'documents' ? { width: '56px' } : { width: leftWidth + 'px' }">
          <!-- 全局导航栏 -->
          <IconBar
            :current-view="currentView"
            :is-streams-open="isChartPanelOpen"
            :is-a-i-enabled="isAIAnalysisEnabled"
            :is-loading="isModelLoading"
            @switch-view="switchView"
            @toggle-streams="toggleChartPanel"
            @toggle-ai="toggleAIAnalysis"
          />
        
          <!-- 内容面板(文档视图时隐藏) -->
          <div v-if="currentView !== 'documents'" class="panel-content">
            <LeftPanel
              v-if="currentView === 'connect'"
              :rooms="roomList"
              :selected-db-ids="savedRoomSelections"
              @open-properties="openRightPanel"
              @rooms-selected="onRoomsSelected"
              @rooms-deleted="reloadCurrentFileSpaces"
            />
            <AssetPanel
              v-else-if="currentView === 'assets'"
              ref="assetPanelRef"
              :assets="assetList"
              :selected-db-ids="savedAssetSelections"
              @open-properties="openRightPanel"
              @assets-selected="onAssetsSelected"
              @assets-deleted="reloadCurrentFileAssets"
            />
            <SpacePanel
              v-else-if="currentView === 'spaces'"
              ref="spacePanelRef"
              :spaces="roomList"
              :selected-db-ids="savedSpaceSelections"
              @open-properties="openRightPanel"
              @spaces-selected="onSpacesSelected"
              @spaces-deleted="reloadCurrentFileSpaces"
            />
            <FilePanel
              v-else-if="currentView === 'models'"
              @file-activated="onFileActivated"
              @open-data-export="openDataExportPanel"
            />
            <AspectTreePanel
              v-else-if="currentView === 'rds'"
              ref="aspectTreePanelRef"
              :file-id="activeFileId"
              @highlight-guids="onHighlightGuids"
              @trace-result="onTraceResult"
              @trace-complete="onTraceComplete"
              @trace-clear="onTraceClear"
            />
          </div>
        </div>

        <!-- 文档管理视图(独立全屏布局) -->
        <DocumentManager v-if="currentView === 'documents'" class="document-manager-fullscreen" />

        <div v-if="currentView !== 'documents'" class="resizer" @mousedown="startResize($event, 'left')"></div>

        <!-- 中间主视图区域(文档视图时隐藏) -->
        <div v-if="currentView !== 'documents'" class="main-content">
          <!-- 3D 视图 -->
          <div class="viewer-wrapper" :style="{ height: isChartPanelOpen ? `calc(100% - ${chartPanelHeight}px)` : '100%' }">
            <MainView
              ref="mainViewRef"
              :current-view="currentView"
              :assets="assetList"
              :rooms="roomList"
              :is-a-i-enabled="isAIAnalysisEnabled"
              @rooms-loaded="onRoomsLoaded"
              @assets-loaded="onAssetsLoaded"
              @viewer-ready="onViewerReady"
              @chart-data-update="onChartDataUpdate"
              @time-range-changed="onTimeRangeChanged"
              @model-selection-changed="onModelSelectionChanged"
              @trigger-ai-alert="handleAIAlert"
            />
          </div>

          <!-- 底部图表高度调节拖拽条 -->
          <div v-if="isChartPanelOpen" class="horizontal-resizer" @mousedown="startResize($event, 'chart')"></div>

          <!-- 底部图表面板 -->
          <div v-if="isChartPanelOpen" class="bottom-chart-wrapper" :style="{ height: chartPanelHeight + 'px' }">
            <template v-if="selectedRoomSeries.length">
              <ChartPanel
                v-if="selectedRoomSeries.length === 1"
                :data="selectedRoomSeries[0].points"
                :range="currentRange"
                :label-text="$t('chartPanel.individual')"
                @hover-sync="onHoverSync"
                @close="closeChartPanel"
              />
              <MultiChartPanel
                v-else
                :series-list="selectedRoomSeries"
                :range="currentRange"
                @hover-sync="onHoverSync"
                @close="closeChartPanel"
              />
            </template>
            <ChartPanel v-else :data="chartData" :range="currentRange" :label-text="$t('chartPanel.average')" @close="closeChartPanel" @hover-sync="onHoverSync" />
          </div>
        </div>

        <!-- 右侧拖拽条(文档视图时隐藏) -->
        <div
          v-if="isRightPanelOpen && currentView !== 'documents'"
          class="resizer"
          @mousedown="startResize($event, 'right')"
        ></div>

        <!-- 右侧面板(文档视图时隐藏) -->
        <div
          v-if="isRightPanelOpen && currentView !== 'documents'"
          class="panel-wrapper"
          :style="{ width: rightWidth + 'px' }"
        >
          <RightPanel
            :room-properties="selectedRoomProperties"
            :selected-ids="selectedObjectIds"
            :view-mode="rightPanelViewMode"
            @close-properties="closeRightPanel"
            @property-changed="onPropertyChanged"
          />
        </div>
      </div>

      <!-- 数据导出面板弹窗 -->
      <Teleport to="body">
        <div v-if="isDataExportOpen" class="modal-overlay">
          <div class="modal-container">
            <DataExportPanel
              :file-id="currentExportFileId"
              :get-full-asset-data="getFullAssetDataFromMainView"
              :get-full-space-data="getFullSpaceDataFromMainView"
              :get-asset-property-list="getAssetPropertyListFromMainView"
              :get-space-property-list="getSpacePropertyListFromMainView"
              :get-full-asset-data-with-mapping="getFullAssetDataWithMappingFromMainView"
              :get-full-space-data-with-mapping="getFullSpaceDataWithMappingFromMainView"
            />
            <button class="dialog-close-btn modal-close-btn" @click="closeDataExportPanel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </Teleport>
    
      <!-- 视图面板 -->
      <ViewsPanel
        :visible="isViewsPanelOpen"
        :file-id="activeFileId"
        :file-name="activeFileName"
        @close="isViewsPanelOpen = false"
        @get-viewer-state="handleGetViewerState"
        @capture-screenshot="handleCaptureScreenshot"
        @restore-view="handleRestoreView"
        @current-view-changed="currentViewName = $event"
      />

      <!-- AI 对话面板 -->
      <AIChatPanel
        ref="aiChatPanelRef"
        :current-context="aiContext"
        @send-message="handleAIChatMessage"
        @execute-action="executeAIAction"
        @open-source="onOpenSource"
      />

      <!-- 全局文档预览 -->
      <DocumentPreview 
        :visible="previewVisible" 
        :document="previewDocument" 
        @close="previewVisible = false"
      />

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue';
import AIChatPanel from './components/ai/AIChatPanel.vue';
import AIAnalysisModal from './components/viewer/AIAnalysisModal.vue';
import { useAuthStore } from './stores/auth';
import TopBar from './components/TopBar.vue';
import IconBar from './components/IconBar.vue';
import LeftPanel from './components/LeftPanel.vue';
import AssetPanel from './components/AssetPanel.vue';
import SpacePanel from './components/SpacePanel.vue';
import FilePanel from './components/FilePanel.vue';
import AspectTreePanel from './components/AspectTreePanel.vue';
import DocumentManager from './components/DocumentManager.vue';
import RightPanel from './components/RightPanel.vue';
import MainView from './components/MainView.vue';
import ChartPanel from './components/ChartPanel.vue';
import MultiChartPanel from './components/MultiChartPanel.vue';
import DataExportPanel from './components/DataExportPanel.vue';
import DocumentPreview from './components/DocumentPreview.vue';

import ViewsPanel from './components/ViewsPanel.vue';
import { queryRoomSeries } from './services/influx';
import PanoCompareView from './components/PanoCompareView.vue';
import { checkApiHealth, getAssets, getSpaces, getAssetDetailByDbId } from './services/postgres.js';
import { usePropertySelection } from './composables/usePropertySelection';
import { triggerTemperatureAlert } from './services/ai-analysis';

const { getPropertiesFromSelection, formatAssetProperties, formatSpaceProperties } = usePropertySelection();

const authStore = useAuthStore();

// Helper to get auth headers
const getHeaders = () => {
  const headers = {};
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }
  return headers;
};

// 全景比对模式状态
const isPanoCompareMode = ref(false);
const panoFileId = ref('');
const panoModelPath = ref('');
const panoFileName = ref('');

// 文档预览状态
const previewVisible = ref(false);
const previewDocument = ref(null);


// 初始化全景比对模式
const initPanoCompareMode = async () => {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const fId = params.get('fileId');
  console.log('🔍 [App] 初始化全景模式:', { mode, fileId: fId, href: window.location.href });
  
  if (mode === 'pano-compare') {
    isPanoCompareMode.value = true;
    panoFileId.value = fId;
    
    if (panoFileId.value) {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
        console.log('🔍 [App] 获取文件列表...');
        const response = await fetch(`${API_BASE}/api/files`, { headers: getHeaders() });
        const data = await response.json();
        
        if (data.success) {
          // 注意：URL参数是字符串，API返回的ID可能是数字，使用 == 进行比较
          const file = data.data.find(f => f.id == panoFileId.value);
          if (file) {
            console.log('✅ [App] 找到比对文件:', file);
            panoFileName.value = file.title;
            // 优先使用 extracted_path，如果没有则尝试构造默认路径
            panoModelPath.value = file.extracted_path || `/models/${file.id}`; 
            console.log('📂 [App] 设置模型路径:', panoModelPath.value);
          } else {
            console.warn('⚠️ [App] 未找到 ID 为', panoFileId.value, '的文件');
          }
        }
      } catch (e) {
        console.error('❌ [App] 获取全景比对文件详情失败:', e);
      }
    }
  }
};

onMounted(() => {
  initPanoCompareMode();
});

const leftWidth = ref(368);
const rightWidth = ref(320);
const isRightPanelOpen = ref(true);
const isChartPanelOpen = ref(false);
const isAIAnalysisEnabled = ref(false); // AI 分析功能开关，默认关闭
const chartPanelHeight = ref(300);
const roomList = ref([]);
const assetList = ref([]);
const mainViewRef = ref(null);
const assetPanelRef = ref(null);
const spacePanelRef = ref(null);
const aspectTreePanelRef = ref(null);
const selectedRoomProperties = ref(null);
const selectedObjectIds = ref([]); // 当前选中的对象ID列表（用于批量编辑）
const aiContext = ref(null); // AI 对话上下文 { id, name, type, properties }
const chartData = ref([]);
const currentView = ref('assets'); // 'connect' or 'assets' or 'spaces' - 默认加载资产页面
// 新增状态：记录当前选中的对象类型（用于跨模块联动）
const currentSelectionType = ref(null); // 'asset', 'space', or null

// 计算右侧面板的显示模式：优先使用当前选中的对象类型，没有则回退到当前视图模式
const rightPanelViewMode = computed(() => {
  if (currentSelectionType.value === 'asset') return 'assets';
  if (currentSelectionType.value === 'space') return 'spaces';
  return currentView.value;
});
const selectedRoomSeries = ref([]);
const currentRange = ref({ startMs: 0, endMs: 0, windowMs: 0 });
const savedRoomSelections = ref([]);
const savedAssetSelections = ref([]);
const savedSpaceSelections = ref([]);
const isDataExportOpen = ref(false);
const isLoadingFromDb = ref(false);
const dbDataLoaded = ref(false);
// 追踪当前加载的模型路径，防止重复加载
const currentLoadedModelPath = ref(null); 
const isModelLoading = ref(true); // 模型加载状态，默认 true 以禁用侧边栏

// 模型数据缓存（用于 dbId 映射）
const modelRoomDbIds = ref([]);
const modelAssetDbIds = ref([]);

// 当前导出的文件 ID
const currentExportFileId = ref(null);

// 数据导出面板打开前的原模型路径（用于关闭时恢复）
const previousModelPath = ref(null);

// 待加载的激活文件（在 viewer 初始化完成后加载）
const pendingActiveFile = ref(null);
const viewerReady = ref(false);

// 视图面板状态
const isViewsPanelOpen = ref(false);
const activeFileId = ref(null);
const activeFileName = ref('');
const currentViewName = ref('');

// 视图面板方法
const toggleViewsPanel = () => {
  isViewsPanelOpen.value = !isViewsPanelOpen.value;
};

const handleGetViewerState = (callback) => {
  if (mainViewRef.value && mainViewRef.value.getViewerState) {
    const state = mainViewRef.value.getViewerState();
    callback(state);
  } else {
    callback({});
  }
};

const handleCaptureScreenshot = (callback) => {
  if (mainViewRef.value && mainViewRef.value.captureScreenshot) {
    mainViewRef.value.captureScreenshot(callback);
  } else {
    callback(null);
  }
};

const handleRestoreView = (viewData) => {
  if (mainViewRef.value && mainViewRef.value.restoreViewState) {
    mainViewRef.value.restoreViewState(viewData);
  }
};

// 数据导出面板方法
const openDataExportPanel = async (file) => {
  if (file && file.id) {
    currentExportFileId.value = file.id;
    // 注意：不更新 activeFileId/activeFileName，保持视图面板不变
    // 数据导出只是临时加载模型，不应影响视图面板
    
    // 方案 C：如果当前加载的模型不是目标文件，自动加载目标模型
    if (file.extracted_path && currentLoadedModelPath.value !== file.extracted_path) {
      console.log('📂 导出面板：需要加载目标模型', file.extracted_path);
      
      if (viewerReady.value && mainViewRef.value && mainViewRef.value.loadNewModel) {
        try {
          // 保存原模型路径，以便关闭时恢复
          previousModelPath.value = currentLoadedModelPath.value;
          currentLoadedModelPath.value = file.extracted_path;
          console.log('📦 开始加载模型...');
          await mainViewRef.value.loadNewModel(file.extracted_path);
          console.log('✅ 模型加载完成，可以提取数据');
        } catch (error) {
          console.error('❌ 模型加载失败:', error);
          // 即使失败也打开面板，让用户看到错误信息
        }
      } else {
        console.warn('⚠️ Viewer 尚未准备好，无法加载模型');
      }
    } else {
      console.log('📂 导出面板：模型已加载或无需加载');
    }
  } else {
    currentExportFileId.value = null;
  }
  
  // 最后打开面板
  isDataExportOpen.value = true;
};

const closeDataExportPanel = async () => {
  isDataExportOpen.value = false;
  
  // 如果之前保存了原模型路径，恢复原模型
  if (previousModelPath.value && previousModelPath.value !== currentLoadedModelPath.value) {
    console.log('📂 正在恢复原模型:', previousModelPath.value);
    if (viewerReady.value && mainViewRef.value && mainViewRef.value.loadNewModel) {
      try {
        currentLoadedModelPath.value = previousModelPath.value;
        await mainViewRef.value.loadNewModel(previousModelPath.value);
        console.log('✅ 原模型已恢复');
      } catch (error) {
        console.error('❌ 恢复原模型失败:', error);
      }
    }
    previousModelPath.value = null;
  }
};

// 从 MainView 获取完整资产数据
const getFullAssetDataFromMainView = async () => {
  if (mainViewRef.value && mainViewRef.value.getFullAssetData) {
    return await mainViewRef.value.getFullAssetData();
  }
  return [];
};

// 从 MainView 获取完整空间数据
const getFullSpaceDataFromMainView = async () => {
  if (mainViewRef.value && mainViewRef.value.getFullSpaceData) {
    return await mainViewRef.value.getFullSpaceData();
  }
  return [];
};

// 从 MainView 获取资产属性列表（用于字段映射配置）
const getAssetPropertyListFromMainView = async () => {
  if (mainViewRef.value && mainViewRef.value.getAssetPropertyList) {
    return await mainViewRef.value.getAssetPropertyList();
  }
  return { categories: {}, count: 0 };
};

// 从 MainView 获取空间属性列表（用于字段映射配置）
const getSpacePropertyListFromMainView = async () => {
  if (mainViewRef.value && mainViewRef.value.getSpacePropertyList) {
    return await mainViewRef.value.getSpacePropertyList();
  }
  return { categories: {}, count: 0 };
};

// 从 MainView 获取资产数据（使用自定义映射）
const getFullAssetDataWithMappingFromMainView = async (mapping) => {
  if (mainViewRef.value && mainViewRef.value.getFullAssetDataWithMapping) {
    return await mainViewRef.value.getFullAssetDataWithMapping(mapping);
  }
  return [];
};

// 从 MainView 获取空间数据（使用自定义映射）
const getFullSpaceDataWithMappingFromMainView = async (mapping) => {
  if (mainViewRef.value && mainViewRef.value.getFullSpaceDataWithMapping) {
    return await mainViewRef.value.getFullSpaceDataWithMapping(mapping);
  }
  return [];
};

// 从数据库加载数据
const loadDataFromDatabase = async () => {
  isLoadingFromDb.value = true;
  try {
    const isApiHealthy = await checkApiHealth();
    if (!isApiHealthy) {
      console.log('⚠️ API 服务未连接，将使用模型数据');
      return false;
    }

    // 从数据库获取空间（房间）数据
    const dbSpaces = await getSpaces();
    if (dbSpaces && dbSpaces.length > 0) {
      // 转换为组件需要的格式
      roomList.value = dbSpaces.map(space => ({
        dbId: space.db_id,
        name: space.name,
        code: space.space_code,
        fileId: space.file_id, // 添加 fileId 用于 InfluxDB 查询
        classificationCode: space.classification_code,
        classificationDesc: space.classification_desc,
        floor: space.floor,
        area: space.area,
        perimeter: space.perimeter
      }));
      console.log(`📊 从数据库加载 ${roomList.value.length} 个空间`);
    }

    // 从数据库获取资产数据
    const dbAssets = await getAssets();
    if (dbAssets && dbAssets.length > 0) {
      // 转换为组件需要的格式
      assetList.value = dbAssets.map(asset => ({
        dbId: asset.db_id,
        name: asset.name,
        mcCode: asset.asset_code,
        classification: asset.classification_code || 'Uncategorized',
        classification_code: asset.classification_code || '',
        classification_desc: asset.classification_desc || '',
        specCode: asset.spec_code,
        specName: asset.spec_name,
        floor: asset.floor,
        room: asset.room,
        category: asset.category,
        family: asset.family,
        type: asset.type,
        manufacturer: asset.manufacturer,
        address: asset.address,
        phone: asset.phone
      }));
      console.log(`📊 从数据库加载 ${assetList.value.length} 个资产`);
    }

    dbDataLoaded.value = true;
    return true;
  } catch (error) {
    console.error('❌ 从数据库加载数据失败:', error);
    return false;
  } finally {
    isLoadingFromDb.value = false;
  }
};

// Viewer 初始化完成回调
const onViewerReady = async () => {
  console.log('🎬 [App] Viewer 初始化完成, isModelLoading 初始状态:', isModelLoading.value);
  viewerReady.value = true;
  isModelLoading.value = true; // 强制确保开始为 true
  
  try {
    // 如果有待加载的激活文件，立即加载其模型
    if (pendingActiveFile.value && mainViewRef.value && mainViewRef.value.loadNewModel) {
      const file = pendingActiveFile.value;
      if (file.extracted_path) {
        console.log('📦 [App] 加载待加载的模型:', file.extracted_path);
        currentLoadedModelPath.value = file.extracted_path;
        await mainViewRef.value.loadNewModel(file.extracted_path);
        console.log('✅ [App] 待加载模型加载完毕');
      }
      pendingActiveFile.value = null;
    } else {
      // 没有 pending 文件，加载当前激活的文件或默认模型
      console.log('🔍 [App] 开始获取文件列表...');
      try {
        const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
        const filesRes = await fetch(`${API_BASE}/api/files`, { headers: getHeaders() });
        const filesData = await filesRes.json();
        
        if (filesData.success && filesData.data.length > 0) {
          const activeFile = filesData.data.find(f => f.is_active);
          if (activeFile) {
            console.log('🔍 [App] 找到激活文件:', activeFile.title);
            
            // 🔑 检查是否已经在加载或已加载同一个模型
            if (currentLoadedModelPath.value === activeFile.extracted_path) {
              console.log('⏭️ [App] 模型已加载，跳过重复加载:', activeFile.extracted_path);
              isModelLoading.value = false; // 模型已加载，解除锁定
              console.log('🔓 [App] 跳过加载，手动解锁 isModelLoading');
              return;
            }
            
            // 🔑 关键修复：先从数据库加载该文件的资产和空间数据
            console.log('📥 [App] 开始加载数据库数据...');
            try {
              // 获取该文件的资产
              const assetsRes = await fetch(`${API_BASE}/api/files/${activeFile.id}/assets`, { headers: getHeaders() });
              const assetsData = await assetsRes.json();
              if (assetsData.success) {
                assetList.value = assetsData.data.map(asset => ({
                  dbId: asset.db_id,
                  name: asset.name,
                  mcCode: asset.asset_code,
                  classification: asset.classification_code || 'Uncategorized',
                  classification_code: asset.classification_code || '',
                  classification_desc: asset.classification_desc || '',
                  specCode: asset.spec_code,
                  specName: asset.spec_name,
                  floor: asset.floor,
                  room: asset.room,
                  category: asset.category,
                  family: asset.family,
                  type: asset.type,
                  manufacturer: asset.manufacturer,
                  address: asset.address,
                  phone: asset.phone,
                  fileId: activeFile.id // 添加 fileId
                }));
                console.log(`✅ [App] 页面刷新：从数据库加载了 ${assetList.value.length} 个资产`);
              }

              // 获取该文件的空间
              const spacesRes = await fetch(`${API_BASE}/api/files/${activeFile.id}/spaces`, { headers: getHeaders() });
              const spacesData = await spacesRes.json();
              if (spacesData.success) {
                roomList.value = spacesData.data.map(space => ({
                  dbId: space.db_id,
                  name: space.name || '',
                  code: space.space_code,
                  classificationCode: space.classification_code,
                  classificationDesc: space.classification_desc,
                  floor: space.floor,
                  area: space.area,
                  perimeter: space.perimeter,
                  fileId: activeFile.id // 添加 fileId
                }));
                console.log(`✅ [App] 页面刷新：从数据库加载了 ${roomList.value.length} 个空间`);
              }

              // 标记数据库数据已加载
              dbDataLoaded.value = true;
            } catch (dbError) {
              console.warn('⚠️ [App] 加载数据库数据失败，将使用模型数据:', dbError);
            }
            
            // 然后加载模型
            if (activeFile.extracted_path && mainViewRef.value && mainViewRef.value.loadNewModel) {
              console.log('📦 [App] 开始调用 loadNewModel:', activeFile.extracted_path);
              currentLoadedModelPath.value = activeFile.extracted_path;
              await mainViewRef.value.loadNewModel(activeFile.extracted_path);
              console.log('✅ [App] loadNewModel 返回（Promise resolved）');
              
              // 🏠 检查并恢复默认视图
              try {
                const defaultViewRes = await fetch(`${API_BASE}/api/views/default?fileId=${activeFile.id}`, { headers: getHeaders() });
                const defaultViewData = await defaultViewRes.json();
                if (defaultViewData.success && defaultViewData.data) {
                  console.log('🏠 [App] 找到默认视图，正在恢复:', defaultViewData.data.name);
                  
                  // 🔑 更新 currentViewName 让 TopBar 显示视图名称
                  currentViewName.value = defaultViewData.data.name;
                  
                  // 🔑 更新激活文件信息让 ViewsPanel 同步
                  activeFileId.value = activeFile.id;
                  activeFileName.value = activeFile.title || activeFile.name || 'Untitled';
                  
                  // 获取完整视图数据
                  const fullViewRes = await fetch(`${API_BASE}/api/views/${defaultViewData.data.id}`, { headers: getHeaders() });
                  const fullViewData = await fullViewRes.json();
                  if (fullViewData.success && mainViewRef.value?.restoreViewState) {
                    // 使用事件驱动的方式恢复视图，确保模型完全就绪
                    if (mainViewRef.value?.onModelReady) {
                      console.log('⏳ [App] 等待模型就绪后恢复视图...');
                      mainViewRef.value.onModelReady(() => {
                        console.log('🔄 [App] 模型已就绪，正在恢复默认视图...');
                        mainViewRef.value.restoreViewState(fullViewData.data);
                        console.log('✅ [App] 默认视图已恢复');
                      });
                    } else {
                      // 后备方案：直接恢复
                      mainViewRef.value.restoreViewState(fullViewData.data);
                    }
                  }
                } else {
                  console.log('ℹ️ [App] 没有设置默认视图，使用模型默认状态');
                  // 没有默认视图时也更新激活文件信息
                  activeFileId.value = activeFile.id;
                  activeFileName.value = activeFile.title || activeFile.name || 'Untitled';
                }
              } catch (viewErr) {
                console.warn('⚠️ [App] 恢复默认视图失败:', viewErr);
              }
              
              console.log('🔓 [App] 流程结束，解锁 isModelLoading');
              isModelLoading.value = false; // 模型加载完成，解除锁定
              return;
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ 无法获取激活文件，加载默认模型', e);
      }
      
      // 如果没有激活文件，不加载任何模型
      if (mainViewRef.value && mainViewRef.value.loadNewModel) {
        const defaultPath = null;
        if (defaultPath) {
          console.log('📦 加载默认模型');
          currentLoadedModelPath.value = defaultPath;
          await mainViewRef.value.loadNewModel(defaultPath);
        } else {
          console.log('📝 没有激活的模型文件，请先上传并激活模型');
        }
      }
    }
  } catch (error) {
    console.error('❌ [App] Viewer 初始化或模型加载过程出错:', error);
  } finally {
    console.log('🏁 [App] onViewerReady Finally Block - 解锁 isModelLoading');
    isModelLoading.value = false; // 无论如何解除锁定，防止界面死锁
  }
};

const onRoomsLoaded = (rooms) => {
  // 保存模型中的 dbId 列表
  modelRoomDbIds.value = rooms.map(r => r.dbId);
  
  // 如果数据库数据已加载，则使用数据库数据；否则使用模型数据
  if (!dbDataLoaded.value) {
    roomList.value = rooms;
  }
  
  // 【已移除】原自动孤立逻辑 - 模型现在保持默认状态
  // 如果存在默认视图，由 onViewerReady 自动恢复
};

const onAssetsLoaded = (inputAssets) => {
  console.log('📦 Assets data loaded in App:', inputAssets?.length);
  
  // 关键修复：如果模型未返回资产（例如提取失败），但数据库已有数据，则保留数据库数据
  if ((!inputAssets || inputAssets.length === 0) && assetList.value.length > 0) {
    console.warn('⚠️ 模型未返回有效资产数据，保留数据库缓存数据');
    modelAssetDbIds.value = assetList.value.map(a => a.dbId);
    isModelLoading.value = false;
    return;
  }
  
  // create a map of existing DB assets for enrichment
  const dbAssetMap = new Map();
  if (assetList.value.length > 0) {
      assetList.value.forEach(a => {
          if (a.dbId) dbAssetMap.set(a.dbId, a);
      });
  }

  // Normalize assets to ensure camelCase properties exist
  const assets = (inputAssets || []).map(a => {
    // Attempt to enrich from DB cache
    const dbAsset = dbAssetMap.get(a.dbId);
    
    return {
        ...a,
        // IDs
        dbId: a.dbId,
        fileId: a.fileId || a.file_id || dbAsset?.fileId,
        
        // Codes & Names
        mcCode: dbAsset?.mcCode || a.mcCode || a.asset_code || a.code || '',
        name: dbAsset?.name || a.name || '',
        
        // Specs
        specCode: dbAsset?.specCode || a.specCode || a.spec_code || '',
        specName: dbAsset?.specName || a.specName || a.spec_name || '',
        
        // Classification (DB has classification_code, Model has classificationCode/classification_code)
        // We normalize to classificationCode for the app, but keep snake_case if needed
        classificationCode: dbAsset?.classification_code || dbAsset?.classificationCode || a.classificationCode || a.classification_code || '',
        classificationDesc: dbAsset?.classification_desc || dbAsset?.classificationDesc || a.classificationDesc || a.classification_desc || '',
        
        // Location
        floor: dbAsset?.floor || a.floor || '',
        room: dbAsset?.room || a.room || '',

        // Metadata Properties (often missing in Model)
        category: dbAsset?.category || a.category || '',
        family: dbAsset?.family || a.family || '',
        type: dbAsset?.type || a.type || '',
        manufacturer: dbAsset?.manufacturer || a.manufacturer || '',
        address: dbAsset?.address || a.address || '',
        phone: dbAsset?.phone || a.phone || ''
    };
  });

  if (assets.length > 0) {
    const sample = assets[0];
    console.log('🔍 Asset sample (normalized & enriched):', {
      mcCode: sample.mcCode,
      specCode: sample.specCode,
      specName: sample.specName,
      source: dbAssetMap.has(sample.dbId) ? 'Merged DB' : 'Model Only'
    });
  }

  assetList.value = assets;
  modelAssetDbIds.value = assets.map(a => a.dbId);
  isModelLoading.value = false;
};

const onChartDataUpdate = async (data) => {
  chartData.value = data;
  if (mainViewRef.value?.getTimeRange) {
    currentRange.value = mainViewRef.value.getTimeRange();
  }
  
  // 如果有选中的房间，同时刷新 selectedRoomSeries
  if (savedRoomSelections.value.length > 0 && mainViewRef.value?.getTimeRange) {
    const selectedRooms = roomList.value.filter(r => savedRoomSelections.value.includes(r.dbId));
    if (selectedRooms.length > 0) {
      const { startMs, endMs, windowMs } = mainViewRef.value.getTimeRange();
      try {
        const list = await Promise.all(
          selectedRooms.map(r => 
            queryRoomSeries(r.code, startMs, endMs, windowMs, r.fileId) // 传递 fileId
              .then(points => ({ room: r.code, name: r.name, fileId: r.fileId, points })) // 保留 fileId
          )
        );
        selectedRoomSeries.value = list;
        console.log(`📊 已刷新 ${list.length} 个房间的图表数据`);
      } catch (err) {
        console.warn('⚠️ 刷新房间图表数据失败:', err);
      }
    }
  }
};


const aiChatPanelRef = ref(null);

/**
 * 处理 AI 报警推送
 */
const handleAIAlert = (alert) => {
  if (aiChatPanelRef.value) {
    aiChatPanelRef.value.addAlertMessage(alert);
  } else {
    console.warn('⚠️ AI Chat Panel ref not ready for alert:', alert);
  }
};

/**
 * 处理 AI 对话消息发送
 */
const handleAIChatMessage = async (payload, callback) => {
  try {
    const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: payload.text,
        context: payload.context,
        history: payload.history,
        fileId: activeFileId.value
      })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    if (data.success) {
      callback(data.data);
    } else {
      callback({ role: 'assistant', content: `❌ 分析遇到问题: ${data.error}` });
    }
  } catch (e) {
    console.error('AI Chat Error:', e);
    callback({ role: 'assistant', content: `🔌 网络连接错误: ${e.message}` });
  }
};

/**
 * 执行 AI 返回的操作指令
 */
const executeAIAction = async (payload) => {
  console.log('🚀 [AppViewer] 执行 AI 操作:', payload);
  
  // 兼容不同的 payload 结构 (有时 action 在顶层，有时在 params 里)
  const actionType = payload.action || payload.type;
  const params = payload.params || payload; 
  
  if (actionType === 'navigate_to_module' || actionType === 'navigate_module') {
      const { module } = params;
      if (module) switchView(module);
  }
  else if (actionType === 'power_trace_upstream') {
      await handlePowerTraceAction(params);
  }
  else if (actionType === 'locate_room') {
      const { id } = params;
      if (id) {
          console.log(`📍 [AppViewer] 定位房间: ${id}`);
          // 切换到 Connect 视图（或者保持当前），并选中房间
          if (currentView.value !== 'connect' && currentView.value !== 'spaces') {
              switchView('connect');
          }
          
          // 触发选中通知 (更新 UI 状态)
          onModelSelectionChanged([Number(id)]);
          
          // 在 3D 视图中隔离并聚焦
          if (mainViewRef.value?.isolateAndFocusRooms) {
              mainViewRef.value.isolateAndFocusRooms([Number(id)]);
          } else {
              console.warn('⚠️ MainView 不支持 isolateAndFocusRooms');
          }
      }
  }
  else if (actionType === 'acknowledge') {
      console.log('✅ 报警已确认');
      // TODO: Call API to acknowledge alert
  }
  else if (actionType === 'analyze_alert') {
      const { roomCode, roomName, temperature, threshold, alertType, fileId } = params;
      console.log(`🧠 [AppViewer] 用户请求 AI 分析: ${roomName} (${roomCode})`);
      
      // 1. 在聊天框显示 "AI 正在分析..."
      const loadingMsg = { 
          role: 'assistant', 
          content: '正在进行智能分析，请稍候... (分析云端知识库及历史数据)', 
          timestamp: Date.now() 
      };
      if (aiChatPanelRef.value) {
          aiChatPanelRef.value.addMessage(loadingMsg);
          aiChatPanelRef.value.setLoading(true);
          // Auto-open if not open
          if (!aiChatPanelRef.value.isOpen) aiChatPanelRef.value.isOpen = true;
      }

      // 2. 调用服务
      try {
          const result = await triggerTemperatureAlert({
              roomCode, roomName, temperature, threshold, alertType, fileId
          });

          if (aiChatPanelRef.value) {
              aiChatPanelRef.value.setLoading(false);

              if (result.success && result.analysis) {
                const sources = (result.sources || []).map(s => ({
                      ...s,
                      isInternal: true,
                      documentId: s.id || null
                  }));

                  aiChatPanelRef.value.addMessage({
                      role: 'assistant',
                      content: result.analysis,
                      sources: sources,
                      timestamp: Date.now()
                  });
              } else {
                aiChatPanelRef.value.addMessage({
                      role: 'assistant',
                      content: `⚠️ 分析失败: ${result.error || '未知错误'}`,
                      timestamp: Date.now()
                  });
              }
          }
      } catch (e) {
          if (aiChatPanelRef.value) {
              aiChatPanelRef.value.setLoading(false);
              console.error('AI Analysis Error:', e);
              aiChatPanelRef.value.addMessage({
                  role: 'assistant',
                  content: `❌ 分析过程发生异常: ${e.message}`,
                  timestamp: Date.now()
              });
          }
      }
  } else {
      console.warn('⚠️ 未知的 AI 操作类型:', actionType);
  }
};

/**
 * 打开文档预览 (由 AI Chat 触发)
 */
const onOpenSource = async (source) => {
  const { id } = source;
  if (!id) return;
  
  console.log('📄 [AppViewer] 打开引用文档:', id);
  try {
    const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
    const res = await fetch(`${API_BASE}/api/documents/${id}`, { headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      previewDocument.value = data.data;
      previewVisible.value = true;
    } else {
      console.warn('Failed to load document:', data.error);
    }
  } catch (e) {
    console.error('Failed to open document:', e);
  }
};


/**
 * 处理电源追溯操作
 */
const handlePowerTraceAction = async (params) => {
  const { mcCode } = params;
  
  if (!mcCode) {
    console.warn('⚠️ 电源追溯缺少 mcCode 参数');
    return;
  }
  
  console.log(`⚡ [AppViewer] AI 触发电源追溯: ${mcCode}`);
  
  // 1. 切换到 RDS 模块 (保留当前选择，防止属性面板清空)
  if (currentView.value !== 'rds') {
    switchView('rds', true);
    await nextTick();
  }
  
  // 2. 轮询等待 AspectTreePanel 组件就绪（最多 3 秒，每 100ms 检查一次）
  for (let i = 0; i < 30; i++) {
    if (aspectTreePanelRef.value?.switchToPowerAndTrace) break;
    await new Promise(r => setTimeout(r, 100));
  }
  
  if (aspectTreePanelRef.value && aspectTreePanelRef.value.switchToPowerAndTrace) {
    const success = await aspectTreePanelRef.value.switchToPowerAndTrace(mcCode);
    if (!success) {
       console.warn(`⚠️ 未找到设备或组件未就绪: ${mcCode}`);
    }
  } else {
    console.error('❌ AspectTreePanel 组件 ref 不可用');
  }
};


const switchView = (view, preserveSelection = false) => {
  currentView.value = view;
  
  // 切换视图时默认清除选择，除非显式指定保留 (如 AI 联动场景)
  if (!preserveSelection) {
    selectedRoomProperties.value = null;
    currentSelectionType.value = null;
  }

  // 缺陷修复：当切换到文档管理界面时，MainView 会被卸载
  // 我们需要重置 currentLoadedModelPath，以便当用户返回 模型视图 时
  // MainView 重新挂载后能触发模型的重新加载
  if (view === 'documents') {
    console.log('🔄 切换到文档管理，重置模型加载状态');
    currentLoadedModelPath.value = null;
  }

  // 注意：不在这里立即调用 showAllAssets/showAllRooms
  // 因为可能模型还没加载完成，让 onAssetsLoaded/onRoomsLoaded 处理
  
  // 温度标签和热力图按钮现在是全局的，不受视图切换影响
  // 由用户通过按钮控制显示/隐藏
};

// 重新加载当前文件的资产（用于删除资产后刷新）
const reloadCurrentFileAssets = async () => {
  if (activeFileId.value) {
    console.log('🔄 重新加载当前文件资产:', activeFileId.value);
    // 复用已有的加载逻辑，构造一个伪文件对象调用 onFileActivated
    // 或者更干净的做法是提取加载逻辑。
    // 这里为了最快实现，直接调用 API 获取最新数据更新 assetList
    try {
      const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
      const assetsRes = await fetch(`${API_BASE}/api/files/${activeFileId.value}/assets`, { headers: getHeaders() });
      const assetsData = await assetsRes.json();
      
      if (assetsData.success) {
        assetList.value = assetsData.data.map(asset => ({
          dbId: asset.db_id,
          name: asset.name,
          mcCode: asset.asset_code,
          classification: asset.classification_code || 'Uncategorized',
          classification_code: asset.classification_code || '',
          classification_desc: asset.classification_desc || '',
          specCode: asset.spec_code,
          specName: asset.spec_name,
          floor: asset.floor,
          room: asset.room,
          category: asset.category,
          family: asset.family,
          type: asset.type,
          manufacturer: asset.manufacturer,
          address: asset.address,
          phone: asset.phone,
          fileId: activeFileId.value
        }));
        console.log(`✅ 重新加载完成: ${assetList.value.length} 个资产`);
        
        // 清除选择状态
        savedAssetSelections.value = [];
        selectedObjectIds.value = [];
      }
    } catch (e) {
      console.error('❌ 重新加载资产失败:', e);
    }
  }
};

// 重新加载当前文件的空间（用于删除空间后刷新）
const reloadCurrentFileSpaces = async () => {
  if (activeFileId.value) {
    console.log('🔄 重新加载当前文件空间:', activeFileId.value);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
      const spacesRes = await fetch(`${API_BASE}/api/files/${activeFileId.value}/spaces`, { headers: getHeaders() });
      const spacesData = await spacesRes.json();
      
      if (spacesData.success) {
        roomList.value = spacesData.data.map(space => ({
          dbId: space.db_id,
          name: space.name || '',
          code: space.space_code,
          classificationCode: space.classification_code,
          classificationDesc: space.classification_desc,
          floor: space.floor,
          area: space.area,
          perimeter: space.perimeter,
          fileId: activeFileId.value
        }));
        console.log(`✅ 重新加载完成: ${roomList.value.length} 个空间`);
        
        // 清除选择状态
        savedRoomSelections.value = [];
        selectedObjectIds.value = [];
      }
    } catch (e) {
      console.error('❌ 重新加载空间失败:', e);
    }
  }
};

// 文件激活后加载对应的资产和空间数据
const onFileActivated = async (file) => {
  console.log('📂 文件已激活:', file);
  
  // 更新当前激活的文件信息（用于视图面板）
  activeFileId.value = file.id;
  activeFileName.value = file.title || file.name || 'Untitled';
  
  try {
    // 从数据库加载该文件的资产和空间
    const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
    // 加载文件的资产和空间数据
    console.log('📂 [App.vue] onFileActivated called with file:', file);
    console.log('📂 [App.vue] file.id:', file.id);

    // 获取该文件的资产
    const assetsRes = await fetch(`${API_BASE}/api/files/${file.id}/assets`, { headers: getHeaders() });
    const assetsData = await assetsRes.json();
    if (assetsData.success) {
      assetList.value = assetsData.data.map(asset => ({
        dbId: asset.db_id,
        name: asset.name,
        mcCode: asset.asset_code,
        classification: asset.classification_code || 'Uncategorized',
        classification_code: asset.classification_code || '',
        classification_desc: asset.classification_desc || '',
        specCode: asset.spec_code,
        specName: asset.spec_name,
        floor: asset.floor,
        room: asset.room,
        category: asset.category,
        family: asset.family,
        type: asset.type,
        manufacturer: asset.manufacturer,
        address: asset.address,
        phone: asset.phone,
        fileId: file.id // 添加 fileId 以便 AI 分析使用
      }));
      console.log(`📊 加载了 ${assetList.value.length} 个资产`);
    } else {
      assetList.value = [];
      console.log('⚠️ 该文件没有资产数据');
    }

    // 获取该文件的空间
    const spacesRes = await fetch(`${API_BASE}/api/files/${file.id}/spaces`, { headers: getHeaders() });
    const spacesData = await spacesRes.json();
    if (spacesData.success) {
      roomList.value = spacesData.data.map(space => ({
        dbId: space.db_id,
        name: space.name || '',
        code: space.space_code,
        classificationCode: space.classification_code,
        classificationDesc: space.classification_desc,
        floor: space.floor,
        area: space.area,
        perimeter: space.perimeter,
        fileId: file.id // 添加 fileId 以便 AI 分析使用
      }));
      console.log(`📊 加载了 ${roomList.value.length} 个空间`);
    } else {
      roomList.value = [];
      console.log('⚠️ 该文件没有空间数据');
    }

    // 标记数据库数据已加载，防止被 Viewer 数据覆盖
    dbDataLoaded.value = true;

    // 清除选择状态
    savedAssetSelections.value = [];
    savedRoomSelections.value = [];
    selectedRoomProperties.value = null;
    selectedObjectIds.value = [];
    selectedRoomSeries.value = []; // 清除下方图表数据
    chartData.value = []; // 清除平均值图表数据

    // 加载对应的 3D 模型
    if (file.extracted_path) {
      if (viewerReady.value && mainViewRef.value && mainViewRef.value.loadNewModel) {
        // 只有当切换到不同的模型时才刷新页面
        // 避免初次加载或相同模型时无限刷新
        if (currentLoadedModelPath.value && currentLoadedModelPath.value !== file.extracted_path) {
          console.log('🔄 切换到不同模型，刷新页面...');
          window.location.reload();
          return;
        }
        
        // 首次加载或相同模型，正常加载
        currentLoadedModelPath.value = file.extracted_path;
        console.log('📦 等待模型加载完成...');
        try {
          await mainViewRef.value.loadNewModel(file.extracted_path);
          console.log('📦 模型加载完成');
        } catch (e) {
          console.error('❌ 模型加载失败:', e);
        }
        
        // 模型加载后刷新时序数据
        if (mainViewRef.value && mainViewRef.value.refreshTimeSeriesData) {
          mainViewRef.value.refreshTimeSeriesData();
        }
      } else {
        // Viewer 尚未准备好，保存待加载文件
        console.log('📦 Viewer 尚未准备好，保存待加载文件');
        pendingActiveFile.value = file;
      }
    }

    // 切换到资产视图
    switchView('assets');
    
  } catch (error) {
    console.error('加载文件数据失败:', error);
  }
};

const onRoomsSelected = (dbIds) => {
  savedRoomSelections.value = dbIds.slice();
  // 调用 MainView 的方法来孤立并定位房间
  if (mainViewRef.value) {
    if (dbIds.length === 0) {
      // 未选中任何房间，显示所有房间
      selectedRoomProperties.value = null;
      if (mainViewRef.value.showAllRooms) {
        mainViewRef.value.showAllRooms();
      }
      // 温度标签由用户通过按钮控制，不再自动显示
    } else if (dbIds.length === 1) {
      // 选中了一个房间，显示该房间的属性
      if (mainViewRef.value.isolateAndFocusRooms) {
        mainViewRef.value.isolateAndFocusRooms(dbIds);
      }

      // 从数据库数据（roomList）获取属性，而不是从模型
      const room = roomList.value.find(r => r.dbId === dbIds[0]);
      if (room) {
        selectedRoomProperties.value = {
          code: room.code || '',
          name: room.name || '',
          area: room.area || '',
          perimeter: room.perimeter || '',
          level: room.floor || '',
          spaceNumber: room.classificationCode || '',
          spaceDescription: room.classificationDesc || ''
        };
      }
    } else {
      // 选中了多个房间，合并属性：相同显示实际值，不同显示 VARIES
      if (mainViewRef.value.isolateAndFocusRooms) {
        mainViewRef.value.isolateAndFocusRooms(dbIds);
      }

      // 从数据库数据（roomList）获取所有选中房间的属性
      const selectedRooms = dbIds.map(dbId => roomList.value.find(r => r.dbId === dbId)).filter(Boolean);
      
      if (selectedRooms.length > 0) {
        const VARIES_VALUE = '__VARIES__';
        
        console.log('🔍 多选房间属性比较开始（使用数据库数据）', {
          房间数量: selectedRooms.length,
          第一个房间: selectedRooms[0]
        });
        
        // 辅助函数：判断两个值是否相同（把 null, undefined, '' 视为相同）
        const isSameValue = (v1, v2) => {
          const normalize = (v) => (v == null || v === '') ? '' : String(v);
          const n1 = normalize(v1);
          const n2 = normalize(v2);
          const result = n1 === n2;
          
          if (!result && v1 !== VARIES_VALUE && v2 !== VARIES_VALUE) {
            console.log('  ❌ 房间属性值不同:', { v1, v2, n1, n2 });
          }
          
          return result;
        };
        
        const base = selectedRooms[0];
        const merged = {
          code: base.code || '',
          name: base.name || '',
          area: base.area || '',
          perimeter: base.perimeter || '',
          level: base.floor || '',
          spaceNumber: base.classificationCode || '',
          spaceDescription: base.classificationDesc || '',
          isMultiple: true
        };
        
        // 关键修复：用base来比较，不要在循环中修改merged
        for (let i = 1; i < selectedRooms.length; i++) {
          console.log(`  比较第 ${i + 1} 个房间:`, selectedRooms[i]);
          const room = selectedRooms[i];
          
          // 每次都和base比较，如果任何一个不同就标记为VARIES
          if (merged.code !== VARIES_VALUE && !isSameValue(base.code, room.code)) {
            console.log('  ❗ code 不同');
            merged.code = VARIES_VALUE;
          }
          if (merged.name !== VARIES_VALUE && !isSameValue(base.name, room.name)) {
            console.log('  ❗ name 不同');
            merged.name = VARIES_VALUE;
          }
          if (merged.area !== VARIES_VALUE && !isSameValue(base.area, room.area)) {
            console.log('  ❗ area 不同');
            merged.area = VARIES_VALUE;
          }
          if (merged.perimeter !== VARIES_VALUE && !isSameValue(base.perimeter, room.perimeter)) {
            console.log('  ❗ perimeter 不同');
            merged.perimeter = VARIES_VALUE;
          }
          if (merged.level !== VARIES_VALUE && !isSameValue(base.floor, room.floor)) {
            console.log('  ❗ level 不同');
            merged.level = VARIES_VALUE;
          }
          if (merged.spaceNumber !== VARIES_VALUE && !isSameValue(base.classificationCode, room.classificationCode)) {
            console.log('  ❗ spaceNumber 不同');
            merged.spaceNumber = VARIES_VALUE;
          }
          if (merged.spaceDescription !== VARIES_VALUE && !isSameValue(base.classificationDesc, room.classificationDesc)) {
            console.log('  ❗ spaceDescription 不同');
            merged.spaceDescription = VARIES_VALUE;
          }
        }
        
        console.log('✅ 合并后的房间属性:', merged);
        selectedRoomProperties.value = merged;
      } else {
        selectedRoomProperties.value = { isMultiple: true };
      }
    }
  }

  // 更新底部图表：按选中房间显示多图
  const selectedRooms = roomList.value.filter(r => dbIds.includes(r.dbId));
  if (mainViewRef.value?.setSelectedRooms) {
    mainViewRef.value.setSelectedRooms(selectedRooms.map(r => r.code));
  }
  if (selectedRooms.length === 0) {
    selectedRoomSeries.value = [];
    return;
  }
  if (mainViewRef.value?.getTimeRange) {
    const { startMs, endMs, windowMs } = mainViewRef.value.getTimeRange();
    Promise.all(selectedRooms.map(r => queryRoomSeries(r.code, startMs, endMs, windowMs, r.fileId).then(points => ({ room: r.code, name: r.name, fileId: r.fileId, points }))))
      .then(list => { selectedRoomSeries.value = list; })
      .catch(() => { selectedRoomSeries.value = []; });
  }
};

const onAssetsSelected = async (dbIds) => {
  savedAssetSelections.value = dbIds.slice();
  
  // 更新选中的对象ID列表（使用 mcCode）
  selectedObjectIds.value = dbIds.map(dbId => {
    const asset = assetList.value.find(a => a.dbId === dbId);
    return asset?.mcCode;
  }).filter(Boolean);

  // 根据选中数量更新属性面板
  if (dbIds.length === 0) {
    // 未选中任何资产
    selectedRoomProperties.value = null;
    mainViewRef.value?.showAllAssets();
  } else {
    // 孤立显示选中的资产
    if (mainViewRef.value?.isolateAndFocusAssets) {
      if (dbIds.length > 500) {
        // 如果选中数量过多，只聚焦不完全重绘，提升性能
         mainViewRef.value.isolateAndFocusAssets(dbIds);
      } else {
         mainViewRef.value.isolateAndFocusAssets(dbIds);
      }
    }

    const dbProps = getPropertiesFromSelection(dbIds, assetList.value, 'asset');
    if (dbProps) {
      selectedRoomProperties.value = dbProps;
    } else if (dbIds.length === 1 && mainViewRef.value?.getAssetProperties) {
      // 回退到模型数据
      mainViewRef.value.getAssetProperties(dbIds[0]).then(props => {
        selectedRoomProperties.value = props;
      });
    } else {
      selectedRoomProperties.value = { isMultiple: true };
    }
  }
};

// 处理空间选择事件
const onSpacesSelected = async (dbIds) => {
  savedSpaceSelections.value = dbIds.slice();
  
  // 更新选中的对象ID列表（使用 space code）
  selectedObjectIds.value = dbIds.map(dbId => {
    const space = roomList.value.find(s => s.dbId === dbId);
    return space?.code;
  }).filter(Boolean);

  // 根据选中数量更新属性面板和模型隔离
  if (dbIds.length === 0) {
    // 未选中任何空间
    selectedRoomProperties.value = null;
    mainViewRef.value?.showAllRooms();
  } else {
    // 孤立显示选中的空间
    if (mainViewRef.value?.isolateAndFocusRooms) {
      mainViewRef.value.isolateAndFocusRooms(dbIds);
    }

    const dbProps = getPropertiesFromSelection(dbIds, roomList.value, 'space');
    if (dbProps) {
      selectedRoomProperties.value = dbProps;
    } else {
      selectedRoomProperties.value = { isMultiple: true };
    }
  }
};

// 处理属性变更事件
const onPropertyChanged = ({ fieldName, newValue }) => {
  console.log(`📝 App.vue 收到属性变更: ${fieldName} = ${newValue}`);
  
  // 更新 selectedRoomProperties
  if (selectedRoomProperties.value) {
    selectedRoomProperties.value[fieldName] = newValue;
  }
  
  // 根据当前视图更新对应的列表数据
  if (currentView.value === 'assets') {
    // 批量更新 assetList
    const codes = selectedObjectIds.value.length > 0 ? selectedObjectIds.value : [selectedRoomProperties.value?.mcCode];
    
    codes.forEach(mcCode => {
      const currentAsset = assetList.value.find(a => a.mcCode === mcCode);
      if (currentAsset) {
        // 字段名映射：前端字段 -> 数据列表字段
        const fieldMap = {
          name: 'name',
          typeComments: 'specCode',
          specName: 'specName',
          level: 'floor',
          room: 'room',
          omniClass21Number: 'classification_code',
          omniClass21Description: 'classification_desc',
          category: 'category',
          family: 'family',
          type: 'type',
          manufacturer: 'manufacturer',
          address: 'address',
          phone: 'phone'
        };
        
        const listField = fieldMap[fieldName];
        if (listField) {
          currentAsset[listField] = newValue;
          console.log(`✅ 已更新 assetList 中 ${mcCode} 的 ${listField}`);
        }
      }
    });
  } else {
    // 批量更新 roomList
    const codes = selectedObjectIds.value.length > 0 ? selectedObjectIds.value : [selectedRoomProperties.value?.code];
    
    codes.forEach(code => {
      const currentRoom = roomList.value.find(r => r.code === code);
      if (currentRoom) {
        const fieldMap = {
          name: 'name',
          area: 'area',
          perimeter: 'perimeter',
          level: 'floor',
          spaceNumber: 'classificationCode',
          spaceDescription: 'classificationDesc'
        };
        
        const listField = fieldMap[fieldName];
        if (listField) {
          currentRoom[listField] = newValue;
          console.log(`✅ 已更新 roomList 中 ${code} 的 ${listField}`);
        }
      }
    });
  }
};


// 🔑 仅加载资产属性（反向定位专用，不触发孤立操作）
const loadAssetProperties = async (dbIds) => {
  if (!dbIds || dbIds.length === 0) {
    selectedRoomProperties.value = null;
    return;
  }

 // 1. 优先从后端 API 获取最新完整数据 (支持 Element 和 Type 属性)
  if (dbIds.length === 1) {
    try {
      const dbId = dbIds[0];
      console.log(`🔍 [PropertyLoad] Starting API fetch for DBID: ${dbId}, FileID: ${activeFileId.value}, View: ${currentView.value}`);
      
      const apiAsset = await getAssetDetailByDbId(dbId, activeFileId.value);
      console.log(`🔍 [PropertyLoad] API Response:`, apiAsset ? 'Found' : 'Null');
      
      if (apiAsset) {
        // 格式化 API 返回的蛇形字段数据
        const formattedProps = formatAssetProperties(apiAsset);
        console.log(`🔍 [PropertyLoad] Formatted Props:`, formattedProps);
        selectedRoomProperties.value = formattedProps;
        
        // 关键：确保 assetCode 存在以便加载文档
        if (formattedProps.mcCode) {
           // 更新 assetList 中的缓存 (可选)
           // 触发文档加载
           // 注意：onPropertyChanged 中会用到 selectedRoomProperties.value.mcCode
        }
        return; 
      } else {
         console.warn(`⚠️ [PropertyLoad] API returned null for DBID: ${dbId} in File: ${activeFileId.value}`);
      }
    } catch (err) {
      console.warn('❌ API 获取资产详情失败，回退到本地缓存', err);
    }
  }

  // 2. 回退：从本地 assetList 获取 (主要是多选或 API 失败时)
  const dbProps = getPropertiesFromSelection(dbIds, assetList.value, 'asset');
  
  console.log('🔍 loadAssetProperties debug:', {
    dbIds,
    assetListSize: assetList.value?.length,
    foundProps: dbProps
  });

  if (dbProps) {
    selectedRoomProperties.value = dbProps;
  } else if (dbIds.length === 1 && mainViewRef.value?.getAssetProperties) {
    // 2. 回退到模型数据
    mainViewRef.value.getAssetProperties(dbIds[0]).then(props => {
      selectedRoomProperties.value = props;
    });
  } else {
    selectedRoomProperties.value = { isMultiple: true };
  }
};

// 🔑 仅加载房间属性（反向定位专用，不触发孤立操作）
const loadRoomProperties = (dbIds) => {
  if (!dbIds || dbIds.length === 0) {
    selectedRoomProperties.value = null;
    return;
  }

  if (dbIds.length === 1) {
    // 单选：显示单个房间属性
    if (mainViewRef.value?.getRoomProperties) {
      mainViewRef.value.getRoomProperties(dbIds[0]).then(props => {
        selectedRoomProperties.value = props;
      });
    }
  } else {
    // 多选：合并属性
    if (mainViewRef.value?.getRoomProperties) {
      const VARIES_VALUE = '__VARIES__';
      
      // 辅助函数：判断两个值是否相同（把 null, undefined, '' 视为相同）
      const isSameValue = (v1, v2) => {
        const normalize = (v) => (v == null || v === '') ? '' : String(v);
        return normalize(v1) === normalize(v2);
      };
      
      Promise.all(dbIds.map(id => mainViewRef.value.getRoomProperties(id))).then(allProps => {
        const base = allProps[0] || {};
        const merged = {
          code: base.code,
          name: base.name,
          area: base.area,
          perimeter: base.perimeter,
          spaceNumber: base.spaceNumber,
          spaceDescription: base.spaceDescription,
          isMultiple: true
        };
        
        for (let i = 1; i < allProps.length; i++) {
          const p = allProps[i] || {};
          if (!isSameValue(merged.code, p.code)) merged.code = VARIES_VALUE;
          if (!isSameValue(merged.name, p.name)) merged.name = VARIES_VALUE;
          if (!isSameValue(merged.area, p.area)) merged.area = VARIES_VALUE;
          if (!isSameValue(merged.perimeter, p.perimeter)) merged.perimeter = VARIES_VALUE;
          if (!isSameValue(merged.spaceNumber, p.spaceNumber)) merged.spaceNumber = VARIES_VALUE;
          if (!isSameValue(merged.spaceDescription, p.spaceDescription)) merged.spaceDescription = VARIES_VALUE;
        }
        
        selectedRoomProperties.value = merged;
      });
    } else {
      selectedRoomProperties.value = { isMultiple: true };
    }
  }
};

// 🔑 仅加载空间属性（反向定位专用，不触发孤立操作）
const loadSpaceProperties = (dbIds) => {
  if (!dbIds || dbIds.length === 0) {
    selectedRoomProperties.value = null;
    return;
  }

  if (dbIds.length === 1) {
    // 单选：从 roomList 中获取空间属性
    const space = roomList.value.find(s => s.dbId === dbIds[0]);
    if (space) {
      selectedRoomProperties.value = {
        name: space.name,
        code: space.code,
        level: space.floor,
        area: space.area,
        perimeter: space.perimeter,
        spaceNumber: space.classificationCode || '',
        spaceDescription: space.classificationDesc || ''
      };
    }
  } else {
    // 多选：合并属性
    const VARIES_VALUE = '__VARIES__';
    
    const isSameValue = (v1, v2) => {
      const normalize = (v) => (v == null || v === '') ? '' : String(v);
      return normalize(v1) === normalize(v2);
    };
    
    const selectedSpaces = dbIds.map(id => roomList.value.find(s => s.dbId === id)).filter(Boolean);
    
    if (selectedSpaces.length > 0) {
      const base = selectedSpaces[0];
      const merged = {
        name: base.name,
        code: base.code,
        level: base.floor,
        area: base.area,
        perimeter: base.perimeter,
        spaceNumber: base.classificationCode || '',
        spaceDescription: base.classificationDesc || '',
        isMultiple: true
      };
      
      for (let i = 1; i < selectedSpaces.length; i++) {
        const p = selectedSpaces[i];
        if (!isSameValue(merged.name, p.name)) merged.name = VARIES_VALUE;
        if (!isSameValue(merged.code, p.code)) merged.code = VARIES_VALUE;
        if (!isSameValue(merged.level, p.floor)) merged.level = VARIES_VALUE;
        if (!isSameValue(merged.area, p.area)) merged.area = VARIES_VALUE;
        if (!isSameValue(merged.perimeter, p.perimeter)) merged.perimeter = VARIES_VALUE;
        if (!isSameValue(merged.spaceNumber, p.classificationCode)) merged.spaceNumber = VARIES_VALUE;
        if (!isSameValue(merged.spaceDescription, p.classificationDesc)) merged.spaceDescription = VARIES_VALUE;
      }
      
      selectedRoomProperties.value = merged;
    } else {
      selectedRoomProperties.value = { isMultiple: true };
    }
  }
};

const openRightPanel = () => {
  isRightPanelOpen.value = true;
  triggerResize(); // 面板出现时，强制刷新布局
};

// 切换图表面板
const toggleChartPanel = (isOpen) => {
  // 如果没有传参数，则切换状态；否则使用传入的值
  isChartPanelOpen.value = isOpen !== undefined ? isOpen : !isChartPanelOpen.value;
  // 使用 nextTick 确保 DOM 更新后再 resize
  nextTick(() => {
    if (mainViewRef.value?.resizeViewer) {
      mainViewRef.value.resizeViewer();
    }
    triggerResize();
  });
  // 动画完成后再触发一次（0.3s 是 CSS transition 时间）
  setTimeout(() => {
    if (mainViewRef.value?.resizeViewer) {
      mainViewRef.value.resizeViewer();
    }
    triggerResize();
  }, 350);
};

// 切换 AI 分析功能
const toggleAIAnalysis = () => {
  isAIAnalysisEnabled.value = !isAIAnalysisEnabled.value;
  console.log(`🤖 AI 分析功能: ${isAIAnalysisEnabled.value ? '开启' : '关闭'}`);
};

// 关闭图表面板
const closeChartPanel = () => {
  isChartPanelOpen.value = false;
  // 使用 nextTick 确保 DOM 更新后再 resize
  nextTick(() => {
    if (mainViewRef.value?.resizeViewer) {
      mainViewRef.value.resizeViewer();
    }
    triggerResize();
  });
  // 动画完成后再触发一次
  setTimeout(() => {
    if (mainViewRef.value?.resizeViewer) {
      mainViewRef.value.resizeViewer();
    }
    triggerResize();
  }, 350);
};

const closeRightPanel = () => {
  isRightPanelOpen.value = false;
  triggerResize(); // 面板关闭时，强制刷新布局
};

// === 核心修复：强制触发 Resize 事件 ===
// Autodesk Viewer 监听 window resize，这样可以间接让 Viewer 适应新容器大小
const triggerResize = () => {
  nextTick(() => {
    window.dispatchEvent(new Event('resize'));
  });
};

let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;
let currentResizeSide = '';

const startResize = (event, side) => {
  currentResizeSide = side;
  startX = event.clientX;
  startY = event.clientY;
  
  if (side === 'left') {
    startWidth = leftWidth.value;
  } else if (side === 'right') {
    startWidth = rightWidth.value;
  } else if (side === 'chart') {
    startHeight = chartPanelHeight.value;
  }
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', stopResize);
  
  if (side === 'chart') {
    document.body.style.cursor = 'row-resize';
  } else {
    document.body.style.cursor = 'col-resize';
  }
  
  document.body.style.userSelect = 'none';
};

const onMouseMove = (event) => {
  if (currentResizeSide === 'chart') {
    // 处理图表高度调节 - 只更新高度值，不触发resize
    const dy = startY - event.clientY;
    const newHeight = startHeight + dy;
    if (newHeight > 150 && newHeight < 600) {
      chartPanelHeight.value = newHeight;
    }
  } else {
    const dx = event.clientX - startX;
    if (currentResizeSide === 'left') {
      const newWidth = startWidth + dx;
      const maxWidth = window.innerWidth * 0.6; // 允许最大拖拽至屏幕宽度的 60%
      if (newWidth > 200 && newWidth < maxWidth) {
        leftWidth.value = newWidth;
      }
    } else if (currentResizeSide === 'right') {
      const newWidth = startWidth - dx;
      if (newWidth > 250 && newWidth < 800) {
        rightWidth.value = newWidth;
      }
    }
  }
};

const stopResize = () => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  
  // 拖拽结束后统一触发resize，确保viewer正确调整大小
  if (currentResizeSide) {
    nextTick(() => {
      if (currentResizeSide === 'chart' && mainViewRef.value?.resizeViewer) {
        mainViewRef.value.resizeViewer();
      }
      triggerResize();
    });
    currentResizeSide = '';
  }
};

const onHoverSync = ({ time, percent }) => {
  if (mainViewRef.value && typeof mainViewRef.value.syncTimelineHover === 'function') {
    mainViewRef.value.syncTimelineHover(time, percent);
  }
};

const onTimeRangeChanged = ({ startMs, endMs, windowMs }) => {
  currentRange.value = { startMs, endMs, windowMs };
  if (!selectedRoomSeries.value.length) return;
  const rooms = selectedRoomSeries.value.map(s => ({ room: s.room, name: s.name, fileId: s.fileId }));
  console.log('🔄 [App] 时间范围变化，更新图表:', { range: { startMs, endMs }, rooms: rooms.map(r => ({ code: r.room, fileId: r.fileId })) });
  if (mainViewRef.value?.setSelectedRooms) {
    mainViewRef.value.setSelectedRooms(rooms.map(r => r.room));
  }
  Promise.all(rooms.map(r => queryRoomSeries(r.room, startMs, endMs, windowMs, r.fileId).then(points => ({ room: r.room, name: r.name, fileId: r.fileId, points }))))
    .then(list => { selectedRoomSeries.value = list; })
    .catch(() => {});
};


// 🔑 反向定位：在3D模型中选中构件后，自动更新左侧列表的选中状态
// update: 增强逻辑，支持跨模块联动（选中什么显示什么属性）
const onModelSelectionChanged = (dbIds) => {
  // 先清除所有类型的选中状态，确保状态纯净（Forge Viewer 通常是互斥选择）
  savedAssetSelections.value = [];
  savedRoomSelections.value = [];
  savedSpaceSelections.value = [];
  
  if (!dbIds || dbIds.length === 0) {
    selectedRoomProperties.value = null;
    currentSelectionType.value = null;
    return;
  }

  // 识别选中对象的类型
  // 注意：dbIds 是数字数组，列表中的 dbId 可能也是数字或字符串，需统一类型比较
  const isAsset = assetList.value.some(a => dbIds.includes(Number(a.dbId)));
  const isSpace = roomList.value.some(r => dbIds.includes(Number(r.dbId)));

  // 更新 AI 上下文
  if (dbIds && dbIds.length === 1) {
    if (isAsset) {
        const asset = assetList.value.find(a => Number(a.dbId) === dbIds[0]);
        if (asset) aiContext.value = { id: String(asset.dbId), name: asset.name, type: 'asset', properties: asset };
    } else if (isSpace) {
        const space = roomList.value.find(s => Number(s.dbId) === dbIds[0]);
        if (space) aiContext.value = { id: String(space.dbId), name: space.name, type: 'space', properties: space };
    } else {
        aiContext.value = null;
    }
  } else {
      aiContext.value = null;
  }

  if (isAsset) {
    console.log('📦 [Selection] 识别为资产:', dbIds);
    currentSelectionType.value = 'asset';
    savedAssetSelections.value = dbIds;
    
    // 加载资产属性
    loadAssetProperties(dbIds);
    
    // UI 联动：如果在资产模块，滚动列表
    if (currentView.value === 'assets' && assetPanelRef.value) {
      nextTick(() => {
        assetPanelRef.value.expandAndScrollToAsset(dbIds);
      });
    } else if (currentView.value === 'rds') {
      // RDS 模块：尝试在树中选中
      if (aspectTreePanelRef.value) {
        const mcCodes = dbIds.map(id => {
          const asset = assetList.value.find(a => Number(a.dbId) === id);
          return asset?.mcCode;
        }).filter(Boolean);
        
        if (mcCodes.length > 0) {
          aspectTreePanelRef.value.selectByMcCodes(mcCodes);
        }
      }
    }
    
  } else if (isSpace) {
    console.log('🏠 [Selection] 识别为空间:', dbIds);
    currentSelectionType.value = 'space';
    
    // 更新空间相关的选中状态 (connect 和 spaces 视图共用逻辑)
    savedSpaceSelections.value = dbIds;
    savedRoomSelections.value = dbIds; 
    
    // 加载空间属性 (统一使用 SpaceProperties 逻辑)
    loadSpaceProperties(dbIds);
    
    // UI 联动：如果在空间模块，滚动列表
    if (currentView.value === 'spaces' && spacePanelRef.value) {
      nextTick(() => {
        spacePanelRef.value.expandAndScrollToSpace(dbIds);
      });
    }
    
  } else {
    console.warn('⚠️ [Selection] 未知对象类型，回退到默认视图逻辑:', dbIds);
    currentSelectionType.value = null;
    
    // 回退处理：根据当前视图尝试加载属性
    if (currentView.value === 'assets' || currentView.value === 'rds') {
        savedAssetSelections.value = dbIds;
        loadAssetProperties(dbIds);
    } else if (currentView.value === 'connect') {
        savedRoomSelections.value = dbIds;
        loadRoomProperties(dbIds);
    } else if (currentView.value === 'spaces') {
        savedSpaceSelections.value = dbIds;
        loadSpaceProperties(dbIds);
    }
  }
};

// ==================== RDS 方面树事件处理 ====================

/**
 * 处理 RDS 编码高亮请求
 * 将选中编码对应的 BIM GUID 转换为 dbId 并在模型中隔离显示
 */
const onHighlightGuids = async (payload) => {
  // 兼容旧格式(数组)和新格式({guids, refCodes, searchQueries})
  let guids = [];
  let refCodes = [];
  let searchQueries = [];

  if (Array.isArray(payload)) {
      guids = payload;
  } else if (payload) {
      guids = payload.guids || [];
      refCodes = payload.refCodes || [];
      searchQueries = payload.searchQueries || [];
  }
  
  if (guids.length === 0 && refCodes.length === 0 && searchQueries.length === 0) {
    // 🔴 如果没有任何选中项，清除高亮并恢复显示所有资产
    if (mainViewRef.value && mainViewRef.value.showAllAssets) {
      console.log('🧹 [RDS] 清除高亮，显示所有资产');
      mainViewRef.value.showAllAssets();
    }
    return;
  }
  
  console.log(`🔍 [RDS] 高亮请求: ${guids.length} GUIDs, ${refCodes.length} RefCodes, ${searchQueries.length} Queries`);
  
  if (mainViewRef.value && mainViewRef.value.highlightBimObjects) {
      // 优先使用新方法
      if (searchQueries.length > 0) {
          // 传递高级查询对象
          mainViewRef.value.highlightBimObjects(guids, { queries: searchQueries });
      } else {
          // 兼容旧调用
          mainViewRef.value.highlightBimObjects(guids, refCodes);
      }
  } else if (mainViewRef.value && mainViewRef.value.isolateByExternalIds && guids.length > 0) {
    // 降级：仅使用 External ID
    mainViewRef.value.isolateByExternalIds(guids);
  }
};

/**
 * 处理拓扑追溯结果
 * 显示追溯路径上的所有节点
 */
const onTraceResult = (nodes) => {
  if (!nodes || nodes.length === 0) return;
  
  console.log(`🔗 [RDS] 追溯结果: ${nodes.length} 个节点`);
  
  // 收集所有节点的 BIM GUID
  const allGuids = nodes
    .filter(node => node.bim_guid)
    .map(node => node.bim_guid);
  
  if (allGuids.length > 0) {
    onHighlightGuids(allGuids);
  }
};

/**
 * 处理电源追溯完成事件
 * 在 BIM 模型中隔离显示相关构件并绘制 3D 电源连线
 */
const onTraceComplete = async (traceData) => {
  console.log('⚡ [RDS] 电源追溯 BIM 可视化:', traceData);
  
  if (!mainViewRef.value || !traceData) return;
  
  // 调用 MainView 的电源追溯可视化方法
  if (mainViewRef.value.showPowerTraceOverlay) {
    mainViewRef.value.showPowerTraceOverlay(traceData);
  } else {
    // 降级方案：仅高亮节点
    const allGuids = traceData.nodes
      .filter(n => n.bimGuid)
      .map(n => n.bimGuid);
    
    const mcCodes = traceData.nodes
      .filter(n => n.mcCode)
      .map(n => n.mcCode);
    
    if (allGuids.length > 0 || mcCodes.length > 0) {
      onHighlightGuids({
        guids: allGuids,
        refCodes: mcCodes,
        searchQueries: mcCodes.length > 0 ? [{
          values: mcCodes,
          attributes: ['MC编码', 'MC Code', 'DeviceCode', '设备编码', 'Tag Number']
        }] : []
      });
    }
  }
};

/**
 * 处理电源追溯清除事件
 * 清除 3D 覆盖层并恢复正常显示
 */
const onTraceClear = () => {
  console.log('🧹 [RDS] 清除电源追溯覆盖层');
  
  if (mainViewRef.value) {
    // 调用 MainView 清除覆盖层
    if (mainViewRef.value.clearPowerTraceOverlay) {
      mainViewRef.value.clearPowerTraceOverlay();
    }
    // 恢复显示所有资产
    if (mainViewRef.value.showAllAssets) {
      mainViewRef.value.showAllAssets();
    }
  }
};

// 监听图表面板状态变化，确保 viewer 及时 resize
watch(isChartPanelOpen, () => {
  nextTick(() => {
    if (mainViewRef.value?.resizeViewer) {
      mainViewRef.value.resizeViewer();
    }
  });
});

// 组件挂载时加载激活的文件及其数据
onMounted(async () => {
  try {
    const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
    
    // 获取所有文件列表，找到激活的文件
    // 获取所有文件列表，找到激活的文件
    const filesRes = await fetch(`${API_BASE}/api/files`, { headers: getHeaders() });
    const filesData = await filesRes.json();
    
    if (filesData.success && filesData.data.length > 0) {
      // 找到激活的文件
      const activeFile = filesData.data.find(f => f.is_active);
      
      if (activeFile) {
        console.log('📦 发现激活的文件:', activeFile.title || activeFile.filename);
        
        // 加载该文件的数据
        await onFileActivated(activeFile);
        
        console.log('✅ 已加载激活文件的数据');
      } else {
        console.log('⚠️ 没有激活的文件，加载默认数据');
        await loadDataFromDatabase();
      }
    } else {
      console.log('⚠️ 没有文件，加载默认数据');
      await loadDataFromDatabase();
    }
  } catch (error) {
    console.error('❌ 初始化加载失败:', error);
    // 回退到默认加载
    await loadDataFromDatabase();
  }
});

onUnmounted(() => {
  stopResize();
});
</script>

<style>
/* 保持原有样式不变 */
.root-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

* { box-sizing: border-box; }
body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #1e1e1e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
#app { height: 100vh; width: 100vw; display: flex; flex-direction: column; max-width: none !important; margin: 0 !important; padding: 0 !important; }
.app-layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
.main-body { display: flex; flex: 1; overflow: hidden; position: relative; width: 100%; }
.panel-wrapper { flex-shrink: 0; height: 100%; overflow: hidden; position: relative; z-index: 20; transition: width 0.05s ease-out; }
.left-section { display: flex; flex-shrink: 0; height: 100%; overflow: hidden; position: relative; z-index: 20; transition: width 0.05s ease-out; }
.panel-content { flex: 1; height: 100%; overflow: hidden; display: flex; flex-direction: column; background: #252526; }
.main-content { flex: 1; min-width: 0; height: 100%; position: relative; z-index: 10; display: flex; flex-direction: column; }
.document-manager-fullscreen { flex: 1; min-width: 0; height: 100%; overflow: hidden; }
.viewer-wrapper { width: 100%; overflow: hidden; transition: height 0.3s ease; }
.bottom-chart-wrapper { width: 100%; overflow: hidden; transition: height 0.3s ease; border-top: 1px solid #333; }
.resizer { width: 5px; background: #111; cursor: col-resize; flex-shrink: 0; z-index: 50; transition: background 0.2s; }
.resizer:hover, .resizer:active { background: #0078d4; }
.horizontal-resizer { 
  height: 5px; 
  width: 100%; 
  background: #111; 
  cursor: row-resize; 
  flex-shrink: 0; 
  z-index: 50; 
  transition: background 0.2s; 
}
.horizontal-resizer:hover, .horizontal-resizer:active { 
  background: #0078d4; 
}

/* 文档管理占位样式 */
.documents-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--md-sys-color-surface, #252526);
  color: var(--md-sys-color-on-surface-variant, #888);
}
.documents-placeholder .placeholder-content {
  text-align: center;
}
.documents-placeholder svg {
  margin-bottom: 16px;
  stroke: var(--md-sys-color-on-surface-variant, #666);
}
.documents-placeholder p {
  font-size: 14px;
  margin: 0;
}

/* 数据导出弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000; /* 降低 z-index，让 Element Plus 对话框 (z-index: 2000+) 能正常显示 */
  backdrop-filter: blur(4px);
}

.modal-container {
  background: transparent;
  padding: 0;
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  width: 90%;
  max-width: 1000px; /* 增加宽度 */
  position: relative;
  animation: modal-in 0.3s ease-out;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 关闭按钮定位覆盖 */
.modal-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

</style>
