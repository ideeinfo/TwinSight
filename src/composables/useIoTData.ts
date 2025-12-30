/**
 * IoT 数据 Composable
 * 封装温度数据获取和处理逻辑
 */
import { computed } from 'vue';
import { useIoTStore } from '@/stores/iot';

export interface TimeSeriesPoint {
    timestamp: number;
    value: number;
}

export interface RoomTemperature {
    code: string;
    name: string;
    temperature: number | null;
    timestamp?: number;
}

export function useIoTData() {
    const iotStore = useIoTStore();

    // ============ 计算属性 ============
    const isTimelineOpen = computed(() => iotStore.isTimelineOpen);
    const isLive = computed(() => iotStore.isLive);
    const isPlaying = computed(() => iotStore.isPlaying);
    const playbackSpeed = computed(() => iotStore.playbackSpeed);
    const currentTimeMs = computed(() => iotStore.currentTimeMs);
    const rangeStartMs = computed(() => iotStore.rangeStartMs);
    const rangeEndMs = computed(() => iotStore.rangeEndMs);
    const isHeatmapEnabled = computed(() => iotStore.isHeatmapEnabled);
    const roomTags = computed(() => iotStore.roomTags);
    const hasInfluxConfig = computed(() => iotStore.hasInfluxConfig);

    // ============ 方法 ============

    /**
     * 切换时间轴显示
     */
    const toggleTimeline = (open?: boolean) => {
        iotStore.toggleTimeline(open);
    };

    /**
     * 进入实时模式
     */
    const goLive = () => {
        iotStore.goLive();
    };

    /**
     * 播放/暂停
     */
    const togglePlayback = () => {
        iotStore.togglePlayback();
    };

    /**
     * 设置播放速度
     */
    const setPlaybackSpeed = (speed: number) => {
        iotStore.setPlaybackSpeed(speed);
    };

    /**
     * 设置时间范围
     */
    const setTimeRange = (startMs: number, endMs: number) => {
        iotStore.setTimeRange(startMs, endMs);
    };

    /**
     * 设置当前时间
     */
    const setCurrentTime = (timeMs: number) => {
        iotStore.setCurrentTime(timeMs);
    };

    /**
     * 切换热力图
     */
    const toggleHeatmap = () => {
        iotStore.toggleHeatmap();
    };

    /**
     * 设置房间标签
     */
    const setRoomTags = (tags: any[]) => {
        iotStore.setRoomTags(tags);
    };

    /**
     * 更新单个房间标签
     */
    const updateRoomTag = (code: string, updates: any) => {
        iotStore.updateRoomTag(code, updates);
    };

    /**
     * 根据温度值计算热力图颜色
     */
    const temperatureToColor = (
        temp: number,
        minTemp = 18,
        maxTemp = 30
    ): { r: number; g: number; b: number } => {
        // 归一化到 0-1
        const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

        // 从蓝色 (240°) 到红色 (0°)
        const hue = (1 - normalized) * 240;

        // HSL to RGB
        const h = hue / 360;
        const s = 0.8;
        const l = 0.5;

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

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
        };
    };

    return {
        // 状态
        isTimelineOpen,
        isLive,
        isPlaying,
        playbackSpeed,
        currentTimeMs,
        rangeStartMs,
        rangeEndMs,
        isHeatmapEnabled,
        roomTags,
        hasInfluxConfig,

        // 方法
        toggleTimeline,
        goLive,
        togglePlayback,
        setPlaybackSpeed,
        setTimeRange,
        setCurrentTime,
        toggleHeatmap,
        setRoomTags,
        updateRoomTag,
        temperatureToColor,
    };
}
