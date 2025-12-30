/**
 * 空间状态管理
 * 管理空间数据和选择状态
 */
import { defineStore } from 'pinia';

export interface Space {
    id: number;
    spaceCode: string;
    name: string;
    category?: string;
    floor?: string;
    area?: number;
    dbId?: number;
    fileId?: number;
    classificationCode?: string;
    // 动态属性预留
    properties?: Record<string, unknown>;
}

export interface SpacesState {
    list: Space[];
    selectedIds: number[];
    selectedDbIds: number[];
    loading: boolean;
    error: string | null;
}

export const useSpacesStore = defineStore('spaces', {
    state: (): SpacesState => ({
        list: [],
        selectedIds: [],
        selectedDbIds: [],
        loading: false,
        error: null,
    }),

    getters: {
        /**
         * 根据 ID 获取空间
         */
        getById: (state) => (id: number): Space | undefined => {
            return state.list.find(s => s.id === id);
        },

        /**
         * 根据空间编码获取空间
         */
        getByCode: (state) => (code: string): Space | undefined => {
            return state.list.find(s => s.spaceCode === code);
        },

        /**
         * 根据 dbId 获取空间
         */
        getByDbId: (state) => (dbId: number): Space | undefined => {
            return state.list.find(s => s.dbId === dbId);
        },

        /**
         * 获取选中的空间列表
         */
        selectedSpaces: (state): Space[] => {
            return state.list.filter(s => state.selectedIds.includes(s.id));
        },

        /**
         * 根据楼层过滤空间
         */
        getByFloor: (state) => (floor: string): Space[] => {
            return state.list.filter(s => s.floor === floor);
        },

        /**
         * 根据文件 ID 过滤空间
         */
        getByFileId: (state) => (fileId: number): Space[] => {
            return state.list.filter(s => s.fileId === fileId);
        },

        /**
         * 获取所有楼层列表
         */
        floors: (state): string[] => {
            const floorSet = new Set<string>();
            state.list.forEach(s => {
                if (s.floor) floorSet.add(s.floor);
            });
            return Array.from(floorSet).sort();
        },
    },

    actions: {
        /**
         * 设置空间列表
         */
        setSpaces(spaces: Space[]) {
            this.list = spaces;
        },

        /**
         * 选择空间
         */
        selectSpace(id: number, dbId?: number) {
            if (!this.selectedIds.includes(id)) {
                this.selectedIds.push(id);
            }
            if (dbId !== undefined && !this.selectedDbIds.includes(dbId)) {
                this.selectedDbIds.push(dbId);
            }
        },

        /**
         * 取消选择空间
         */
        deselectSpace(id: number, dbId?: number) {
            this.selectedIds = this.selectedIds.filter(i => i !== id);
            if (dbId !== undefined) {
                this.selectedDbIds = this.selectedDbIds.filter(i => i !== dbId);
            }
        },

        /**
         * 切换空间选择状态
         */
        toggleSpace(id: number, dbId?: number) {
            if (this.selectedIds.includes(id)) {
                this.deselectSpace(id, dbId);
            } else {
                this.selectSpace(id, dbId);
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
         * 更新空间
         */
        updateSpace(id: number, updates: Partial<Space>) {
            const index = this.list.findIndex(s => s.id === id);
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
