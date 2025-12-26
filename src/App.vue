<template>
  <div class="root-container">
    <!-- 全景比对模式 -->
    <PanoCompareView 
      v-if="isPanoCompareMode"
      :fileId="panoFileId"
      :modelPath="panoModelPath"
      :fileName="panoFileName"
    />

    <!-- 正常模式 -->
    <div v-else class="app-layout" @mouseup="stopResize" @mouseleave="stopResize">
    <TopBar :isViewsPanelOpen="isViewsPanelOpen" :currentViewName="currentViewName" @open-data-export="openDataExportPanel" @toggle-views="toggleViewsPanel" />

    <div class="main-body" ref="mainBody" @mousemove="onMouseMove">

      <!-- 左侧区域：IconBar + 内容面板 -->
      <div class="left-section" :style="{ width: leftWidth + 'px' }">
        <!-- 全局导航栏 -->
        <IconBar
          :currentView="currentView"
          :isStreamsOpen="isChartPanelOpen"
          :isAIEnabled="isAIAnalysisEnabled"
          @switch-view="switchView"
          @toggle-streams="toggleChartPanel"
          @toggle-ai="toggleAIAnalysis"
        />
        
        <!-- 内容面板 -->
        <div class="panel-content">
          <LeftPanel
            v-if="currentView === 'connect'"
            :rooms="roomList"
            :selectedDbIds="savedRoomSelections"
            @open-properties="openRightPanel"
            @rooms-selected="onRoomsSelected"
          />
          <AssetPanel
            v-else-if="currentView === 'assets'"
            ref="assetPanelRef"
            :assets="assetList"
            :selectedDbIds="savedAssetSelections"
            @open-properties="openRightPanel"
            @assets-selected="onAssetsSelected"
          />
          <FilePanel
            v-else-if="currentView === 'files'"
            @file-activated="onFileActivated"
            @open-data-export="openDataExportPanel"
          />
        </div>
      </div>

      <div class="resizer" @mousedown="startResize($event, 'left')"></div>

      <!-- 中间主视图区域 -->
      <div class="main-content">
        <!-- 3D 视图 -->
        <div class="viewer-wrapper" :style="{ height: isChartPanelOpen ? `calc(100% - ${chartPanelHeight}px)` : '100%' }">
          <MainView
            ref="mainViewRef"
            :currentView="currentView"
            :assets="assetList"
            :rooms="roomList"
            :isAIEnabled="isAIAnalysisEnabled"
            @rooms-loaded="onRoomsLoaded"
            @assets-loaded="onAssetsLoaded"
            @viewer-ready="onViewerReady"
            @chart-data-update="onChartDataUpdate"
            @time-range-changed="onTimeRangeChanged"
            @model-selection-changed="onModelSelectionChanged"
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
              :seriesList="selectedRoomSeries"
              :range="currentRange"
              @hover-sync="onHoverSync"
              @close="closeChartPanel"
            />
          </template>
          <ChartPanel v-else :data="chartData" :range="currentRange" :label-text="$t('chartPanel.average')" @close="closeChartPanel" @hover-sync="onHoverSync" />
        </div>
      </div>

      <!-- 右侧拖拽条 -->
      <div
        v-if="isRightPanelOpen"
        class="resizer"
        @mousedown="startResize($event, 'right')"
      ></div>

      <!-- 右侧面板 -->
      <div
        v-if="isRightPanelOpen"
        class="panel-wrapper"
        :style="{ width: rightWidth + 'px' }"
      >
        <RightPanel
          :roomProperties="selectedRoomProperties"
          :selectedIds="selectedObjectIds"
          :viewMode="currentView"
          @close-properties="closeRightPanel"
          @property-changed="onPropertyChanged"
        />
      </div>

    </div>

    <!-- 数据导出面板弹窗 -->
    <Teleport to="body">
      <div v-if="isDataExportOpen" class="modal-overlay" @click.self="closeDataExportPanel">
        <div class="modal-container">
          <DataExportPanel
            :fileId="currentExportFileId"
            :getFullAssetData="getFullAssetDataFromMainView"
            :getFullSpaceData="getFullSpaceDataFromMainView"
            :getAssetPropertyList="getAssetPropertyListFromMainView"
            :getSpacePropertyList="getSpacePropertyListFromMainView"
            :getFullAssetDataWithMapping="getFullAssetDataWithMappingFromMainView"
            :getFullSpaceDataWithMapping="getFullSpaceDataWithMappingFromMainView"
          />
          <button class="dialog-close-btn modal-close-btn" @click="closeDataExportPanel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </Teleport>
    
    <!-- 视图面板 -->
    <ViewsPanel
      :visible="isViewsPanelOpen"
      :fileId="activeFileId"
      :fileName="activeFileName"
      @close="isViewsPanelOpen = false"
      @get-viewer-state="handleGetViewerState"
      @capture-screenshot="handleCaptureScreenshot"
      @restore-view="handleRestoreView"
      @current-view-changed="currentViewName = $event"
    />
  </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import TopBar from './components/TopBar.vue';
