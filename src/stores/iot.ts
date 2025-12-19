/**
 * IoT 数据状态管理
 * 管理时序数据、温度标签等
 */
import { defineStore } from 'pinia';

export interface TimeSeriesPoint {
    timestamp: number;
    value: number;
}

export interface RoomTag {
    dbId: number;
    code: string;
    name: string;
    screenPos: { x: number; y: number } | null;
    currentTemp: number | null;
    visible: boolean;
}

export interface IoTState {
    // 时间轴
    isTimelineOpen: boolean;
    isLive: boolean;
    isPlaying: boolean;
    playbackSpeed: number;

    // 时间范围
    rangeStartMs: number;
    rangeEndMs: number;
    currentTimeMs: number;

    // 温度数据
    roomTags: RoomTag[];
    chartData: TimeSeriesPoint[];
    selectedRoomSeries: { code: string; name: string; data: TimeSeriesPoint[] }[];

    // 热力图
    isHeatmapEnabled: boolean;

    // InfluxDB 配置
    influxConfig: {
        url: string;
        org: string;
        bucket: string;
        hasToken: boolean;
    } | null;

    loading: boolean;
    error: string | null;
}

export const useIoTStore = defineStore('iot', {
    state: (): IoTState => ({
        isTimelineOpen: false,
        isLive: true,
        isPlaying: false,
        playbackSpeed: 1,
        rangeStartMs: 0,
        rangeEndMs: 0,
        currentTimeMs: Date.now(),
        roomTags: [],
        chartData: [],
        selectedRoomSeries: [],
        isHeatmapEnabled: false,
        influxConfig: null,
        loading: false,
        error: null,
    }),

    getters: {
        /**
         * 根据 code 获取房间标签
         */
        getTagByCode: (state) => (code: string): RoomTag | undefined => {
            return state.roomTags.find(t => t.code === code);
        },

        /**
         * 获取可见的房间标签
         */
        visibleTags: (state): RoomTag[] => {
            return state.roomTags.filter(t => t.visible && t.screenPos);
        },

        /**
         * 是否有 InfluxDB 配置
         */
        hasInfluxConfig: (state): boolean => {
            return state.influxConfig !== null && state.influxConfig.hasToken;
        },
    },

    actions: {
        /**
         * 切换时间轴
         */
        toggleTimeline(open?: boolean) {
            this.isTimelineOpen = open ?? !this.isTimelineOpen;
        },

        /**
         * 进入实时模式
         */
        goLive() {
            this.isLive = true;
            this.isPlaying = false;
            this.currentTimeMs = Date.now();
        },

        /**
         * 播放/暂停
         */
        togglePlayback() {
            this.isPlaying = !this.isPlaying;
            if (this.isPlaying) {
                this.isLive = false;
            }
        },

        /**
         * 设置播放速度
         */
        setPlaybackSpeed(speed: number) {
            this.playbackSpeed = speed;
        },

        /**
         * 设置时间范围
         */
        setTimeRange(startMs: number, endMs: number) {
            this.rangeStartMs = startMs;
            this.rangeEndMs = endMs;
        },

        /**
         * 设置当前时间
         */
        setCurrentTime(timeMs: number) {
            this.currentTimeMs = timeMs;
            if (this.isLive) {
                this.isLive = false;
            }
        },

        /**
         * 设置房间标签
         */
        setRoomTags(tags: RoomTag[]) {
            this.roomTags = tags;
        },

        /**
         * 更新单个房间标签
         */
        updateRoomTag(code: string, updates: Partial<RoomTag>) {
            const tag = this.roomTags.find(t => t.code === code);
            if (tag) {
                Object.assign(tag, updates);
            }
        },

        /**
         * 设置图表数据
         */
        setChartData(data: TimeSeriesPoint[]) {
            this.chartData = data;
        },

        /**
         * 设置选中房间的时序数据
         */
        setSelectedRoomSeries(series: { code: string; name: string; data: TimeSeriesPoint[] }[]) {
            this.selectedRoomSeries = series;
        },

        /**
         * 切换热力图
         */
        toggleHeatmap() {
            this.isHeatmapEnabled = !this.isHeatmapEnabled;
        },

        /**
         * 设置 InfluxDB 配置
         */
        setInfluxConfig(config: IoTState['influxConfig']) {
            this.influxConfig = config;
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
