/**
 * WebSocket 控制通道
 * 
 * 路径: /ws/control
 * 功能: AI Hub -> 前端的定向 UI 指令推送
 * 
 * 安全:
 * - 握手时校验 JWT
 * - 连接后加入 rooms: user:{userId}, project:{projectId}, session:{socketId}
 * - 禁止全局广播 (io.emit)，仅允许 io.to(room).emit
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * 初始化 WebSocket 控制通道
 * @param {import('http').Server} httpServer - HTTP 服务器实例
 * @returns {import('socket.io').Server} io 实例
 */
export async function initControlChannel(httpServer) {
    // 动态导入 socket.io（避免在未安装时导致启动失败）
    let Server;
    try {
        const socketIo = await import('socket.io');
        Server = socketIo.Server;
    } catch (err) {
        console.warn('⚠️  [ws-control] socket.io 未安装，WebSocket 控制通道未启用。');
        console.warn('    运行 npm install socket.io 以启用控制通道。');
        return null;
    }

    const io = new Server(httpServer, {
        path: '/ws/control',
        cors: {
            origin: '*', // 生产环境应限制为具体域名
            methods: ['GET', 'POST']
        },
        // 连接超时设置
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // ========== 握手鉴权 ==========
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        const projectId = socket.handshake.auth?.projectId;

        if (!token) {
            // 开发模式下允许匿名连接
            if (config.server.env === 'development') {
                socket.user = { id: 0, username: 'dev-guest' };
                socket.projectId = projectId || 'dev-project';
                console.warn('⚠️  [ws-control] 开发模式：匿名连接已允许');
                return next();
            }
            return next(new Error('Authentication required: token missing'));
        }

        try {
            const decoded = jwt.verify(token, config.jwt.secret);
            socket.user = decoded;
            socket.projectId = projectId;
            next();
        } catch (err) {
            next(new Error(`Authentication failed: ${err.message}`));
        }
    });

    // ========== 连接处理 ==========
    io.on('connection', (socket) => {
        const userId = socket.user?.id || 'unknown';
        const projectId = socket.projectId || 'unknown';

        // 加入 rooms
        socket.join(`user:${userId}`);
        socket.join(`session:${socket.id}`);
        if (projectId) {
            socket.join(`project:${projectId}`);
        }

        console.log(
            `🔌 [ws-control] 连接建立` +
            ` | user=${userId}` +
            ` | project=${projectId}` +
            ` | session=${socket.id}` +
            ` | rooms=${Array.from(socket.rooms).join(',')}`
        );

        // 允许客户端切换项目 room
        socket.on('join:project', (newProjectId) => {
            // 先离开旧项目 room
            if (socket.projectId) {
                socket.leave(`project:${socket.projectId}`);
            }
            socket.projectId = newProjectId;
            socket.join(`project:${newProjectId}`);
            console.log(`🔄 [ws-control] user=${userId} 切换到项目 ${newProjectId}`);
        });

        // 断开连接
        socket.on('disconnect', (reason) => {
            console.log(`🔌 [ws-control] 连接断开 | user=${userId} | reason=${reason}`);
        });
    });

    console.log('✅ [ws-control] WebSocket 控制通道已启动 (path: /ws/control)');
    return io;
}

export default initControlChannel;