import IconBar from './components/IconBar.vue';
import LeftPanel from './components/LeftPanel.vue';
import AssetPanel from './components/AssetPanel.vue';
import FilePanel from './components/FilePanel.vue';
import RightPanel from './components/RightPanel.vue';
import MainView from './components/MainView.vue';
import ChartPanel from './components/ChartPanel.vue';
import MultiChartPanel from './components/MultiChartPanel.vue';
import DataExportPanel from './components/DataExportPanel.vue';
import ViewsPanel from './components/ViewsPanel.vue';
import { queryRoomSeries } from './services/influx';
import PanoCompareView from './components/PanoCompareView.vue';
import { checkApiHealth, getAssets, getSpaces } from './services/postgres.js';

// 全景比对模式状态
const isPanoCompareMode = ref(false);
const panoFileId = ref('');
const panoModelPath = ref('');
const panoFileName = ref('');

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
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        console.log('🔍 [App] 获取文件列表...');
        const response = await fetch(`${API_BASE}/api/files`);
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

const leftWidth = ref(400);
const rightWidth = ref(320);
const isRightPanelOpen = ref(true);
const isChartPanelOpen = ref(false);
const isAIAnalysisEnabled = ref(false); // AI 分析功能开关，默认关闭
const chartPanelHeight = ref(300);
const roomList = ref([]);
const assetList = ref([]);
const mainViewRef = ref(null);
const assetPanelRef = ref(null);
const selectedRoomProperties = ref(null);
const selectedObjectIds = ref([]); // 当前选中的对象ID列表（用于批量编辑）
const chartData = ref([]);
const currentView = ref('assets'); // 'connect' or 'assets' - 默认加载资产页面
const selectedRoomSeries = ref([]);
const currentRange = ref({ startMs: 0, endMs: 0, windowMs: 0 });
const savedRoomSelections = ref([]);
const savedAssetSelections = ref([]);
const isDataExportOpen = ref(false);
const isLoadingFromDb = ref(false);
const dbDataLoaded = ref(false);
const currentLoadedModelPath = ref(null); // 追踪当前加载的模型路径，防止重复加载

// 模型数据缓存（用于 dbId 映射）
const modelRoomDbIds = ref([]);
const modelAssetDbIds = ref([]);

// 当前导出的文件 ID
const currentExportFileId = ref(null);

// 数据导出面板打开前的原模型路径（用于关闭时恢复）
const previousModelPath = ref(null);

