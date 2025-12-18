#!/bin/bash

echo "========================================"
echo "   Tandem Server 一键启动脚本"
echo "========================================"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[信息] Node.js 版本:"
node --version
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "[信息] 首次运行，正在安装依赖包..."
    echo "[信息] 这可能需要几分钟，请稍候..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败，请检查网络连接"
        exit 1
    fi
    echo ""
    echo "[成功] 依赖安装完成！"
    echo ""
else
    echo "[信息] 依赖包已安装"
    echo ""
fi

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
    echo "[警告] 未找到 .env 配置文件"
    echo "[提示] 请根据 README.md 创建 .env 文件并配置数据库连接"
    echo ""
fi

echo "[信息] 正在启动服务器..."
echo "[提示] 按 Ctrl+C 可停止服务器"
echo "========================================"
echo ""

npm start
