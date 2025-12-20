/**
 * useHeatmap.ts - 可扩展的热力图 Composable
 * 
 * 支持多种传感器数据类型的热力图渲染
 * - 温度 (temperature)
 * - 湿度 (humidity)
 * - 二氧化碳浓度 (co2)
 * - 可扩展更多类型
 */

import { ref, computed, readonly } from 'vue';

// ==================== 类型定义 ====================

/** 传感器数据类型 */
export type SensorType = 'temperature' | 'humidity' | 'co2' | 'pm25' | 'noise' | 'light';

/** 传感器配置 */
export interface SensorConfig {
    /** 显示名称 */
    label: string;
    /** 单位 */
    unit: string;
    /** 最小值 */
    min: number;
    /** 最大值 */
    max: number;
    /** 色谱起始色相 (HSL) */
    hueStart: number;
    /** 色谱结束色相 (HSL) */
    hueEnd: number;
    /** 警告阈值（可选） */
    warningThreshold?: number;
    /** 危险阈值（可选） */
    dangerThreshold?: number;
}

/** 房间热力图数据 */
export interface RoomHeatmapData {
    dbId: number;
    value: number;
    code?: string;
    name?: string;
}

/** 热力图选项 */
export interface HeatmapOptions {
    /** 颜色透明度 (0-1) */
    opacity?: number;
    /** 变化阈值 - 值变化小于此值时不更新 */
    changeThreshold?: number;
    /** 防抖延迟 (ms) */
    debounceDelay?: number;
}

// ==================== 预设传感器配置 ====================

export const SENSOR_CONFIGS: Record<SensorType, SensorConfig> = {
    temperature: {
        label: '温度',
        unit: '°C',
        min: -20,
        max: 40,
        hueStart: 240,  // 蓝色 (冷)
        hueEnd: 0,      // 红色 (热)
        warningThreshold: 28,
        dangerThreshold: 35
    },
    humidity: {
        label: '湿度',
        unit: '%',
        min: 0,
        max: 100,
        hueStart: 60,   // 黄色 (干燥)
        hueEnd: 200,    // 青蓝色 (潮湿)
        warningThreshold: 70,
        dangerThreshold: 85
    },
    co2: {
        label: '二氧化碳',
        unit: 'ppm',
        min: 400,
        max: 2000,
        hueStart: 120,  // 绿色 (良好)
        hueEnd: 0,      // 红色 (危险)
        warningThreshold: 1000,
        dangerThreshold: 1500
    },
    pm25: {
        label: 'PM2.5',
        unit: 'μg/m³',
        min: 0,
        max: 200,
        hueStart: 120,  // 绿色 (良好)
        hueEnd: 0,      // 红色 (危险)
        warningThreshold: 75,
        dangerThreshold: 150
    },
    noise: {
        label: '噪音',
        unit: 'dB',
        min: 30,
        max: 90,
        hueStart: 120,  // 绿色 (安静)
        hueEnd: 0,      // 红色 (嘈杂)
        warningThreshold: 65,
        dangerThreshold: 80
    },
    light: {
        label: '光照',
        unit: 'lux',
        min: 0,
        max: 1000,
        hueStart: 30,   // 橙色 (暗)
        hueEnd: 60,     // 黄色 (亮)
        warningThreshold: 500,
        dangerThreshold: 800
    }
};

// ==================== Composable 实现 ====================

