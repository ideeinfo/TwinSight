#!/bin/bash
# ========================================
# Twinsight Ubuntu 服务器部署脚本
# ========================================
# 用途: 在 Ubuntu 24.04 服务器上部署 Twinsight Docker 服务
# 使用: chmod +x deploy-lan.sh && ./deploy-lan.sh
# ========================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_DIR="/opt/twinsight"
COMPOSE_FILE="docker-compose.yml"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Twinsight 局域网部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查是否以 root 或 sudo 运行
check_permissions() {
    if [ "$EUID" -ne 0 ] && ! groups | grep -q docker; then
        echo -e "${RED}错误: 请使用 sudo 运行此脚本，或确保当前用户在 docker 组中${NC}"
        exit 1
    fi
}

# 检查 Docker 是否已安装
check_docker() {
    echo -e "${YELLOW}[1/6] 检查 Docker 环境...${NC}"
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker 未安装。正在安装...${NC}"
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        echo -e "${GREEN}Docker 安装完成。请重新登录以使 docker 组生效。${NC}"
        exit 0
    fi
    
    if ! command -v docker compose &> /dev/null; then
        echo -e "${RED}Docker Compose 插件未安装${NC}"
        sudo apt-get update
        sudo apt-get install -y docker-compose-plugin
    fi
    
    echo -e "${GREEN}✓ Docker $(docker --version | cut -d' ' -f3)${NC}"
    echo -e "${GREEN}✓ Docker Compose $(docker compose version --short)${NC}"
}

# 创建项目目录
setup_directories() {
    echo -e "${YELLOW}[2/6] 设置项目目录...${NC}"
    
    if [ ! -d "$PROJECT_DIR" ]; then
        sudo mkdir -p "$PROJECT_DIR"
        sudo chown $USER:$USER "$PROJECT_DIR"
    fi
    
    # 创建备份目录
    mkdir -p "$PROJECT_DIR/backup"
    
    echo -e "${GREEN}✓ 项目目录: $PROJECT_DIR${NC}"
}

# 检查配置文件
check_config() {
    echo -e "${YELLOW}[3/6] 检查配置文件...${NC}"
    
    if [ ! -f "$PROJECT_DIR/$COMPOSE_FILE" ]; then
        echo -e "${RED}错误: 未找到 $PROJECT_DIR/$COMPOSE_FILE${NC}"
        echo -e "${YELLOW}请先上传配置文件:${NC}"
        echo "  scp docker/docker-compose.lan.yml user@192.168.2.183:$PROJECT_DIR/docker-compose.yml"
        echo "  scp docker/.env.lan.example user@192.168.2.183:$PROJECT_DIR/.env"
        exit 1
    fi
    
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        if [ -f "$PROJECT_DIR/.env.example" ]; then
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            echo -e "${YELLOW}已从 .env.example 创建 .env 文件，请编辑配置${NC}"
        else
            echo -e "${RED}错误: 未找到 .env 文件${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✓ 配置文件就绪${NC}"
}

# 拉取镜像
pull_images() {
    echo -e "${YELLOW}[4/6] 拉取 Docker 镜像...${NC}"
    cd "$PROJECT_DIR"
    docker compose pull
    echo -e "${GREEN}✓ 镜像拉取完成${NC}"
}

# 启动服务
start_services() {
    echo -e "${YELLOW}[5/6] 启动服务...${NC}"
    cd "$PROJECT_DIR"
    docker compose up -d
    echo -e "${GREEN}✓ 服务已启动${NC}"
}

# 验证服务状态
verify_services() {
    echo -e "${YELLOW}[6/6] 验证服务状态...${NC}"
    cd "$PROJECT_DIR"
    
    echo ""
    docker compose ps
    echo ""
    
    # 等待服务启动
    echo -e "${YELLOW}等待服务完全启动 (30秒)...${NC}"
    sleep 30
    
    # 获取服务器 IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   部署完成！服务访问地址:${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  PostgreSQL:  ${BLUE}$SERVER_IP:5432${NC}"
    echo -e "  InfluxDB:    ${BLUE}http://$SERVER_IP:8086${NC}"
    echo -e "  Node-RED:    ${BLUE}http://$SERVER_IP:1880${NC}"
    echo -e "  n8n:         ${BLUE}http://$SERVER_IP:5678${NC}"
    echo -e "  Open WebUI:  ${BLUE}http://$SERVER_IP:3080${NC}"
    echo ""
    echo -e "${YELLOW}下一步:${NC}"
    echo "  1. 导入数据 (如有备份)"
    echo "  2. 配置本地开发环境连接到此服务器"
    echo ""
}

# 显示帮助
show_help() {
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  deploy    完整部署 (默认)"
    echo "  start     启动服务"
    echo "  stop      停止服务"
    echo "  restart   重启服务"
    echo "  status    查看服务状态"
    echo "  logs      查看日志"
    echo "  backup    备份数据"
    echo "  help      显示帮助"
}

# 停止服务
stop_services() {
    echo -e "${YELLOW}停止服务...${NC}"
    cd "$PROJECT_DIR"
    docker compose down
    echo -e "${GREEN}✓ 服务已停止${NC}"
}

# 重启服务
restart_services() {
    echo -e "${YELLOW}重启服务...${NC}"
    cd "$PROJECT_DIR"
    docker compose restart
    echo -e "${GREEN}✓ 服务已重启${NC}"
}

# 查看状态
show_status() {
    cd "$PROJECT_DIR"
    docker compose ps
}

# 查看日志
show_logs() {
    cd "$PROJECT_DIR"
    docker compose logs -f --tail=100
}

# 备份数据
backup_data() {
    echo -e "${YELLOW}开始备份数据...${NC}"
    BACKUP_DIR="$PROJECT_DIR/backup/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # 备份 PostgreSQL
    echo -e "${YELLOW}备份 PostgreSQL...${NC}"
    docker exec twinsight-postgres pg_dump -U postgres twinsight > "$BACKUP_DIR/postgres_backup.sql"
    
    # 备份 InfluxDB
    echo -e "${YELLOW}备份 InfluxDB...${NC}"
    docker exec twinsight-influxdb influx backup /tmp/influx_backup --token "$INFLUX_TOKEN" 2>/dev/null || true
    docker cp twinsight-influxdb:/tmp/influx_backup "$BACKUP_DIR/influx_backup" 2>/dev/null || echo "InfluxDB 备份跳过"
    
    echo -e "${GREEN}✓ 备份完成: $BACKUP_DIR${NC}"
}

# 主函数
main() {
    case "${1:-deploy}" in
        deploy)
            check_permissions
            check_docker
            setup_directories
            check_config
            pull_images
            start_services
            verify_services
            ;;
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        backup)
            backup_data
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}未知命令: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
