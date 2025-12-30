/**
 * 3D Viewer Composable
 * 封装与 Forge Viewer 交互的逻辑
 */
import { ref, shallowRef } from 'vue';

export interface ViewerOptions {
    containerRef: HTMLElement | null;
    onViewerReady?: () => void;
    onModelLoaded?: () => void;
    onSelectionChanged?: (dbIds: number[]) => void;
}

export function useViewer() {
    // Viewer 实例（使用 shallowRef 避免深度响应式）
    const viewer = shallowRef<any>(null);
    const isReady = ref(false);
    const isLoading = ref(false);
    const currentModelPath = ref<string | null>(null);
    const error = ref<string | null>(null);

    /**
     * 获取 Viewer 状态（用于保存视图）
     */
    const getViewerState = () => {
        if (!viewer.value) return null;
        return viewer.value.getState();
    };

    /**
     * 恢复 Viewer 状态
     */
    const restoreViewerState = (state: any) => {
        if (!viewer.value || !state) return;
        viewer.value.restoreState(state);
    };

    /**
     * 获取当前选中的 dbIds
     */
    const getSelection = (): number[] => {
        if (!viewer.value) return [];
        return viewer.value.getSelection() || [];
    };

    /**
     * 设置选中对象
     */
    const setSelection = (dbIds: number[]) => {
        if (!viewer.value) return;
        viewer.value.select(dbIds);
    };

    /**
     * 清除选择
     */
    const clearSelection = () => {
        if (!viewer.value) return;
        viewer.value.clearSelection();
    };

    /**
     * 隔离对象
     */
    const isolate = (dbIds: number[]) => {
        if (!viewer.value) return;
        viewer.value.isolate(dbIds);
    };

    /**
     * 显示所有对象
     */
    const showAll = () => {
        if (!viewer.value) return;
        viewer.value.showAll();
    };

    /**
     * 定位到对象
     */
    const fitToView = (dbIds: number[], immediate = false) => {
        if (!viewer.value) return;
        viewer.value.fitToView(dbIds, viewer.value.model, immediate);
    };

    /**
     * 隔离并定位
     */
    const isolateAndFocus = (dbIds: number[]) => {
        if (!viewer.value || dbIds.length === 0) return;
        isolate(dbIds);
        fitToView(dbIds);
    };

    /**
     * 设置对象颜色
     */
    const setThemingColor = (dbId: number, color: { r: number; g: number; b: number; a?: number }) => {
        if (!viewer.value) return;
        const THREE = (window as any).THREE;
        if (!THREE) return;

        const threeColor = new THREE.Vector4(
            color.r / 255,
            color.g / 255,
            color.b / 255,
            color.a ?? 1
        );
        viewer.value.setThemingColor(dbId, threeColor, viewer.value.model);
    };

    /**
     * 清除所有颜色
     */
    const clearThemingColors = () => {
        if (!viewer.value) return;
        viewer.value.clearThemingColors(viewer.value.model);
    };

    /**
     * 截图
     */
    const captureScreenshot = (callback: (blob: Blob | null) => void) => {
        if (!viewer.value) {
            callback(null);
            return;
        }

        viewer.value.getScreenShot(
            viewer.value.container.clientWidth,
            viewer.value.container.clientHeight,
            (blobUrl: string) => {
                fetch(blobUrl)
                    .then(res => res.blob())
                    .then(blob => callback(blob))
                    .catch(() => callback(null));
            }
        );
    };

    /**
     * 获取对象属性
     */
    const getProperties = (dbId: number): Promise<any> => {
        return new Promise((resolve, reject) => {
            if (!viewer.value || !viewer.value.model) {
                reject(new Error('Viewer not ready'));
                return;
            }

            viewer.value.model.getProperties(dbId, (result: any) => {
                resolve(result);
            }, (error: any) => {
                reject(error);
            });
        });
    };

    /**
     * 批量获取对象属性
     */
    const getBulkProperties = (
        dbIds: number[],
        propFilter: string[] = []
    ): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            if (!viewer.value || !viewer.value.model) {
                reject(new Error('Viewer not ready'));
                return;
            }

            viewer.value.model.getBulkProperties(
                dbIds,
                { propFilter },
                (results: any[]) => resolve(results),
                (error: any) => reject(error)
            );
        });
    };

    /**
     * 搜索对象
     */
    const search = (query: string, attributeNames?: string[]): Promise<number[]> => {
        return new Promise((resolve, reject) => {
            if (!viewer.value || !viewer.value.model) {
                reject(new Error('Viewer not ready'));
                return;
            }

            viewer.value.model.search(
                query,
                (dbIds: number[]) => resolve(dbIds),
                (error: any) => reject(error),
                attributeNames
            );
        });
    };

    /**
     * 调整视图大小
     */
    const resize = () => {
        if (!viewer.value) return;
        viewer.value.resize();
    };

    return {
        // 状态
        viewer,
        isReady,
        isLoading,
        currentModelPath,
        error,

        // 方法
        getViewerState,
        restoreViewerState,
        getSelection,
        setSelection,
        clearSelection,
        isolate,
        showAll,
        fitToView,
        isolateAndFocus,
        setThemingColor,
        clearThemingColors,
        captureScreenshot,
        getProperties,
        getBulkProperties,
        search,
        resize,
    };
}
