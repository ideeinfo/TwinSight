/**
 * useViewState Composable
 * 
 * 管理 3D Viewer 的视图状态，包括：
 * - 获取当前视图状态
 * - 截取屏幕快照
 * - 恢复视图状态
 */

import type { Ref } from 'vue';

// Viewer 类型声明（简化版）
interface ViewerInstance {
    getState: (options: object) => object;
    restoreState: (state: object) => boolean;
    getScreenShot: (width: number, height: number, callback: (data: string) => void) => void;
    getIsolatedNodes: () => number[];
    isolate: (dbIds: number[]) => void;
    impl: {
        invalidate: (renderOverlay: boolean, renderScene: boolean, renderOverlayOnly: boolean) => void;
        currentLightPreset?: () => string;
    };
}

// Heatmap Composable 接口
interface HeatmapComposable {
    enable: () => void;
    disable: () => void;
}

// Composable 参数
interface UseViewStateOptions {
    getViewer: () => ViewerInstance | null;
    isHeatmapEnabled: Ref<boolean>;
    areTagsVisible: Ref<boolean>;
    heatmap: HeatmapComposable;
}

export function useViewState(options: UseViewStateOptions) {
    const { getViewer, isHeatmapEnabled, areTagsVisible, heatmap } = options;

    // 内部状态：是否正在恢复视图
    let isRestoringView = false;

    /**
     * 获取当前视图状态
     */
    const getViewerState = () => {
        const viewer = getViewer();
        if (!viewer) return {};

        try {
            // 使用 Forge Viewer 官方 API 获取完整状态，包括孤立状态
            const viewerState = viewer.getState({
                viewport: true,
                objectSet: true,  // 包含孤立/隐藏状态
                cutplanes: true,
                explodeScale: true,
                renderOptions: true
            });

            return {
                viewerState,
                cameraState: (viewerState as any)?.viewport || {},
                isolationState: (viewerState as any)?.objectSet || {},
                selectionState: { selectedIds: [] },
                themingState: {},
                environment: viewer.impl?.currentLightPreset?.() || '',
                cutplanes: (viewerState as any)?.cutplanes || [],
                explodeScale: (viewerState as any)?.explodeScale || 0,
                renderOptions: (viewerState as any)?.renderOptions || {},
                otherSettings: {
                    isHeatmapEnabled: isHeatmapEnabled.value,
                    areTagsVisible: areTagsVisible.value
                }
            };
        } catch (error) {
            console.error('获取视图状态失败:', error);
            return {};
        }
    };

    /**
     * 截取屏幕快照
     */
    const captureScreenshot = (callback: (data: string | null) => void) => {
        const viewer = getViewer();
        if (!viewer) {
            console.warn('⚠️ captureScreenshot: viewer 不存在');
            callback(null);
            return;
        }

        try {
            console.log('📸 开始截图...');

            // Forge Viewer getScreenShot 返回的可能是 blob URL
            viewer.getScreenShot(156, 117, (blobUrlOrDataUrl: string) => {
                console.log('📸 截图回调, 类型:', blobUrlOrDataUrl ? blobUrlOrDataUrl.substring(0, 30) : 'null');

                if (!blobUrlOrDataUrl) {
                    callback(null);
                    return;
                }

                // 如果已经是 data URL，直接返回
                if (blobUrlOrDataUrl.startsWith('data:')) {
                    console.log('📸 已是 data URL，长度:', blobUrlOrDataUrl.length);
                    callback(blobUrlOrDataUrl);
                    return;
                }

                // 如果是 blob URL，需要转换为 base64
                if (blobUrlOrDataUrl.startsWith('blob:')) {
                    console.log('📸 是 blob URL，开始转换...');

                    fetch(blobUrlOrDataUrl)
                        .then(response => response.blob())
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64 = reader.result as string;
                                console.log('📸 转换完成, 长度:', base64 ? base64.length : 0);
                                callback(base64);
                            };
                            reader.onerror = () => {
                                console.error('📸 FileReader 错误');
                                callback(null);
                            };
                            reader.readAsDataURL(blob);
                        })
                        .catch(error => {
                            console.error('📸 Fetch blob 失败:', error);
                            callback(null);
                        });
                    return;
                }

                // 其他情况，尝试直接使用
                console.log('📸 未知格式，尝试直接使用');
                callback(blobUrlOrDataUrl);
            });
        } catch (error) {
            console.error('截图失败:', error);
            callback(null);
        }
    };

    /**
     * 恢复视图状态
     */
    const restoreViewState = (viewData: any) => {
        console.log('🔄 开始恢复视图状态:', viewData);
        const viewer = getViewer();

        if (!viewer) {
            console.error('❌ Viewer 未初始化，无法恢复视图');
            return;
        }
        if (!viewData) {
            console.error('❌ viewData 为空');
            return;
        }

        try {
            // 优先使用 viewerState（Forge Viewer 官方格式）
            // restoreState 会自动处理孤立/隐藏状态（如果保存时包含了 objectSet）
            if (viewData.viewer_state || viewData.viewerState) {
                const viewerState = viewData.viewer_state || viewData.viewerState;
                console.log('🔄 使用 Forge Viewer restoreState API 恢复视图:', viewerState);

                if (!viewerState) {
                    console.error('❌ viewerState 无效');
                } else {
                    isRestoringView = true;
                    // 使用 restoreState 恢复所有状态
                    const success = viewer.restoreState(viewerState);
                    console.log('✅ restoreState 调用完成，返回值:', success);
                    setTimeout(() => { isRestoringView = false; }, 500);

                    // 补救措施：强制应用孤立状态
                    // 某些情况下 restoreState 可能不会正确清除之前的孤立状态，或者不应用新的孤立状态
                    if (viewerState.objectSet) {
                        const isolated = viewerState.objectSet.isolated || [];
                        const currentIsolated = viewer.getIsolatedNodes();

                        // 如果存档有孤立，但当前没有生效，强制应用
                        if (isolated.length > 0 && (!currentIsolated || currentIsolated.length === 0)) {
                            console.warn('⚠️ 强制应用孤立状态...');
                            viewer.isolate(isolated);
                        }
                    }
                }
            } else {
                console.warn('⚠️ 视图数据中缺少 viewer_state，无法恢复');
            }

            // 恢复自定义设置
            const otherSettings = viewData.other_settings || viewData.otherSettings;
            if (otherSettings) {
                if (typeof otherSettings.isHeatmapEnabled === 'boolean') {
                    // 使用 heatmap composable 的 enable/disable 方法来控制状态
                    if (otherSettings.isHeatmapEnabled) {
                        heatmap.enable();
                    } else {
                        heatmap.disable();
                    }
                }
                if (typeof otherSettings.areTagsVisible === 'boolean') {
                    areTagsVisible.value = otherSettings.areTagsVisible;
                }
            }

            viewer.impl.invalidate(true, true, true);
        } catch (error) {
            console.error('恢复视图状态失败:', error);
        }
    };

    /**
     * 检查是否正在恢复视图状态
     */
    const getIsRestoringView = () => isRestoringView;

    return {
        getViewerState,
        captureScreenshot,
        restoreViewState,
        getIsRestoringView
    };
}
