/**
 * WebSocket 控制通道
 * 
 * 路径: /ws/control
 * 功能: AI Hub -> 前端的定向 UI 指令推送
 * 
 * 安全:
 * - 握手时校验 JWT
 * - 握手时校验 fileId 存在性（model_files 表）
 * - 连接后加入 rooms: user:{userId}, file:{fileId}, session:{socketId}
 * - 禁止全局广播 (io.emit)，仅允许 io.to(room).emit
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import modelFileModel from '../models/model-file.js';

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
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        const fileId = socket.handshake.auth?.fileId;

        if (!token) {
            // 开发模式下允许匿名连接
            if (config.server.env === 'development') {
                socket.user = { id: 0, username: 'dev-guest' };
                socket.fileId = fileId || 'dev-file';
                console.warn('⚠️  [ws-control] 开发模式：匿名连接已允许');
                return next();
            }
            return next(new Error('Authentication required: token missing'));
        }

        // JWT 校验
        let decoded;
        try {
            decoded = jwt.verify(token, config.jwt.secret);
        } catch (err) {
            return next(new Error(`Authentication failed: ${err.message}`));
        }

        // fileId 必须为正整数
        const parsedFileId = parseInt(fileId, 10);
        if (!fileId || !Number.isInteger(parsedFileId) || parsedFileId <= 0) {
            return next(new Error('Authentication failed: fileId must be a positive integer'));
        }

        // 校验 fileId 对应的模型文件是否存在
        try {
            const modelFile = await modelFileModel.getModelFileById(parsedFileId);
            if (!modelFile) {
                return next(new Error(`Authentication failed: fileId ${parsedFileId} not found`));
            }
        } catch (err) {
            console.error(`❌ [ws-control] fileId 校验失败:`, err.message);
            return next(new Error('Authentication failed: fileId validation error'));
        }

        socket.user = decoded;
        socket.fileId = parsedFileId;
        next();
    });

    // ========== 连接处理 ==========
    io.on('connection', (socket) => {
        // Access token uses `sub` as canonical user id; keep `id` as legacy fallback.
        const userId = socket.user?.sub ?? socket.user?.id ?? 'unknown';
        const fileId = socket.fileId || 'unknown';

        // 加入 rooms：只加入 user / session / file
        socket.join(`user:${userId}`);
        socket.join(`session:${socket.id}`);
        socket.join(`file:${fileId}`);

        console.log(
            `🔌 [ws-control] 连接建立` +
            ` | user=${userId}` +
            ` | file=${fileId}` +
            ` | session=${socket.id}` +
            ` | rooms=${Array.from(socket.rooms).join(',')}`
        );

        // 断开连接
        socket.on('disconnect', (reason) => {
            console.log(`🔌 [ws-control] 连接断开 | user=${userId} | file=${fileId} | reason=${reason}`);
        });
    });

    console.log('✅ [ws-control] WebSocket 控制通道已启动 (path: /ws/control)');
    return io;
}

export default initControlChannel;
