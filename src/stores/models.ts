/**
 * 模型状态管理
 * 管理 3D 模型文件和加载状态
 */
import { defineStore } from 'pinia';

export interface ModelFile {
    id: number;
    fileName: string;
    displayName: string;
    filePath: string;
    urn?: string;
    status: 'pending' | 'processing' | 'ready' | 'error';
    fileSize?: number;
    uploadedAt: string;
    facilityId?: number; // 为设施层预留
}

export interface ModelsState {
    list: ModelFile[];
    activeModelId: number | null;
    activeModel: ModelFile | null;
    loading: boolean;
    error: string | null;
}

export const useModelsStore = defineStore('models', {
    state: (): ModelsState => ({
        list: [],
        activeModelId: null,
        activeModel: null,
        loading: false,
        error: null,
    }),

    getters: {
        /**
         * 根据 ID 获取模型
         */
        getById: (state) => (id: number): ModelFile | undefined => {
            return state.list.find(m => m.id === id);
        },

        /**
         * 获取就绪状态的模型列表
         */
        readyModels: (state): ModelFile[] => {
            return state.list.filter(m => m.status === 'ready');
        },

        /**
         * 根据设施 ID 过滤模型（为设施层预留）
         */
        getByFacilityId: (state) => (facilityId: number): ModelFile[] => {
            return state.list.filter(m => m.facilityId === facilityId);
        },
    },

    actions: {
        /**
         * 设置模型列表
         */
        setModels(models: ModelFile[]) {
            this.list = models;
        },

        /**
         * 添加模型
         */
        addModel(model: ModelFile) {
            this.list.push(model);
        },

        /**
         * 更新模型
         */
        updateModel(id: number, updates: Partial<ModelFile>) {
            const index = this.list.findIndex(m => m.id === id);
            if (index !== -1) {
                this.list[index] = { ...this.list[index], ...updates };
            }
        },

        /**
         * 删除模型
         */
        removeModel(id: number) {
            this.list = this.list.filter(m => m.id !== id);
            if (this.activeModelId === id) {
                this.activeModelId = null;
                this.activeModel = null;
            }
        },

        /**
         * 设置当前激活的模型
         */
        setActiveModel(id: number | null) {
            this.activeModelId = id;
            this.activeModel = id !== null ? this.list.find(m => m.id === id) || null : null;
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