// 数据导出面板打开前的原激活文件信息（用于关闭时恢复视图面板）
const previousActiveFileInfo = ref(null);

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
          // 保存原模型路径，以便关闭面板时恢复
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
  console.log('🎬 Viewer 初始化完成');
  viewerReady.value = true;
  
  // 如果有待加载的激活文件，立即加载其模型
  if (pendingActiveFile.value && mainViewRef.value && mainViewRef.value.loadNewModel) {
    const file = pendingActiveFile.value;
    if (file.extracted_path) {
      console.log('📦 加载待加载的模型:', file.extracted_path);
      currentLoadedModelPath.value = file.extracted_path;
      mainViewRef.value.loadNewModel(file.extracted_path);
    }
    pendingActiveFile.value = null;
  } else {
    // 没有 pending 文件，加载当前激活的文件或默认模型
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const filesRes = await fetch(`${API_BASE}/api/files`);
      const filesData = await filesRes.json();
      
      if (filesData.success && filesData.data.length > 0) {
        const activeFile = filesData.data.find(f => f.is_active);
        if (activeFile) {
          console.log('🔍 找到激活文件:', activeFile.title);
          
          // 🔑 检查是否已经在加载或已加载同一个模型
          if (currentLoadedModelPath.value === activeFile.extracted_path) {
            console.log('⏭️ 模型已加载，跳过重复加载:', activeFile.extracted_path);
            return;
          }
          
          // 🔑 关键修复：先从数据库加载该文件的资产和空间数据
          try {
            // 获取该文件的资产
            const assetsRes = await fetch(`${API_BASE}/api/files/${activeFile.id}/assets`);
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
                phone: asset.phone
              }));
              console.log(`✅ 页面刷新：从数据库加载了 ${assetList.value.length} 个资产`);
            }

            // 获取该文件的空间
            const spacesRes = await fetch(`${API_BASE}/api/files/${activeFile.id}/spaces`);
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
                perimeter: space.perimeter
              }));
              console.log(`✅ 页面刷新：从数据库加载了 ${roomList.value.length} 个空间`);
            }

            // 标记数据库数据已加载
            dbDataLoaded.value = true;
          } catch (dbError) {
            console.warn('⚠️ 加载数据库数据失败，将使用模型数据:', dbError);
          }
          
          // 然后加载模型
          if (activeFile.extracted_path && mainViewRef.value && mainViewRef.value.loadNewModel) {
            console.log('📦 加载当前激活的模型:', activeFile.extracted_path);
            currentLoadedModelPath.value = activeFile.extracted_path;
            await mainViewRef.value.loadNewModel(activeFile.extracted_path);
            
            // 🏠 检查并恢复默认视图
            try {
              const defaultViewRes = await fetch(`${API_BASE}/api/views/default?fileId=${activeFile.id}`);
              const defaultViewData = await defaultViewRes.json();
              if (defaultViewData.success && defaultViewData.data) {
                console.log('🏠 找到默认视图，正在恢复:', defaultViewData.data.name);
                
                // 🔑 更新 currentViewName 让 TopBar 显示视图名称
                currentViewName.value = defaultViewData.data.name;
                
                // 🔑 更新激活文件信息让 ViewsPanel 同步
                activeFileId.value = activeFile.id;
                activeFileName.value = activeFile.title || activeFile.name || 'Untitled';
                
                // 获取完整视图数据
                const fullViewRes = await fetch(`${API_BASE}/api/views/${defaultViewData.data.id}`);
                const fullViewData = await fullViewRes.json();
                if (fullViewData.success && mainViewRef.value?.restoreViewState) {
                  // 使用事件驱动的方式恢复视图，确保模型完全就绪
                  if (mainViewRef.value?.onModelReady) {
                    console.log('⏳ 等待模型就绪后恢复视图...');
                    mainViewRef.value.onModelReady(() => {
                      console.log('🔄 模型已就绪，正在恢复默认视图...');
                      mainViewRef.value.restoreViewState(fullViewData.data);
                      console.log('✅ 默认视图已恢复');
                    });
                  } else {
                    // 后备方案：直接恢复
                    mainViewRef.value.restoreViewState(fullViewData.data);
                  }
                }
              } else {
                console.log('ℹ️ 没有设置默认视图，使用模型默认状态');
                // 没有默认视图时也更新激活文件信息
                activeFileId.value = activeFile.id;
                activeFileName.value = activeFile.title || activeFile.name || 'Untitled';
              }
            } catch (viewErr) {
              console.warn('⚠️ 恢复默认视图失败:', viewErr);
            }
            
            return;
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ 无法获取激活文件，加载默认模型', e);
    }
    
    // 如果没有激活文件，加载默认模型
    if (mainViewRef.value && mainViewRef.value.loadNewModel) {
      console.log('📦 加载默认模型');
      const defaultPath = '/models/my-building';
      currentLoadedModelPath.value = defaultPath;
      mainViewRef.value.loadNewModel(defaultPath);
    }
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

