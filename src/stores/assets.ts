/**
 * 资产状态管理
 * 管理资产数据和选择状态
 */
import { defineStore } from 'pinia';

export interface Asset {
    id: number;
    assetCode: string;
    specCode?: string;
    name: string;
    floor?: string;
    room?: string;
    dbId?: number;
    fileId?: number;
    // 动态属性预留
    properties?: Record<string, any>;
}

export interface AssetSpec {
    id: number;
    specCode: string;
    classificationCode?: string;
    specName: string;
    manufacturer?: string;
    // 动态属性预留
    properties?: Record<string, any>;
}

export interface AssetsState {
    list: Asset[];
    specs: AssetSpec[];
    selectedIds: number[];
    selectedDbIds: number[];
    loading: boolean;
    error: string | null;
}

export const useAssetsStore = defineStore('assets', {
    state: (): AssetsState => ({
        list: [],
        specs: [],
        selectedIds: [],
        selectedDbIds: [],
        loading: false,
        error: null,
    }),

    getters: {
        /**
         * 根据 ID 获取资产
         */
        getById: (state) => (id: number): Asset | undefined => {
            return state.list.find(a => a.id === id);
        },

        /**
         * 根据资产编码获取资产
         */
        getByCode: (state) => (code: string): Asset | undefined => {
            return state.list.find(a => a.assetCode === code);
        },

        /**
         * 根据 dbId 获取资产
         */
        getByDbId: (state) => (dbId: number): Asset | undefined => {
            return state.list.find(a => a.dbId === dbId);
        },

        /**
         * 获取选中的资产列表
         */
        selectedAssets: (state): Asset[] => {
            return state.list.filter(a => state.selectedIds.includes(a.id));
        },

        /**
         * 根据规格编码获取资产列表
         */
        getBySpecCode: (state) => (specCode: string): Asset[] => {
            return state.list.filter(a => a.specCode === specCode);
        },

        /**
         * 根据文件 ID 过滤资产
         */
        getByFileId: (state) => (fileId: number): Asset[] => {
            return state.list.filter(a => a.fileId === fileId);
        },
    },

    actions: {
        /**
         * 设置资产列表
         */
        setAssets(assets: Asset[]) {
            this.list = assets;
        },

        /**
         * 设置规格列表
         */
        setSpecs(specs: AssetSpec[]) {
            this.specs = specs;
        },

        /**
         * 选择资产
         */
        selectAsset(id: number, dbId?: number) {
            if (!this.selectedIds.includes(id)) {
                this.selectedIds.push(id);
            }
            if (dbId !== undefined && !this.selectedDbIds.includes(dbId)) {
                this.selectedDbIds.push(dbId);
            }
        },

        /**
         * 取消选择资产
         */
        deselectAsset(id: number, dbId?: number) {
            this.selectedIds = this.selectedIds.filter(i => i !== id);
            if (dbId !== undefined) {
                this.selectedDbIds = this.selectedDbIds.filter(i => i !== dbId);
            }
        },

        /**
         * 切换资产选择状态
         */
        toggleAsset(id: number, dbId?: number) {
            if (this.selectedIds.includes(id)) {
                this.deselectAsset(id, dbId);
            } else {
                this.selectAsset(id, dbId);
            }
        },

        /**
         * 清除所有选择
         */
        clearSelection() {
            this.selectedIds = [];
            this.selectedDbIds = [];
        },

        /**
         * 更新资产
         */
        updateAsset(id: number, updates: Partial<Asset>) {
            const index = this.list.findIndex(a => a.id === id);
            if (index !== -1) {
                this.list[index] = { ...this.list[index], ...updates };
            }
        },

        /**
         * 设置加载状态
         */
        setLoading(loading: boolean) {
            this.loading = loading;
        },

        /**
         * 设置错误
         */
        setError(error: string | null) {
            this.error = error;
        },
    },
});
