/**
 * 选择逻辑 Composable
 * 封装资产和空间的选择逻辑
 */
import { computed } from 'vue';
import { useAssetsStore } from '@/stores/assets';
import { useSpacesStore } from '@/stores/spaces';

export function useSelection() {
    const assetsStore = useAssetsStore();
    const spacesStore = useSpacesStore();

    // ============ 资产选择 ============

    const selectedAssetIds = computed(() => assetsStore.selectedIds);
    const selectedAssetDbIds = computed(() => assetsStore.selectedDbIds);
    const selectedAssets = computed(() => assetsStore.selectedAssets);

    /**
     * 选择资产
     */
    const selectAsset = (id: number, dbId?: number) => {
        assetsStore.selectAsset(id, dbId);
    };

    /**
     * 取消选择资产
     */
    const deselectAsset = (id: number, dbId?: number) => {
        assetsStore.deselectAsset(id, dbId);
    };

    /**
     * 切换资产选择
     */
    const toggleAsset = (id: number, dbId?: number) => {
        assetsStore.toggleAsset(id, dbId);
    };

    /**
     * 清除资产选择
     */
    const clearAssetSelection = () => {
        assetsStore.clearSelection();
    };

    /**
     * 根据 dbId 选择资产
     */
    const selectAssetsByDbIds = (dbIds: number[]) => {
        assetsStore.clearSelection();
        dbIds.forEach(dbId => {
            const asset = assetsStore.list.find(a => a.dbId === dbId);
            if (asset) {
                assetsStore.selectAsset(asset.id, dbId);
            }
        });
    };

    // ============ 空间选择 ============

    const selectedSpaceIds = computed(() => spacesStore.selectedIds);
    const selectedSpaceDbIds = computed(() => spacesStore.selectedDbIds);
    const selectedSpaces = computed(() => spacesStore.selectedSpaces);

    /**
     * 选择空间
     */
    const selectSpace = (id: number, dbId?: number) => {
        spacesStore.selectSpace(id, dbId);
    };

    /**
     * 取消选择空间
     */
    const deselectSpace = (id: number, dbId?: number) => {
        spacesStore.deselectSpace(id, dbId);
    };

    /**
     * 切换空间选择
     */
    const toggleSpace = (id: number, dbId?: number) => {
        spacesStore.toggleSpace(id, dbId);
    };

    /**
     * 清除空间选择
     */
    const clearSpaceSelection = () => {
        spacesStore.clearSelection();
    };

    /**
     * 根据 dbId 选择空间
     */
    const selectSpacesByDbIds = (dbIds: number[]) => {
        spacesStore.clearSelection();
        dbIds.forEach(dbId => {
            const space = spacesStore.list.find(s => s.dbId === dbId);
            if (space) {
                spacesStore.selectSpace(space.id, dbId);
            }
        });
    };

    // ============ 通用方法 ============

    /**
     * 清除所有选择
     */
    const clearAllSelection = () => {
        assetsStore.clearSelection();
        spacesStore.clearSelection();
    };

    return {
        // 资产选择
        selectedAssetIds,
        selectedAssetDbIds,
        selectedAssets,
        selectAsset,
        deselectAsset,
        toggleAsset,
        clearAssetSelection,
        selectAssetsByDbIds,

        // 空间选择
        selectedSpaceIds,
        selectedSpaceDbIds,
        selectedSpaces,
        selectSpace,
        deselectSpace,
        toggleSpace,
        clearSpaceSelection,
        selectSpacesByDbIds,

        // 通用
        clearAllSelection,
    };
}
