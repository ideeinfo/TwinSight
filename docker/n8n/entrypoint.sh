#!/bin/sh
# n8n Railway Volume 权限修复启动脚本

echo "🔧 n8n 启动脚本开始执行..."
echo "📍 当前用户: $(id)"
echo "📂 检查 /home/node/.n8n 目录..."

# 确保数据目录存在
mkdir -p /home/node/.n8n

# 检查当前用户
if [ "$(id -u)" = "0" ]; then
    echo "🔑 以 root 用户运行，修复权限..."
    
    # 设置正确的所有权
    chown -R node:node /home/node/.n8n
    chmod -R 755 /home/node/.n8n
    
    echo "✅ 权限修复完成"
    echo "🚀 使用 su-exec 切换到 node 用户启动 n8n..."
    
    # 使用 su-exec 切换用户（Alpine Linux 专用）
    exec su-exec node n8n start
else
    echo "👤 以非 root 用户运行，直接启动 n8n..."
    exec n8n start
fi
