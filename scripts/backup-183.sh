#!/bin/bash

# ==========================================
# 192.168.2.183 数据备份脚本
# 用于迁移前导出数据
# ==========================================

BACKUP_DIR=~/twinsight-backup
DATE=$(date +%Y%m%d%H%M)
FINAL_BACKUP_DIR=$BACKUP_DIR-$DATE

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 开始备份 192.168.2.183 数据...${NC}"
mkdir -p $FINAL_BACKUP_DIR

# 1. PostgreSQL
echo -e "\n📦 备份 PostgreSQL..."
docker exec twinsight-postgres pg_dump -U postgres -F c twinsight > $FINAL_BACKUP_DIR/postgres_twinsight.dump
if [ $? -eq 0 ]; then echo -e "${GREEN}✅ PostgreSQL 备份成功${NC}"; else echo -e "${RED}❌ PostgreSQL 备份失败${NC}"; fi

# 2. InfluxDB (需提供 Token)
echo -e "\n📦 备份 InfluxDB..."
read -p "请输入 InfluxDB Admin Token: " INFLUX_TOKEN
docker exec twinsight-influxdb influx backup /tmp/influx-backup --token $INFLUX_TOKEN
docker cp twinsight-influxdb:/tmp/influx-backup $FINAL_BACKUP_DIR/influx-backup
if [ $? -eq 0 ]; then echo -e "${GREEN}✅ InfluxDB 备份成功${NC}"; else echo -e "${RED}❌ InfluxDB 备份失败${NC}"; fi

# 3. n8n
echo -e "\n📦 备份 n8n..."
docker cp twinsight-n8n:/home/node/.n8n $FINAL_BACKUP_DIR/n8n-data
if [ $? -eq 0 ]; then echo -e "${GREEN}✅ n8n 备份成功${NC}"; else echo -e "${RED}❌ n8n 备份失败${NC}"; fi

# 4. Node-RED
echo -e "\n📦 备份 Node-RED..."
docker cp twinsight-nodered:/data $FINAL_BACKUP_DIR/nodered-data
if [ $? -eq 0 ]; then echo -e "${GREEN}✅ Node-RED 备份成功${NC}"; else echo -e "${RED}❌ Node-RED 备份失败${NC}"; fi

# 5. Open WebUI
echo -e "\n📦 备份 Open WebUI..."
docker cp twinsight-open-webui:/app/backend/data $FINAL_BACKUP_DIR/openwebui-data
if [ $? -eq 0 ]; then echo -e "${GREEN}✅ Open WebUI 备份成功${NC}"; else echo -e "${RED}❌ Open WebUI 备份失败${NC}"; fi

# 打包
echo -e "\n📦 压缩备份文件..."
cd $(dirname $FINAL_BACKUP_DIR)
tar -czf twinsight-backup-$DATE.tar.gz $(basename $FINAL_BACKUP_DIR)

echo -e "\n${GREEN}✅ 所有备份完成！${NC}"
echo "备份文件: $(pwd)/twinsight-backup-$DATE.tar.gz"
echo "请将其上传到阿里云服务器并解压恢复。"
