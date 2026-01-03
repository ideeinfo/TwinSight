#!/bin/sh
# n8n Railway Volume 权限修复启动脚本

# 以 root 运行时修复权限
if [ "$(id -u)" = "0" ]; then
    echo "🔧 修复 n8n 数据目录权限..."
    
    # 确保数据目录存在并设置正确权限
    mkdir -p /home/node/.n8n
    chown -R node:node /home/node/.n8n
    chmod -R 755 /home/node/.n8n
    
    echo "✅ 权限修复完成，切换到 node 用户启动 n8n..."
    
    # 使用 su 切换到 node 用户运行 n8n
    exec su node -c "n8n start"
else
    echo "⚠️ 以非 root 用户运行，直接启动 n8n..."
    exec n8n start
fi
