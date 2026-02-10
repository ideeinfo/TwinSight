#!/bin/bash

# ==========================================
# 阿里云快速部署脚本 (本地开发用)
# 前提：已配置 SSH 免密登录
# ==========================================

REMOTE_HOST="root@demo.twinsight.cn"
REMOTE_DIR="/data/twinsight"

echo "🚀 开始部署到阿里云..."

# 1. 检查 SSH 连接
ssh -q -o BatchMode=yes -o ConnectTimeout=5 $REMOTE_HOST exit
if [ $? -ne 0 ]; then
    echo "❌ 无法连接到服务器 ($REMOTE_HOST)，请检查网络或 SSH 配置"
    exit 1
fi

# 2. 远程执行更新
ssh $REMOTE_HOST "bash -s" <<EOF
    cd $REMOTE_DIR || exit 1
    
    echo "📥 拉取最新代码..."
    git pull origin main || exit 1
    
    echo "🏗️ 构建镜像..."
    docker compose build api logic-engine
    
    echo "🚀 重启服务..."
    docker compose up -d api logic-engine
    
    echo "✅ 部署完成！"
    docker compose ps
EOF