const onAssetsLoaded = (assets) => {
  // 保存模型中的 dbId 列表
  modelAssetDbIds.value = assets.map(a => a.dbId);
  
  // 如果数据库数据已加载，则使用数据库数据；否则使用模型数据
  if (!dbDataLoaded.value) {
    assetList.value = assets;
  }

  // 【已移除】原自动孤立逻辑 - 模型现在保持默认状态
  // 如果存在默认视图，由 onViewerReady 自动恢复
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
            queryRoomSeries(r.code, startMs, endMs, windowMs)
              .then(points => ({ room: r.code, name: r.name, points }))
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

const switchView = (view) => {
  currentView.value = view;
  // 切换视图时清除选择
  selectedRoomProperties.value = null;

  // 注意：不在这里立即调用 showAllAssets/showAllRooms
  // 因为可能模型还没加载完成，让 onAssetsLoaded/onRoomsLoaded 处理
  
  // 温度标签和热力图按钮现在是全局的，不受视图切换影响
  // 由用户通过按钮控制显示/隐藏
};

// 文件激活后加载对应的资产和空间数据
const onFileActivated = async (file) => {
  console.log('📂 文件已激活:', file);
  
  // 更新当前激活的文件信息（用于视图面板）
  activeFileId.value = file.id;
  activeFileName.value = file.title || file.name || 'Untitled';
  
  try {
    // 从数据库加载该文件的资产和空间
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    // 获取该文件的资产
    const assetsRes = await fetch(`${API_BASE}/api/files/${file.id}/assets`);
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
        phone: asset.phone
      }));
      console.log(`📊 加载了 ${assetList.value.length} 个资产`);
    } else {
      assetList.value = [];
      console.log('⚠️ 该文件没有资产数据');
    }

    // 获取该文件的空间
    const spacesRes = await fetch(`${API_BASE}/api/files/${file.id}/spaces`);
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
        perimeter: space.perimeter
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
        // 避免初次加载或激活相同模型时无限刷新
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
    Promise.all(selectedRooms.map(r => queryRoomSeries(r.code, startMs, endMs, windowMs).then(points => ({ room: r.code, name: r.name, points }))))
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

    if (dbIds.length === 1) {
      // 单选：显示详情
      const asset = assetList.value.find(a => a.dbId === dbIds[0]);
      if (asset) {
        selectedRoomProperties.value = {
          name: asset.name,
          mcCode: asset.mcCode,
          level: asset.floor,
          room: asset.room,
          omniClass21Number: asset.classification_code || '',
          omniClass21Description: asset.classification_desc || '',
          category: asset.category,
          family: asset.family,
          type: asset.type,
          typeComments: asset.specCode, // 暂用 specCode 映射
          specName: asset.specName,
          manufacturer: asset.manufacturer,
          address: asset.address,
          phone: asset.phone
        };
      }
    } else {
      // 多选：显示共有属性或 VARIES
      // 优化：从 assetList Map 中获取数据，避免 O(N*M) 查找
      // 假设 assetList 是数组，查找仍需优化。但 dbIds 对应的 asset 对象提取出来比每次 find 快
      const selectedAssets = dbIds.map(id => assetList.value.find(a => a.dbId === id)).filter(Boolean);
      
      const allProps = selectedAssets.map(asset => ({
        name: asset.name,
        mcCode: asset.mcCode,
        level: asset.floor,
        room: asset.room,
        omniClass21Number: asset.classification_code || '',
        omniClass21Description: asset.classification_desc || '',
        category: asset.category,
        family: asset.family,
        type: asset.type,
        typeComments: asset.specCode,
        specName: asset.specName,
        manufacturer: asset.manufacturer,
        address: asset.address,
        phone: asset.phone
      }));

      if (allProps.length > 0) {
        // 比较属性值，相同则显示值，不同则显示 VARIES_VALUE
        const VARIES_VALUE = '__VARIES__';
        
        console.log(`🔍 多选资产属性比较：处理 ${allProps.length} 个资产`);
        
        // 辅助函数：判断两个值是否相同（把 null, undefined, '' 视为相同）
        const isSameValue = (v1, v2) => {
          const normalize = (v) => (v == null || v === '') ? '' : String(v);
          return normalize(v1) === normalize(v2);
        };
        
        const mergedProps = { ...allProps[0], isMultiple: true };
        const keys = Object.keys(mergedProps).filter(k => k !== 'isMultiple');

        // 优化比较循环：一旦所有属性都变成 VARIES，提前退出
        let allVaries = false;

        for (let i = 1; i < allProps.length; i++) {
          if (allVaries) break; // 所有属性都不同了，无需继续比较

          const props = allProps[i];
          const base = allProps[0];
          let stillConsistent = false;

          for (const key of keys) {
            if (mergedProps[key] !== VARIES_VALUE) {
              if (!isSameValue(base[key], props[key])) {
                mergedProps[key] = VARIES_VALUE;
              } else {
                stillConsistent = true; // 至少还有一个属性是一致的
              }
            }
          }

          if (!stillConsistent) {
             // 检查是否所有 key 都是 VARIES (除了 isMultiple)
             allVaries = keys.every(key => mergedProps[key] === VARIES_VALUE);
          }
        }
        
        console.log('✅ 比较完成');
        selectedRoomProperties.value = mergedProps;
      } else {
        selectedRoomProperties.value = { isMultiple: true };
      }
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
const loadAssetProperties = (dbIds) => {
  if (!dbIds || dbIds.length === 0) {
    selectedRoomProperties.value = null;
    return;
  }

  if (dbIds.length === 1) {
    // 单选：显示单个资产属性
    const dbAsset = assetList.value.find(a => a.dbId === dbIds[0]);
    if (dbAsset) {
      selectedRoomProperties.value = {
        name: dbAsset.name || '',
        mcCode: dbAsset.mcCode || '',
        level: dbAsset.floor || '',
        room: dbAsset.room || '',
        omniClass21Number: dbAsset.classification_code || '',
        omniClass21Description: dbAsset.classification_desc || '',
        category: dbAsset.category || '',
        family: dbAsset.family || '',
        type: dbAsset.type || '',
        typeComments: dbAsset.specCode || '',
        specName: dbAsset.specName || '',
        manufacturer: dbAsset.manufacturer || '',
        address: dbAsset.address || '',
        phone: dbAsset.phone || ''
      };
    } else if (mainViewRef.value?.getAssetProperties) {
      // 回退到模型数据
      mainViewRef.value.getAssetProperties(dbIds[0]).then(props => {
        selectedRoomProperties.value = props;
      });
    }
  } else {
    // 多选：合并属性
    const allProps = dbIds.map(dbId => {
      const dbAsset = assetList.value.find(a => a.dbId === dbId);
      if (dbAsset) {
        return {
          name: dbAsset.name || '',
          mcCode: dbAsset.mcCode || '',
          level: dbAsset.floor || '',
          room: dbAsset.room || '',
          omniClass21Number: dbAsset.classification_code || '',
          omniClass21Description: dbAsset.classification_desc || '',
          category: dbAsset.category || '',
          family: dbAsset.family || '',
          type: dbAsset.type || '',
          typeComments: dbAsset.specCode || '',
          specName: dbAsset.specName || '',
          manufacturer: dbAsset.manufacturer || '',
          address: dbAsset.address || '',
          phone: dbAsset.phone || ''
        };
      }
      return null;
    }).filter(Boolean);

    if (allProps.length > 0) {
      const VARIES_VALUE = '__VARIES__';
      
      // 辅助函数：判断两个值是否相同（把 null, undefined, '' 视为相同）
      const isSameValue = (v1, v2) => {
        const normalize = (v) => (v == null || v === '') ? '' : String(v);
        return normalize(v1) === normalize(v2);
      };
      
      const mergedProps = { ...allProps[0], isMultiple: true };
      const base = allProps[0]; // 用第一个元素作为基准
      
      for (let i = 1; i < allProps.length; i++) {
        const props = allProps[i];
        Object.keys(mergedProps).forEach(key => {
          if (key !== 'isMultiple' && mergedProps[key] !== VARIES_VALUE && !isSameValue(base[key], props[key])) {
            mergedProps[key] = VARIES_VALUE;
          }
        });
      }
      
      selectedRoomProperties.value = mergedProps;
    } else {
      selectedRoomProperties.value = { isMultiple: true };
    }
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
      if (newWidth > 200 && newWidth < 600) {
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
  const rooms = selectedRoomSeries.value.map(s => ({ room: s.room, name: s.name }));
  if (mainViewRef.value?.setSelectedRooms) {
    mainViewRef.value.setSelectedRooms(rooms.map(r => r.room));
  }
  Promise.all(rooms.map(r => queryRoomSeries(r.room, startMs, endMs, windowMs).then(points => ({ room: r.room, name: r.name, points }))))
    .then(list => { selectedRoomSeries.value = list; })
    .catch(() => {});
};

// 🔑 反向定位：在3D模型中选中构件后，自动更新左侧列表的选中状态
const onModelSelectionChanged = (dbIds) => {
  if (!dbIds || dbIds.length === 0) {
    // 取消选择：清空列表选中状态
    if (currentView.value === 'assets') {
      savedAssetSelections.value = [];
    } else if (currentView.value === 'connect') {
      savedRoomSelections.value = [];
    }
    selectedRoomProperties.value = null;
    return;
  }

  // 根据当前视图更新对应的选中列表
  if (currentView.value === 'assets') {
    // 资产页面：更新资产选中状态
    savedAssetSelections.value = dbIds.slice();
    
    // 🔑 自动展开分类并滚动到选中的资产（支持多选）
    if (assetPanelRef.value && dbIds.length > 0) {
      nextTick(() => {
        assetPanelRef.value.expandAndScrollToAsset(dbIds);
      });
    }
    
    // 🔑 仅加载属性，不触发孤立操作
    loadAssetProperties(dbIds);
    
  } else if (currentView.value === 'connect') {
    // 连接页面：更新房间选中状态
    savedRoomSelections.value = dbIds.slice();
    
    // 🔑 仅加载属性，不触发孤立操作
    loadRoomProperties(dbIds);
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
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    // 获取所有文件列表，找到激活的文件
    const filesRes = await fetch(`${API_BASE}/api/files`);
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
  z-index: 9999;
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
