/**
 * WebSocket 控制通道 Composable
 * 
 * 连接到 /ws/control 并监听 AI Hub 的 UI 控制指令。
 * 
 * 用法：
 *   import { useControlChannel } from '@/composables/useControlChannel';
 *   const { isConnected, lastCommand, connect, disconnect } = useControlChannel();
 */

import { ref, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';

// 单例状态（跨组件共享）
const isConnected = ref(false);
const lastCommand = ref(null);
const connectionError = ref(null);
const currentFileId = ref(null);

let socket = null;
let reconnectTimer = null;

/**
 * 连接到 WebSocket 控制通道
 * @param {Object} options
 * @param {Function} options.onCommand - 收到指令时的回调
 */
export function useControlChannel(options = {}) {
    const authStore = useAuthStore();

    /**
     * 建立 WebSocket 连接
     * @param {number} fileId - 当前文件 ID（必填）
     */
    const connect = async (fileId) => {
        if (!fileId) {
            console.warn('[control-channel] fileId 未提供，跳过连接');
            return;
        }

        // 避免重复连接到同一个 fileId
        if (socket && isConnected.value && currentFileId.value === fileId) {
            return;
        }

        // 如果已有连接但 fileId 不同，先断开
        if (socket && isConnected.value) {
            disconnect();
        }

        // 动态导入 socket.io-client（仅在需要时加载）
        let io;
        try {
            const socketIoClient = await import('socket.io-client');
            io = socketIoClient.io || socketIoClient.default;
        } catch (err) {
            console.warn('[control-channel] socket.io-client 未安装，控制通道不可用');
            connectionError.value = 'socket.io-client not installed';
            return;
        }

        const token = authStore.token || localStorage.getItem('accessToken');
        if (!token) {
            console.warn('[control-channel] 未找到认证令牌，跳过连接');
            connectionError.value = 'No auth token';
            return;
        }

        // 连接到 WebSocket 服务器
        const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
        socket = io(baseUrl, {
            path: '/ws/control',
            auth: {
                token,
                fileId
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 3000
        });

        // 连接成功
        socket.on('connect', () => {
            isConnected.value = true;
            connectionError.value = null;
            currentFileId.value = fileId;
            console.log(`🔌 [control-channel] 已连接 | file=${fileId} | session=${socket.id}`);
        });

        // 断开连接
        socket.on('disconnect', (reason) => {
            isConnected.value = false;
            console.log(`🔌 [control-channel] 已断开 | reason=${reason}`);
        });

        // 连接错误
        socket.on('connect_error', (err) => {
            isConnected.value = false;
            connectionError.value = err.message;
            console.error('[control-channel] 连接错误:', err.message);
        });

        // ========== 监听 UI 控制指令 ==========
        socket.on('ui:command', (command) => {
            console.log('🎮 [control-channel] 收到指令:', command);
            lastCommand.value = command;

            // 如果提供了回调，则执行
            if (options.onCommand && typeof options.onCommand === 'function') {
                options.onCommand(command);
            }
        });
    };

    const disconnect = () => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        isConnected.value = false;
        currentFileId.value = null;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    /**
     * 切换到新的文件房间（断开旧连接，建立新连接）
     * @param {number} newFileId - 新的文件 ID
     */
    const switchFile = async (newFileId) => {
        if (!newFileId) {
            console.warn('[control-channel] switchFile: newFileId 不能为空');
            return;
        }
        if (currentFileId.value === newFileId) {
            return;
        }
        disconnect();
        await connect(newFileId);
    };

    // 组件卸载时不断开（单例模式，保持全局连接）
    // 如果需要在特定组件销毁时断开，可调用 disconnect()

    return {
        isConnected,
        lastCommand,
        connectionError,
        currentFileId,
        connect,
        disconnect,
        switchFile
    };
}

export default useControlChannel;
