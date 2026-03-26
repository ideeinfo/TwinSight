#!/usr/bin/env bash

# 总控脚本：
# 1. 远端代码强制对齐 origin/main
# 2. 远端重建并启动 api
# 3. 覆盖同步 PostgreSQL 数据
# 4. 覆盖同步 public 目录

set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_SSH_HOST="${REMOTE_SSH_HOST:-demo.twinsight.cn}"
REMOTE_SSH_PORT="${REMOTE_SSH_PORT:-22}"
REMOTE_SSH_USER="${REMOTE_SSH_USER:-root}"
REMOTE_SSH_PASSWORD="${REMOTE_SSH_PASSWORD:-}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/data/twinsight}"
REMOTE_API_CONTAINER="${REMOTE_API_CONTAINER:-twinsight-api}"

SOURCE_DB_PASSWORD="${SOURCE_DB_PASSWORD:-}"
REMOTE_DB_PASSWORD="${REMOTE_DB_PASSWORD:-}"
REMOTE_DB_USER="${REMOTE_DB_USER:-postgres}"
REMOTE_DB_NAME="${REMOTE_DB_NAME:-twinsight}"
REMOTE_DB_CONTAINER="${REMOTE_DB_CONTAINER:-twinsight-postgres}"

ASSUME_YES=0
SKIP_DB_BACKUP=0
SKIP_CONFIG_CHECK=0

usage() {
  cat <<'EOF'
用法:
  ./scripts/deploy-and-sync-demo.sh [选项]

选项:
  --yes             跳过确认
  --skip-db-backup  跳过数据库覆盖前的远端备份
  --skip-config-check 跳过同步后的远端配置健康校验
  -h, --help        显示帮助

关键环境变量:
  REMOTE_SSH_HOST       默认 demo.twinsight.cn
  REMOTE_SSH_PORT       默认 22
  REMOTE_SSH_USER       默认 root
  REMOTE_SSH_PASSWORD   SSH 密码；有 sshpass 时可实现基本无交互
  REMOTE_APP_DIR        默认 /data/twinsight
  REMOTE_API_CONTAINER  默认 twinsight-api

  SOURCE_DB_PASSWORD    源库密码
  REMOTE_DB_PASSWORD    远端库密码
  REMOTE_DB_USER        默认 postgres
  REMOTE_DB_NAME        默认 twinsight
  REMOTE_DB_CONTAINER   默认 twinsight-postgres

说明:
  1. 远端代码更新使用 fetch + reset --hard origin/main，不用 git pull。
  2. 数据库同步会完整覆盖远端 twinsight 数据库。
  3. public 同步会完整覆盖远端 /data/twinsight/public。
  4. 不会把密码写进仓库，请在执行前 export 环境变量。
EOF
}

log() {
  printf "%b%s%b\n" "$BLUE" "$*" "$NC"
}

success() {
  printf "%b%s%b\n" "$GREEN" "$*" "$NC"
}

warn() {
  printf "%b%s%b\n" "$YELLOW" "$*" "$NC"
}

die() {
  printf "%b错误:%b %s\n" "$RED" "$NC" "$*" >&2
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

quote() {
  printf '%q' "$1"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --yes)
        ASSUME_YES=1
        ;;
      --skip-db-backup)
        SKIP_DB_BACKUP=1
        ;;
      --skip-config-check)
        SKIP_CONFIG_CHECK=1
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "未知参数: $1"
        ;;
    esac
    shift
  done
}

