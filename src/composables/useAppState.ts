/**
 * 应用状态 Composable
 * 用于管理 App.vue 的核心状态，作为向 Pinia Store 迁移的过渡方案
 */
import { ref, computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useAssetsStore } from '@/stores/assets';
import { useSpacesStore } from '@/stores/spaces';
import { useModelsStore } from '@/stores/models';

export function useAppState() {
    // 获取 Store 实例
    const uiStore = useUiStore();
    const assetsStore = useAssetsStore();
    const spacesStore = useSpacesStore();
    const modelsStore = useModelsStore();

    // ============ UI 状态（从 uiStore 获取） ============
    const currentView = computed({
        get: () => uiStore.currentView,
        set: (val) => uiStore.setView(val),
    });

    const isRightPanelOpen = computed({
        get: () => uiStore.isRightPanelOpen,
        set: (val) => uiStore.toggleRightPanel(val),
    });

    const isChartPanelOpen = computed({
        get: () => uiStore.isChartPanelOpen,
        set: (val) => uiStore.toggleChartPanel(val),
    });

    const isViewsPanelOpen = computed({
        get: () => uiStore.isViewsPanelOpen,
        set: (val) => uiStore.toggleViewsPanel(val),
    });

    const isDataExportOpen = computed({
        get: () => uiStore.isDataExportOpen,
        set: (val) => val ? uiStore.openDataExport() : uiStore.closeDataExport(),
    });

    const leftPanelWidth = computed({
        get: () => uiStore.leftPanelWidth,
        set: (val) => uiStore.setLeftPanelWidth(val),
    });

    const rightPanelWidth = computed({
        get: () => uiStore.rightPanelWidth,
        set: (val) => uiStore.setRightPanelWidth(val),
    });

    const chartPanelHeight = computed({
        get: () => uiStore.chartPanelHeight,
        set: (val) => uiStore.setChartPanelHeight(val),
    });

    // ============ 资产状态（从 assetsStore 获取） ============
    const assetList = computed(() => assetsStore.list);
    const selectedAssetDbIds = computed(() => assetsStore.selectedDbIds);

    // ============ 空间状态（从 spacesStore 获取） ============
    const roomList = computed(() => spacesStore.list);
    const selectedRoomDbIds = computed(() => spacesStore.selectedDbIds);

    // ============ 模型状态（从 modelsStore 获取） ============
    const activeModel = computed(() => modelsStore.activeModel);
    const isModelLoading = computed(() => modelsStore.loading);

    // ============ 尚未迁移的本地状态 ============
    const selectedRoomProperties = ref(null);
    const selectedObjectIds = ref([]);
    const chartData = ref([]);
    const selectedRoomSeries = ref([]);
    const currentRange = ref({ startMs: 0, endMs: 0, windowMs: 0 });
    const currentExportFileId = ref(null);
    const viewerReady = ref(false);
    const pendingActiveFile = ref(null);
    const currentLoadedModelPath = ref(null);
    const activeFileId = ref(null);
    const activeFileName = ref('');
    const currentViewName = ref('');
    const dbDataLoaded = ref(false);
    const isLoadingFromDb = ref(false);

    // ============ 方法 ============

    /**
     * 切换视图
     */
    const switchView = (view) => {
        uiStore.setView(view);
        selectedRoomProperties.value = null;
    };

    /**
     * 打开右侧面板
     */
    const openRightPanel = () => {
        uiStore.toggleRightPanel(true);
    };

    /**
     * 关闭右侧面板
     */
    const closeRightPanel = () => {
        uiStore.toggleRightPanel(false);
    };

    /**
     * 打开图表面板
     */
    const openChartPanel = () => {
        uiStore.toggleChartPanel(true);
    };

    /**
     * 关闭图表面板
     */
    const closeChartPanel = () => {
        uiStore.toggleChartPanel(false);
    };

    /**
     * 切换视图面板
     */
    const toggleViewsPanel = () => {
        uiStore.toggleViewsPanel();
    };

    /**
     * 打开数据导出面板
     */
    const openDataExportPanel = (file) => {
        if (file?.id) {
            currentExportFileId.value = file.id;
        } else {
            currentExportFileId.value = null;
        }
        uiStore.openDataExport();
    };

    /**
     * 关闭数据导出面板
     */
    const closeDataExportPanel = () => {
        uiStore.closeDataExport();
    };

    /**
     * 设置资产列表
     */
    const setAssets = (assets) => {
        assetsStore.setAssets(assets);
    };

    /**
     * 设置空间列表
     */
    const setSpaces = (spaces) => {
        spacesStore.setSpaces(spaces);
    };

    /**
     * 选择资产
     */
    const selectAssets = (dbIds) => {
        assetsStore.clearSelection();
        dbIds.forEach(dbId => assetsStore.selectAsset(0, dbId));
    };

    /**
     * 选择空间
     */
    const selectSpaces = (dbIds) => {
        spacesStore.clearSelection();
        dbIds.forEach(dbId => spacesStore.selectSpace(0, dbId));
    };

    /**
     * 清除资产选择
     */
    const clearAssetSelection = () => {
        assetsStore.clearSelection();
    };

    /**
     * 清除空间选择
     */
    const clearSpaceSelection = () => {
        spacesStore.clearSelection();
    };

    return {
        // UI 状态
        currentView,
        isRightPanelOpen,
        isChartPanelOpen,
        isViewsPanelOpen,
        isDataExportOpen,
        leftPanelWidth,
        rightPanelWidth,
        chartPanelHeight,

        // 资产状态
        assetList,
        selectedAssetDbIds,

        // 空间状态
        roomList,
        selectedRoomDbIds,

        // 模型状态
        activeModel,
        isModelLoading,

        // 本地状态
        selectedRoomProperties,
        selectedObjectIds,
        chartData,
        selectedRoomSeries,
        currentRange,
        currentExportFileId,
        viewerReady,
        pendingActiveFile,
        currentLoadedModelPath,
        activeFileId,
        activeFileName,
        currentViewName,
        dbDataLoaded,
        isLoadingFromDb,

        // 方法
        switchView,
        openRightPanel,
        closeRightPanel,
        openChartPanel,
        closeChartPanel,
        toggleViewsPanel,
        openDataExportPanel,
        closeDataExportPanel,
        setAssets,
        setSpaces,
        selectAssets,
        selectSpaces,
        clearAssetSelection,
        clearSpaceSelection,
    };
}
