<template>
  <div class="app-layout" @mouseup="stopResize" @mouseleave="stopResize">
    <TopBar @open-data-export="openDataExportPanel" />

    <div class="main-body" ref="mainBody" @mousemove="onMouseMove">

      <!-- 左侧面板 -->
      <div class="panel-wrapper" :style="{ width: leftWidth + 'px' }">
        <LeftPanel
          v-if="currentView === 'connect'"
          :rooms="roomList"
          :currentView="currentView"
          :selectedDbIds="savedRoomSelections"
          @open-properties="openRightPanel"
          @rooms-selected="onRoomsSelected"
          @toggle-streams="toggleChartPanel"
          @switch-view="switchView"
        />
        <AssetPanel
          v-else-if="currentView === 'assets'"
          ref="assetPanelRef"
          :assets="assetList"
          :currentView="currentView"
          :selectedDbIds="savedAssetSelections"
          @open-properties="openRightPanel"
          @assets-selected="onAssetsSelected"
          @toggle-streams="toggleChartPanel"
          @switch-view="switchView"
        />
        <FilePanel
          v-else-if="currentView === 'files'"
          :currentView="currentView"
          @switch-view="switchView"
          @file-activated="onFileActivated"
          @open-data-export="openDataExportPanel"
        />
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
          :viewMode="currentView"
          @close-properties="closeRightPanel"
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
          <button class="modal-close-btn" @click="closeDataExportPanel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import TopBar from './components/TopBar.vue';
import LeftPanel from './components/LeftPanel.vue';
import AssetPanel from './components/AssetPanel.vue';
import FilePanel from './components/FilePanel.vue';
import RightPanel from './components/RightPanel.vue';
import MainView from './components/MainView.vue';
import ChartPanel from './components/ChartPanel.vue';
import MultiChartPanel from './components/MultiChartPanel.vue';
import DataExportPanel from './components/DataExportPanel.vue';
import { queryRoomSeries } from './services/influx';
import { checkApiHealth, getAssets, getSpaces } from './services/postgres.js';

const leftWidth = ref(400);
const rightWidth = ref(320);
const isRightPanelOpen = ref(true);
const isChartPanelOpen = ref(false);
const chartPanelHeight = ref(300);
const roomList = ref([]);
const assetList = ref([]);
const mainViewRef = ref(null);
const assetPanelRef = ref(null);
const selectedRoomProperties = ref(null);
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

// 待加载的激活文件（在 viewer 初始化完成后加载）
const pendingActiveFile = ref(null);
const viewerReady = ref(false);

// 数据导出面板方法
const openDataExportPanel = async (file) => {
  if (file && file.id) {
    currentExportFileId.value = file.id;
    // 关键修复：打开导出面板时，自动加载该文件的模型到 Viewer
    // 确保“所见即所得”，防止提取旧模型数据
    await onFileActivated(file);
  } else {
    currentExportFileId.value = null;
  }
  isDataExportOpen.value = true;
};

const closeDataExportPanel = () => {
  isDataExportOpen.value = false;
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
                name: (space.name || '').replace(/\[.*?\]/g, '').trim(),
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
            mainViewRef.value.loadNewModel(activeFile.extracted_path);
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
  
  if (currentView.value === 'connect' && mainViewRef.value) {
    if (savedRoomSelections.value.length > 0 && mainViewRef.value.isolateAndFocusRooms) {
      mainViewRef.value.isolateAndFocusRooms(savedRoomSelections.value);
    } else if (mainViewRef.value.showAllRooms) {
      // 延迟调用，确保 props 已经更新
      setTimeout(() => {
        if (mainViewRef.value && mainViewRef.value.showAllRooms) {
          mainViewRef.value.showAllRooms();
        }
      }, 100);
    }
    // 温度标签现在由用户通过按钮控制，不再自动显示/隐藏
  }
};