setup_ssh() {
  SSH_BASE=(ssh -p "$REMOTE_SSH_PORT" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
  REMOTE_TARGET="${REMOTE_SSH_USER}@${REMOTE_SSH_HOST}"

  if [[ -n "$REMOTE_SSH_PASSWORD" ]]; then
    if has_cmd sshpass; then
      export SSHPASS="$REMOTE_SSH_PASSWORD"
      SSH_BASE=(sshpass -e "${SSH_BASE[@]}")
    else
      warn "未检测到 sshpass，将改用普通 ssh，过程中可能需要手动输入 SSH 密码"
    fi
  fi
}

remote_exec() {
  local cmd="$1"
  "${SSH_BASE[@]}" "$REMOTE_TARGET" "bash -lc $(quote "$cmd")"
}

confirm_run() {
  if [[ "$ASSUME_YES" -eq 1 ]]; then
    return
  fi

  cat <<EOF

即将执行以下操作:
  1. 远端强制对齐 GitHub main
  2. 远端重建并启动 api 容器
  3. 覆盖同步数据库到远端 PostgreSQL
  4. 覆盖同步本地 public 到远端 public

目标主机:
  ${REMOTE_SSH_USER}@${REMOTE_SSH_HOST}:${REMOTE_SSH_PORT}

目标目录:
  ${REMOTE_APP_DIR}
EOF

  printf '\n继续请输入 yes: '
  local answer
  read -r answer
  [[ "$answer" == "yes" ]] || die "已取消执行"
}

prepare() {
  parse_args "$@"

  [[ -x "$ROOT_DIR/scripts/sync-postgres-183-to-demo.sh" ]] || die "缺少脚本: scripts/sync-postgres-183-to-demo.sh"
  [[ -x "$ROOT_DIR/scripts/sync-public-to-demo.sh" ]] || die "缺少脚本: scripts/sync-public-to-demo.sh"
  [[ -n "$SOURCE_DB_PASSWORD" ]] || die "请先 export SOURCE_DB_PASSWORD"
  [[ -n "$REMOTE_DB_PASSWORD" ]] || die "请先 export REMOTE_DB_PASSWORD"

  setup_ssh
  confirm_run
}

deploy_remote_api() {
  local q_remote_dir
  q_remote_dir="$(quote "$REMOTE_APP_DIR")"

  log "远端同步代码并重建 api..."
  remote_exec "cd $q_remote_dir && git fetch origin && git reset --hard origin/main && docker compose --env-file .env -f docker/docker-compose.cloud.yml up -d --build api"
  success "远端 api 部署完成"
}

sync_database() {
  log "开始覆盖同步远端 PostgreSQL..."

  local cmd=( "$ROOT_DIR/scripts/sync-postgres-183-to-demo.sh" --yes --remote-container "$REMOTE_DB_CONTAINER" )
  if [[ "$SKIP_DB_BACKUP" -eq 1 ]]; then
    cmd+=( --skip-remote-backup )
  fi

  REMOTE_SSH_HOST="$REMOTE_SSH_HOST" \
  REMOTE_SSH_PORT="$REMOTE_SSH_PORT" \
  REMOTE_SSH_USER="$REMOTE_SSH_USER" \
  REMOTE_SSH_PASSWORD="$REMOTE_SSH_PASSWORD" \
  SOURCE_DB_PASSWORD="$SOURCE_DB_PASSWORD" \
  REMOTE_DB_PASSWORD="$REMOTE_DB_PASSWORD" \
  REMOTE_DB_USER="$REMOTE_DB_USER" \
  REMOTE_DB_NAME="$REMOTE_DB_NAME" \
  "${cmd[@]}"

  success "数据库同步完成"
}

check_remote_config_health() {
  local q_db_password q_db_user q_db_name q_db_container q_api_container
  local mismatch_count bad_influx_count

  if [[ "$SKIP_CONFIG_CHECK" -eq 1 ]]; then
    warn "已跳过远端配置健康校验"
    return
  fi

  q_db_password="$(quote "$REMOTE_DB_PASSWORD")"
  q_db_user="$(quote "$REMOTE_DB_USER")"
  q_db_name="$(quote "$REMOTE_DB_NAME")"
  q_db_container="$(quote "$REMOTE_DB_CONTAINER")"
  q_api_container="$(quote "$REMOTE_API_CONTAINER")"

  log "校验远端系统配置 URL..."
  mismatch_count="$(
    remote_exec "docker exec -e PGPASSWORD=$q_db_password $q_db_container psql -At -U $q_db_user -d $q_db_name -c \"SELECT count(*) FROM system_config WHERE (config_key='INFLUXDB_URL' AND config_value <> 'http://influxdb:8086') OR (config_key='OPENWEBUI_URL' AND config_value <> 'http://open-webui:8080') OR (config_key='N8N_WEBHOOK_URL' AND config_value <> 'http://n8n:5678');\""
  )"
  mismatch_count="$(printf '%s' "$mismatch_count" | tr -d '[:space:]')"
  [[ "$mismatch_count" =~ ^[0-9]+$ ]] || die "无法解析 system_config 校验结果: $mismatch_count"
  if [[ "$mismatch_count" -ne 0 ]]; then
    die "system_config URL 校验失败，存在 $mismatch_count 条不符合容器内地址的记录"
  fi

  log "校验远端 influx_configs URL..."
  bad_influx_count="$(
    remote_exec "docker exec -e PGPASSWORD=$q_db_password $q_db_container psql -At -U $q_db_user -d $q_db_name -c \"SELECT count(*) FROM influx_configs WHERE influx_url IS NULL OR influx_url ~* '^(https?://)?localhost(:[0-9]+)?/?$' OR influx_url ~* '^(https?://)?127\\\\.0\\\\.0\\\\.1(:[0-9]+)?/?$' OR influx_url ~* '^(https?://)?192\\\\.168\\\\.[0-9]+\\\\.[0-9]+(:[0-9]+)?/?$' OR influx_url ~* '^(https?://)?10\\\\.[0-9]+\\\\.[0-9]+\\\\.[0-9]+(:[0-9]+)?/?$' OR influx_url ~* '^(https?://)?172\\\\.(1[6-9]|2[0-9]|3[0-1])\\\\.[0-9]+\\\\.[0-9]+(:[0-9]+)?/?$';\""
  )"
  bad_influx_count="$(printf '%s' "$bad_influx_count" | tr -d '[:space:]')"
  [[ "$bad_influx_count" =~ ^[0-9]+$ ]] || die "无法解析 influx_configs 校验结果: $bad_influx_count"
  if [[ "$bad_influx_count" -ne 0 ]]; then
    die "influx_configs URL 校验失败，存在 $bad_influx_count 条仍指向 localhost/私网 IP 的记录"
  fi

  log "校验 api 容器内服务联通性..."
  remote_exec "docker exec $q_api_container sh -lc \"wget -qO- -T 5 http://influxdb:8086/health >/dev/null\""
  remote_exec "docker exec $q_api_container sh -lc \"wget -qO- -T 5 http://open-webui:8080/health >/dev/null\""
  success "远端配置健康校验通过"
}

sync_public() {
  log "开始覆盖同步 public 目录..."

  REMOTE_SSH_HOST="$REMOTE_SSH_HOST" \
  REMOTE_SSH_PORT="$REMOTE_SSH_PORT" \
  REMOTE_SSH_USER="$REMOTE_SSH_USER" \
  REMOTE_SSH_PASSWORD="$REMOTE_SSH_PASSWORD" \
  REMOTE_APP_DIR="$REMOTE_APP_DIR" \
  "$ROOT_DIR/scripts/sync-public-to-demo.sh" --yes

  success "public 同步完成"
}

main() {
  prepare "$@"
  deploy_remote_api
  sync_database
  check_remote_config_health
  sync_public
  success "总脚本执行完成"
}

main "$@"