export function useHeatmap(options: HeatmapOptions = {}) {
    const {
        opacity = 0.8,
        changeThreshold = 0.3,
        debounceDelay = 400
    } = options;

    // 状态
    const isEnabled = ref(false);
    const currentSensorType = ref<SensorType>('temperature');
    const lastAppliedValues: Record<number, number> = {};
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let viewerInstance: any = null;

    // 计算属性
    const currentConfig = computed(() => SENSOR_CONFIGS[currentSensorType.value]);

    // ==================== 颜色计算 ====================

    /**
     * HSL 转 RGB
     */
    const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r: number, g: number, b: number;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number): number => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    };

    /**
     * 根据值计算颜色
     */
    const getColorForValue = (value: number, config?: SensorConfig): { r: number; g: number; b: number; hue: number } => {
        const cfg = config || currentConfig.value;

        // 归一化值到 0-1 范围
        let t = (value - cfg.min) / (cfg.max - cfg.min);
        t = Math.max(0, Math.min(1, t));

        // 计算色相
        const hue = cfg.hueStart + (cfg.hueEnd - cfg.hueStart) * t;

        // 转换为 RGB
        const [r, g, b] = hslToRgb(hue, 100, 50);

        return { r, g, b, hue };
    };

    /**
     * 获取 THREE.Vector4 颜色对象
     */
    const getThreeColor = (value: number, config?: SensorConfig): any => {
        const { r, g, b } = getColorForValue(value, config);

        // 检查 THREE 是否可用
        if (typeof window !== 'undefined' && (window as any).THREE) {
            return new (window as any).THREE.Vector4(r / 255, g / 255, b / 255, opacity);
        }

        return { x: r / 255, y: g / 255, z: b / 255, w: opacity };
    };

    // ==================== Viewer 操作 ====================

    /**
     * 设置 Viewer 实例
     */
    const setViewer = (viewer: any) => {
        viewerInstance = viewer;
    };

    /**
     * 应用热力图样式到指定房间
     */
    const applyHeatmapStyle = (roomsData: RoomHeatmapData[]) => {
        if (!viewerInstance || !isEnabled.value) return;

        let changed = false;

        roomsData.forEach(room => {
            const { dbId, value } = room;

            // 检查值是否有显著变化
            const prevValue = lastAppliedValues[dbId];
            if (prevValue !== undefined && Math.abs(prevValue - value) < changeThreshold) {
                return;
            }

            // 计算并应用颜色
            const color = getThreeColor(value);
            viewerInstance.setThemingColor(dbId, color);

            lastAppliedValues[dbId] = value;
            changed = true;
        });

        // 强制刷新渲染
        if (changed && viewerInstance.impl) {
            viewerInstance.impl.invalidate(false, false, false);
        }
    };

    /**
     * 带防抖的热力图更新
     */
    const updateHeatmapDebounced = (roomsData: RoomHeatmapData[]) => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            applyHeatmapStyle(roomsData);
        }, debounceDelay);
    };

    /**
     * 清除热力图
     */
    const clearHeatmap = () => {
        if (!viewerInstance) return;

        viewerInstance.clearThemingColors();
        Object.keys(lastAppliedValues).forEach(key => {
            delete lastAppliedValues[Number(key)];
        });
    };

    /**
     * 恢复默认材质
     */
    const restoreDefaultMaterial = (dbIds: number[], getMaterial: () => any) => {
        if (!viewerInstance || !viewerInstance.model) return;

        const mat = getMaterial();
        const fragList = viewerInstance.model.getFragmentList();
        const tree = viewerInstance.model.getInstanceTree();

        dbIds.forEach(dbId => {
            tree.enumNodeFragments(dbId, (fragId: number) => {
                fragList.setMaterial(fragId, mat);
            });
        });

        viewerInstance.impl.invalidate(true, true, true);
    };

    // ==================== 状态控制 ====================

    /**
     * 启用热力图
     */
    const enable = (roomsData?: RoomHeatmapData[]) => {
        isEnabled.value = true;
        if (roomsData) {
            applyHeatmapStyle(roomsData);
        }
    };

    /**
     * 禁用热力图
     */
    const disable = () => {
        isEnabled.value = false;
        clearHeatmap();
    };

    /**
     * 切换热力图状态
     */
    const toggle = (roomsData?: RoomHeatmapData[]) => {
        if (isEnabled.value) {
            disable();
        } else {
            enable(roomsData);
        }
        return isEnabled.value;
    };

    /**
     * 切换传感器类型
     */
    const switchSensorType = (type: SensorType, roomsData?: RoomHeatmapData[]) => {
        currentSensorType.value = type;

        // 清除旧的值缓存，强制重新应用颜色
        Object.keys(lastAppliedValues).forEach(key => {
            delete lastAppliedValues[Number(key)];
        });

        if (isEnabled.value && roomsData) {
            applyHeatmapStyle(roomsData);
        }
    };

    // ==================== 辅助函数 ====================

    /**
     * 获取可用的传感器类型列表
     */
    const getAvailableSensorTypes = (): { type: SensorType; config: SensorConfig }[] => {
        return Object.entries(SENSOR_CONFIGS).map(([type, config]) => ({
            type: type as SensorType,
            config
        }));
    };

    /**
     * 获取值的警告级别
     */
    const getAlertLevel = (value: number, config?: SensorConfig): 'normal' | 'warning' | 'danger' => {
        const cfg = config || currentConfig.value;

        if (cfg.dangerThreshold !== undefined && value >= cfg.dangerThreshold) {
            return 'danger';
        }
        if (cfg.warningThreshold !== undefined && value >= cfg.warningThreshold) {
            return 'warning';
        }
        return 'normal';
    };

    /**
     * 格式化值显示
     */
    const formatValue = (value: number, config?: SensorConfig): string => {
        const cfg = config || currentConfig.value;
        return `${value.toFixed(1)}${cfg.unit}`;
    };

    // ==================== 清理 ====================

    const cleanup = () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        clearHeatmap();
        viewerInstance = null;
    };

    // ==================== 返回接口 ====================

    return {
        // 状态
        isEnabled: readonly(isEnabled),
        currentSensorType: readonly(currentSensorType),
        currentConfig,

        // Viewer 操作
        setViewer,
        applyHeatmapStyle,
        updateHeatmapDebounced,
        clearHeatmap,
        restoreDefaultMaterial,

        // 状态控制
        enable,
        disable,
        toggle,
        switchSensorType,

        // 辅助函数
        getColorForValue,
        getThreeColor,
        getAvailableSensorTypes,
        getAlertLevel,
        formatValue,

        // 清理
        cleanup,

        // 配置
        SENSOR_CONFIGS
    };
}

// 导出默认实例（可选）
export default useHeatmap;