const onAssetsLoaded = (assets) => {
  // 保存模型中的 dbId 列表
  modelAssetDbIds.value = assets.map(a => a.dbId);
  
  // 如果数据库数据已加载，则使用数据库数据；否则使用模型数据
  if (!dbDataLoaded.value) {
    assetList.value = assets;
  }

  // 如果当前是资产视图，自动显示资产
  if (currentView.value === 'assets' && mainViewRef.value) {
    if (savedAssetSelections.value.length > 0 && mainViewRef.value.isolateAndFocusAssets) {
      mainViewRef.value.isolateAndFocusAssets(savedAssetSelections.value);
    } else if (mainViewRef.value.showAllAssets) {
      // 延迟调用，确保 props 已经更新
      setTimeout(() => {
        if (mainViewRef.value && mainViewRef.value.showAllAssets) {
          mainViewRef.value.showAllAssets();
        }
      }, 100);
    }
    // 温度标签现在由用户通过按钮控制，不再自动显示/隐藏
  }
};

const onChartDataUpdate = (data) => {
  chartData.value = data;
  if (mainViewRef.value?.getTimeRange) {
    currentRange.value = mainViewRef.value.getTimeRange();
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
        name: (space.name || '').replace(/\[.*?\]/g, '').trim(),
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

    // 加载对应的 3D 模型
    if (file.extracted_path) {
      if (viewerReady.value && mainViewRef.value && mainViewRef.value.loadNewModel) {
        // Viewer 已准备好，立即加载
        currentLoadedModelPath.value = file.extracted_path;
        mainViewRef.value.loadNewModel(file.extracted_path);
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

      if (mainViewRef.value.getRoomProperties) {
        mainViewRef.value.getRoomProperties(dbIds[0]).then(props => {
          selectedRoomProperties.value = props;
        });
      }
    } else {
      // 选中了多个房间，合并属性：相同显示实际值，不同显示 VARIES
      if (mainViewRef.value.isolateAndFocusRooms) {
        mainViewRef.value.isolateAndFocusRooms(dbIds);
      }

      if (mainViewRef.value?.getRoomProperties) {
        const VARIES_VALUE = '__VARIES__';
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
            if (merged.code !== p.code) merged.code = VARIES_VALUE;
            if (merged.name !== p.name) merged.name = VARIES_VALUE;
            if (merged.area !== p.area) merged.area = VARIES_VALUE;
            if (merged.perimeter !== p.perimeter) merged.perimeter = VARIES_VALUE;
            if (merged.spaceNumber !== p.spaceNumber) merged.spaceNumber = VARIES_VALUE;
            if (merged.spaceDescription !== p.spaceDescription) merged.spaceDescription = VARIES_VALUE;
          }
          selectedRoomProperties.value = merged;
        });
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
  // 调用 MainView 的方法来孤立并定位资产
  if (mainViewRef.value) {
    if (dbIds.length === 0) {
      // 未选中任何资产，显示所有资产
      selectedRoomProperties.value = null;
      if (mainViewRef.value.showAllAssets) {
        mainViewRef.value.showAllAssets();
      }
      // 温度标签由用户通过按钮控制，不再自动隐藏
    } else if (dbIds.length === 1) {
      // 选中了一个资产，从 assetList 中获取属性
      if (mainViewRef.value.isolateAndFocusAssets) {
        mainViewRef.value.isolateAndFocusAssets(dbIds);
      }

      // 优先从 assetList（数据库数据）获取属性
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
      } else if (mainViewRef.value.getAssetProperties) {
        // 回退到模型数据
        mainViewRef.value.getAssetProperties(dbIds[0]).then(props => {
          selectedRoomProperties.value = props;
        });
      }
    } else {
      // 选中了多个资产，比较属性值
      if (mainViewRef.value.isolateAndFocusAssets) {
        mainViewRef.value.isolateAndFocusAssets(dbIds);
      }

      // 从 assetList 获取所有选中资产的属性
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
        // 比较属性值，相同则显示值，不同则显示 VARIES_VALUE
        const VARIES_VALUE = '__VARIES__';
        const mergedProps = {
          name: allProps[0].name,
          mcCode: allProps[0].mcCode,
          level: allProps[0].level,
          room: allProps[0].room,
          omniClass21Number: allProps[0].omniClass21Number,
          omniClass21Description: allProps[0].omniClass21Description,
          category: allProps[0].category,
          family: allProps[0].family,
          type: allProps[0].type,
          typeComments: allProps[0].typeComments,
          specName: allProps[0].specName,
          manufacturer: allProps[0].manufacturer,
          address: allProps[0].address,
          phone: allProps[0].phone,
          isMultiple: true
        };

        // 比较每个属性
        for (let i = 1; i < allProps.length; i++) {
          const props = allProps[i];
          if (mergedProps.name !== props.name) mergedProps.name = VARIES_VALUE;
          if (mergedProps.mcCode !== props.mcCode) mergedProps.mcCode = VARIES_VALUE;
          if (mergedProps.level !== props.level) mergedProps.level = VARIES_VALUE;
          if (mergedProps.room !== props.room) mergedProps.room = VARIES_VALUE;
          if (mergedProps.omniClass21Number !== props.omniClass21Number) mergedProps.omniClass21Number = VARIES_VALUE;
          if (mergedProps.omniClass21Description !== props.omniClass21Description) mergedProps.omniClass21Description = VARIES_VALUE;
          if (mergedProps.category !== props.category) mergedProps.category = VARIES_VALUE;
          if (mergedProps.family !== props.family) mergedProps.family = VARIES_VALUE;
          if (mergedProps.type !== props.type) mergedProps.type = VARIES_VALUE;
          if (mergedProps.typeComments !== props.typeComments) mergedProps.typeComments = VARIES_VALUE;
          if (mergedProps.specName !== props.specName) mergedProps.specName = VARIES_VALUE;
          if (mergedProps.manufacturer !== props.manufacturer) mergedProps.manufacturer = VARIES_VALUE;
          if (mergedProps.address !== props.address) mergedProps.address = VARIES_VALUE;
          if (mergedProps.phone !== props.phone) mergedProps.phone = VARIES_VALUE;
        }

        selectedRoomProperties.value = mergedProps;
      } else {
        selectedRoomProperties.value = { isMultiple: true };
      }
    }
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
      const mergedProps = { ...allProps[0], isMultiple: true };
      
      for (let i = 1; i < allProps.length; i++) {
        const props = allProps[i];
        Object.keys(mergedProps).forEach(key => {
          if (key !== 'isMultiple' && mergedProps[key] !== props[key]) {
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
          if (merged.code !== p.code) merged.code = VARIES_VALUE;
          if (merged.name !== p.name) merged.name = VARIES_VALUE;
          if (merged.area !== p.area) merged.area = VARIES_VALUE;
          if (merged.perimeter !== p.perimeter) merged.perimeter = VARIES_VALUE;
          if (merged.spaceNumber !== p.spaceNumber) merged.spaceNumber = VARIES_VALUE;
          if (merged.spaceDescription !== p.spaceDescription) merged.spaceDescription = VARIES_VALUE;
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
  isChartPanelOpen.value = isOpen;
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
* { box-sizing: border-box; }
body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #1e1e1e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
#app { height: 100vh; width: 100vw; display: flex; flex-direction: column; max-width: none !important; margin: 0 !important; padding: 0 !important; }
.app-layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
.main-body { display: flex; flex: 1; overflow: hidden; position: relative; width: 100%; }
.panel-wrapper { flex-shrink: 0; height: 100%; overflow: hidden; position: relative; z-index: 20; transition: width 0.05s ease-out; }
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
  position: relative;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: modal-appear 0.2s ease-out;
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

.modal-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
</style>
