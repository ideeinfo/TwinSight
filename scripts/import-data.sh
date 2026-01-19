#!/bin/bash
# ========================================
# Twinsight 数据导入脚本
# ========================================
# 用途: 在 Ubuntu 服务器上导入迁移的数据
# 使用: chmod +x import-data.sh && ./import-data.sh /path/to/backup
# ========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROJECT_DIR="/opt/twinsight"
BACKUP_DIR="${1:-$PROJECT_DIR/backup}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Twinsight 数据导入脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查备份目录
check_backup() {
    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${RED}错误: 备份目录不存在: $BACKUP_DIR${NC}"
        echo "用法: $0 /path/to/backup"
        exit 1
    fi
    echo -e "${GREEN}备份目录: $BACKUP_DIR${NC}"
}

# 导入 PostgreSQL
import_postgres() {
    local SQL_FILE=$(find "$BACKUP_DIR" -name "postgres_twinsight.sql" -o -name "*postgres*.sql" | head -1)
    
    if [ -z "$SQL_FILE" ]; then
        echo -e "${YELLOW}[PostgreSQL] 未找到备份文件，跳过${NC}"
        return
    fi
    
    echo -e "${YELLOW}[PostgreSQL] 导入数据: $SQL_FILE${NC}"
    
    # 检查容器是否运行
    if ! docker ps | grep -q twinsight-postgres; then
        echo -e "${RED}错误: PostgreSQL 容器未运行${NC}"
        return 1
    fi
    
    # 导入数据
    docker exec -i twinsight-postgres psql -U postgres twinsight < "$SQL_FILE"
    
    echo -e "${GREEN}✓ PostgreSQL 数据导入成功${NC}"
}

# 导入 InfluxDB
import_influx() {
    local INFLUX_BACKUP=$(find "$BACKUP_DIR" -type d -name "influx_backup" | head -1)
    
    if [ -z "$INFLUX_BACKUP" ]; then
        echo -e "${YELLOW}[InfluxDB] 未找到备份文件，跳过${NC}"
        return
    fi
    
    echo -e "${YELLOW}[InfluxDB] 导入数据: $INFLUX_BACKUP${NC}"
    
    # 检查容器是否运行
    if ! docker ps | grep -q twinsight-influxdb; then
        echo -e "${RED}错误: InfluxDB 容器未运行${NC}"
        return 1
    fi
    
    # 获取 Token
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    
    if [ -z "$INFLUX_TOKEN" ]; then
        echo -e "${YELLOW}警告: INFLUX_TOKEN 未设置，尝试使用默认 Token${NC}"
        INFLUX_TOKEN="SsFt9slg5E2jS6HmvxuaePjebpkNVRi-S0wrDexjQWOFXDeARRY8NeJ-_Dqe6eAzsyuWtIVHFmSs3XMuv0x1ww=="
    fi
    
    # 复制到容器
    docker cp "$INFLUX_BACKUP" twinsight-influxdb:/tmp/influx_backup
    
    # 恢复数据
    docker exec twinsight-influxdb influx restore /tmp/influx_backup --token "$INFLUX_TOKEN" --full
    
    echo -e "${GREEN}✓ InfluxDB 数据导入成功${NC}"
}

# 显示 Node-RED 导入说明
show_nodered_instructions() {
    local FLOWS_FILE=$(find "$BACKUP_DIR" -name "*flows*.json" -o -name "nodered*.json" | head -1)
    
    echo -e "${YELLOW}[Node-RED] 手动导入说明${NC}"
    if [ -n "$FLOWS_FILE" ]; then
        echo "  找到流程文件: $FLOWS_FILE"
    fi
    echo "  1. 打开 http://$(hostname -I | awk '{print $1}'):1880"
    echo "  2. 右上角菜单 -> Import -> 选择文件"
    echo "  3. 点击 Deploy 生效"
}

# 显示 n8n 导入说明
show_n8n_instructions() {
    local WORKFLOW_FILES=$(find "$BACKUP_DIR" -name "*.json" | grep -v flows | grep -v postgres)
    
    echo -e "${YELLOW}[n8n] 手动导入说明${NC}"
    if [ -n "$WORKFLOW_FILES" ]; then
        echo "  找到工作流文件:"
        echo "$WORKFLOW_FILES" | while read f; do echo "    - $f"; done
    fi
    echo "  1. 打开 http://$(hostname -I | awk '{print $1}'):5678"
    echo "  2. 右上角 Import from File"
    echo "  3. 选择工作流 JSON 文件"
}

# 验证导入结果
verify_import() {
    echo -e "${YELLOW}验证导入结果...${NC}"
    
    # 检查 PostgreSQL 表
    echo -e "${BLUE}PostgreSQL 表统计:${NC}"
    docker exec twinsight-postgres psql -U postgres twinsight -c "\dt" 2>/dev/null || echo "  无法查询"
    
    # 检查 InfluxDB bucket
    echo -e "${BLUE}InfluxDB Bucket:${NC}"
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    docker exec twinsight-influxdb influx bucket list --token "${INFLUX_TOKEN:-}" 2>/dev/null || echo "  无法查询"
}

# 主函数
main() {
    check_backup
    
    echo ""
    import_postgres
    
    echo ""
    import_influx
    
    echo ""
    show_nodered_instructions
    
    echo ""
    show_n8n_instructions
    
    echo ""
    verify_import
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   数据导入完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
}

main
