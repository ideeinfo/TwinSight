/**
 * UI 状态管理
 * 管理界面布局、面板状态等
 */
import { defineStore } from 'pinia';

export type ViewMode = 'connect' | 'assets' | 'files' | 'documents';

export interface UiState {
    // 当前视图模式
    currentView: ViewMode;

    // 面板状态
    isLeftPanelOpen: boolean;
    isRightPanelOpen: boolean;
    isChartPanelOpen: boolean;
    isViewsPanelOpen: boolean;
    isDataExportOpen: boolean;

    // 面板尺寸
    leftPanelWidth: number;
    rightPanelWidth: number;
    chartPanelHeight: number;

    // 语言
    locale: string;

    // 加载状态
    isLoading: boolean;
    loadingMessage: string;
}

export const useUiStore = defineStore('ui', {
    state: (): UiState => ({
        currentView: 'assets',
        isLeftPanelOpen: true,
        isRightPanelOpen: false,
        isChartPanelOpen: false,
        isViewsPanelOpen: false,
        isDataExportOpen: false,
        leftPanelWidth: 320,
        rightPanelWidth: 320,
        chartPanelHeight: 240,
        locale: 'zh',
        isLoading: false,
        loadingMessage: '',
    }),

    getters: {
        /**
         * 是否显示任何侧边栏
         */
        hasSidebar: (state): boolean => {
            return state.isLeftPanelOpen || state.isRightPanelOpen;
        },
    },

    actions: {
        /**
         * 切换视图模式
         */
        setView(view: ViewMode) {
            this.currentView = view;
        },

        /**
         * 切换左侧面板
         */
        toggleLeftPanel() {
            this.isLeftPanelOpen = !this.isLeftPanelOpen;
        },

        /**
         * 切换右侧面板
         */
        toggleRightPanel(open?: boolean) {
            this.isRightPanelOpen = open ?? !this.isRightPanelOpen;
        },

        /**
         * 切换图表面板
         */
        toggleChartPanel(open?: boolean) {
            this.isChartPanelOpen = open ?? !this.isChartPanelOpen;
        },

        /**
         * 切换视图面板
         */
        toggleViewsPanel(open?: boolean) {
            this.isViewsPanelOpen = open ?? !this.isViewsPanelOpen;
        },

        /**
         * 打开数据导出面板
         */
        openDataExport() {
            this.isDataExportOpen = true;
        },

        /**
         * 关闭数据导出面板
         */
        closeDataExport() {
            this.isDataExportOpen = false;
        },

        /**
         * 设置加载状态
         */
        setLoading(loading: boolean, message = '') {
            this.isLoading = loading;
            this.loadingMessage = message;
        },

        /**
         * 设置语言
         */
        setLocale(locale: string) {
            this.locale = locale;
        },

        /**
         * 调整左侧面板宽度
         */
        setLeftPanelWidth(width: number) {
            this.leftPanelWidth = Math.max(200, Math.min(600, width));
        },

        /**
         * 调整右侧面板宽度
         */
        setRightPanelWidth(width: number) {
            this.rightPanelWidth = Math.max(200, Math.min(600, width));
        },

        /**
         * 调整图表面板高度
         */
        setChartPanelHeight(height: number) {
            this.chartPanelHeight = Math.max(150, Math.min(500, height));
        },
    },
});
