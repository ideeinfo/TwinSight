/**
 * 时间轴 Composable
 * 封装时间轴控制逻辑
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useIoTStore } from '@/stores/iot';

export interface TimeRange {
    startMs: number;
    endMs: number;
    windowMs: number;
}

export interface TimeOption {
    value: string;
    label: string;
    durationMs: number;
}

export function useTimeline() {
    const iotStore = useIoTStore();

    // ======== 本地状态 ========
    const isOpen = ref(false);
    const isPlaying = ref(false);
    const isLooping = ref(false);
    const playbackSpeed = ref(1);
    const progress = ref(0); // 0-100

    // 时间范围
    const rangeStartMs = ref(Date.now() - 24 * 60 * 60 * 1000); // 默认24小时前
    const rangeEndMs = ref(Date.now());
    const currentTimeMs = ref(Date.now());

    // 拖拽状态
    const isDragging = ref(false);
    const dragStartX = ref(0);
    const dragStartProgress = ref(0);

    // 时间选项
    const timeOptions: TimeOption[] = [
        { value: '1h', label: '1 小时', durationMs: 60 * 60 * 1000 },
        { value: '6h', label: '6 小时', durationMs: 6 * 60 * 60 * 1000 },
        { value: '12h', label: '12 小时', durationMs: 12 * 60 * 60 * 1000 },
        { value: '24h', label: '24 小时', durationMs: 24 * 60 * 60 * 1000 },
        { value: '7d', label: '7 天', durationMs: 7 * 24 * 60 * 60 * 1000 },
        { value: '30d', label: '30 天', durationMs: 30 * 24 * 60 * 60 * 1000 },
    ];

    const selectedTimeRange = ref('24h');
    const playIntervalId = ref<number | null>(null);

    // ======== 计算属性 ========

    const isLive = computed(() => {
        const tolerance = 60 * 1000; // 1分钟容差
        return Math.abs(currentTimeMs.value - Date.now()) < tolerance;
    });

    const rangeDurationMs = computed(() => rangeEndMs.value - rangeStartMs.value);

    const selectedTimeRangeLabel = computed(() => {
        const option = timeOptions.find(o => o.value === selectedTimeRange.value);
        return option?.label || selectedTimeRange.value;
    });

    const currentDateStr = computed(() => {
        const date = new Date(currentTimeMs.value);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    });

    const currentTimeStr = computed(() => {
        const date = new Date(currentTimeMs.value);
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    });

    // ======== 方法 ========

    /**
     * 打开时间轴
     */
    const openTimeline = () => {
        isOpen.value = true;
        iotStore.toggleTimeline(true);
    };

    /**
     * 关闭时间轴
     */
    const closeTimeline = () => {
        isOpen.value = false;
        stopPlayback();
        iotStore.toggleTimeline(false);
    };

    /**
     * 切换播放/暂停
     */
    const togglePlay = () => {
        if (isPlaying.value) {
            stopPlayback();
        } else {
            startPlayback();
        }
    };

    /**
     * 开始播放
     */
    const startPlayback = () => {
        if (isPlaying.value) return;

        isPlaying.value = true;
        iotStore.togglePlayback();

        playIntervalId.value = window.setInterval(() => {
            // 根据播放速度更新当前时间
            const step = 1000 * playbackSpeed.value; // 每秒推进的实际时间
            currentTimeMs.value += step;

            // 更新进度
            progress.value = ((currentTimeMs.value - rangeStartMs.value) / rangeDurationMs.value) * 100;

            // 检查是否到达结尾
            if (currentTimeMs.value >= rangeEndMs.value) {
                if (isLooping.value) {
                    // 循环播放
                    currentTimeMs.value = rangeStartMs.value;
                    progress.value = 0;
                } else {
                    // 停止播放
                    stopPlayback();
                }
            }

            // 同步到 store
            iotStore.setCurrentTime(currentTimeMs.value);
        }, 100); // 100ms 更新一次，使动画更流畅
    };

    /**
     * 停止播放
     */
    const stopPlayback = () => {
        if (playIntervalId.value) {
            clearInterval(playIntervalId.value);
            playIntervalId.value = null;
        }
        isPlaying.value = false;
        if (iotStore.isPlaying) {
            iotStore.togglePlayback();
        }
    };

    /**
     * 进入实时模式
     */
    const goLive = () => {
        stopPlayback();
        currentTimeMs.value = Date.now();
        rangeEndMs.value = Date.now();
        progress.value = 100;
        iotStore.goLive();
    };

    /**
     * 选择时间范围
     */
    const selectTimeRange = (option: TimeOption) => {
        selectedTimeRange.value = option.value;
        const now = Date.now();
        rangeEndMs.value = now;
        rangeStartMs.value = now - option.durationMs;

        // 如果当前时间超出范围，调整到范围内
        if (currentTimeMs.value < rangeStartMs.value || currentTimeMs.value > rangeEndMs.value) {
            currentTimeMs.value = rangeEndMs.value;
            progress.value = 100;
        } else {
            progress.value = ((currentTimeMs.value - rangeStartMs.value) / rangeDurationMs.value) * 100;
        }

        iotStore.setTimeRange(rangeStartMs.value, rangeEndMs.value);
    };

    /**
     * 设置自定义时间范围
     */
    const setCustomRange = (startMs: number, endMs: number) => {
        selectedTimeRange.value = 'custom';
        rangeStartMs.value = startMs;
        rangeEndMs.value = endMs;
        currentTimeMs.value = endMs;
        progress.value = 100;

        iotStore.setTimeRange(startMs, endMs);
    };

    /**
     * 切换播放速度
     */
    const cycleSpeed = () => {
        const speeds = [1, 2, 4, 8, 16];
        const currentIndex = speeds.indexOf(playbackSpeed.value);
        const nextIndex = (currentIndex + 1) % speeds.length;
        playbackSpeed.value = speeds[nextIndex];
        iotStore.setPlaybackSpeed(playbackSpeed.value);
    };

    /**
     * 缩放时间轴
     */
    const zoomIn = () => {
        const center = currentTimeMs.value;
        const halfDuration = rangeDurationMs.value / 4; // 缩小到一半
        rangeStartMs.value = center - halfDuration;
        rangeEndMs.value = center + halfDuration;
        progress.value = 50;

        iotStore.setTimeRange(rangeStartMs.value, rangeEndMs.value);
    };

    const zoomOut = () => {
        const center = currentTimeMs.value;
        const halfDuration = rangeDurationMs.value; // 扩大到两倍
        rangeStartMs.value = center - halfDuration;
        rangeEndMs.value = center + halfDuration;
        progress.value = 50;

        iotStore.setTimeRange(rangeStartMs.value, rangeEndMs.value);
    };

    /**
     * 平移时间轴
     */
    const panTimeline = (direction: number) => {
        const panAmount = rangeDurationMs.value * 0.25 * direction;
        rangeStartMs.value += panAmount;
        rangeEndMs.value += panAmount;

        iotStore.setTimeRange(rangeStartMs.value, rangeEndMs.value);
    };

    /**
     * 开始拖拽
     */
    const startDrag = (e: MouseEvent, trackWidth: number) => {
        isDragging.value = true;
        dragStartX.value = e.clientX;
        dragStartProgress.value = progress.value;

        const handleMove = (moveEvent: MouseEvent) => {
            if (!isDragging.value) return;

            const deltaX = moveEvent.clientX - dragStartX.value;
            const deltaPercent = (deltaX / trackWidth) * 100;
            const newProgress = Math.max(0, Math.min(100, dragStartProgress.value + deltaPercent));

            progress.value = newProgress;
            currentTimeMs.value = rangeStartMs.value + (rangeDurationMs.value * newProgress / 100);

            iotStore.setCurrentTime(currentTimeMs.value);
        };

        const handleUp = () => {
            isDragging.value = false;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    };

    /**
     * 跳转到指定进度
     */
    const seekTo = (percent: number) => {
        progress.value = Math.max(0, Math.min(100, percent));
        currentTimeMs.value = rangeStartMs.value + (rangeDurationMs.value * progress.value / 100);
        iotStore.setCurrentTime(currentTimeMs.value);
    };

    /**
     * 获取时间范围信息
     */
    const getTimeRange = (): TimeRange => {
        const durationMs = rangeDurationMs.value;

        // 根据时间范围计算合适的聚合窗口
        let windowMs: number;
        if (durationMs <= 60 * 60 * 1000) {
            windowMs = 60 * 1000; // 1小时内：1分钟
        } else if (durationMs <= 24 * 60 * 60 * 1000) {
            windowMs = 5 * 60 * 1000; // 24小时内：5分钟
        } else if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
            windowMs = 30 * 60 * 1000; // 7天内：30分钟
        } else {
            windowMs = 60 * 60 * 1000; // 超过7天：1小时
        }

        return {
            startMs: rangeStartMs.value,
            endMs: rangeEndMs.value,
            windowMs,
        };
    };

    // ======== 生命周期 ========

    onUnmounted(() => {
        stopPlayback();
    });

    return {
        // 状态
        isOpen,
        isPlaying,
        isLooping,
        isLive,
        isDragging,
        playbackSpeed,
        progress,
        rangeStartMs,
        rangeEndMs,
        currentTimeMs,
        selectedTimeRange,
        selectedTimeRangeLabel,
        currentDateStr,
        currentTimeStr,
        timeOptions,
        rangeDurationMs,

        // 方法
        openTimeline,
        closeTimeline,
        togglePlay,
        startPlayback,
        stopPlayback,
        goLive,
        selectTimeRange,
        setCustomRange,
        cycleSpeed,
        zoomIn,
        zoomOut,
        panTimeline,
        startDrag,
        seekTo,
        getTimeRange,
    };
}
