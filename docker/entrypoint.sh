#!/bin/sh
# Tandem Demo 容器启动入口脚本
# 
# 功能：
# 1. 等待数据库服务就绪
# 2. 执行数据库初始化（如需要）
# 3. 启动 Node.js 应用

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║     Tandem Demo - 容器启动                     ║"
echo "╚════════════════════════════════════════════════╝"

# 等待数据库就绪（如果配置了 DATABASE_URL 或 DB_HOST）
if [ -n "$DATABASE_URL" ] || [ -n "$DB_HOST" ]; then
    echo "⏳ 正在检查数据库连接..."
    
    # 使用 Node.js 执行数据库初始化脚本
    node scripts/post-deploy.js
    
    if [ $? -ne 0 ]; then
        echo "❌ 数据库初始化失败"
        exit 1
    fi
else
    echo "⚠️ 未配置数据库连接，跳过初始化"
fi

echo ""
echo "🚀 启动应用服务..."
echo ""

# 启动 Node.js 应用
exec node index.js
