#!/bin/bash

# TwinSight Cloud Tunnel Connection Script
# 
# 功能：建立 SSH 隧道，将本地端口转发到阿里云服务器的 localhost 端口
# 用途：让本地开发代码（backend/frontend）能直接连接云端数据库和非公开服务
#
# 前提：
# 1. 确保你有 SSH 访问权限 (root@demo.twinsight.cn)
# 3. 确保本地 /etc/hosts 已配置映射：
#    echo "127.0.0.1 postgres influxdb open-webui n8n logic-engine nodered" | sudo tee -a /etc/hosts

REMOTE_HOST="root@demo.twinsight.cn"

echo "正在建立与阿里云 ($REMOTE_HOST) 的安全隧道..."
echo "映射关系："
echo "  - Postgres:    localhost:5432 -> remote:5432"
echo "  - InfluxDB:    localhost:8086 -> remote:8086"
echo "  - LogicEngine: localhost:8000 -> remote:8000"
echo "  - Open WebUI:  localhost:8080 -> remote:3080 (注意本地是8080)"
echo "  - n8n:         localhost:5678 -> remote:5678"
echo "  - Node-RED:    localhost:1880 -> remote:1880"

# -N: 不执行远程命令（仅转发）
# -L: 本地端口:远程地址:远程端口
ssh -N \
  -L 5432:127.0.0.1:5432 \
  -L 8086:127.0.0.1:8086 \
  -L 8000:127.0.0.1:8000 \
  -L 8080:127.0.0.1:3080 \
  -L 5678:127.0.0.1:5678 \
  -L 1880:127.0.0.1:1880 \
  $REMOTE_HOST

