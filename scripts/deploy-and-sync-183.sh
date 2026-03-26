#!/usr/bin/env bash

# 总控脚本（192.168.2.183）：
# 1. 远端代码强制对齐 origin/main
# 2. 远端重建并启动容器服务
# 3. 远端启动前后端 Node 服务
# 4. 覆盖同步 public 目录

set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_SSH_HOST="${REMOTE_SSH_HOST:-192.168.2.183}"
REMOTE_SSH_PORT="${REMOTE_SSH_PORT:-22}"
REMOTE_SSH_USER="${REMOTE_SSH_USER:-root}"
REMOTE_SSH_PASSWORD="${REMOTE_SSH_PASSWORD:-}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/diwei/antigravity/TwinSight}"
REMOTE_COMPOSE_FILE="${REMOTE_COMPOSE_FILE:-docker-compose.yml}"
REMOTE_START_NODE_SERVICES="${REMOTE_START_NODE_SERVICES:-1}"
REMOTE_BACKEND_CMD="${REMOTE_BACKEND_CMD:-cd server && npm install && npm start}"
REMOTE_FRONTEND_CMD="${REMOTE_FRONTEND_CMD:-npm install && npm run build && npm run preview -- --host 0.0.0.0 --port 4173}"

ASSUME_YES=0

usage() {
  cat <<'EOF'
用法:
  ./scripts/deploy-and-sync-183.sh [选项]

选项:
  --yes         跳过确认
  -h, --help    显示帮助

关键环境变量:
  REMOTE_SSH_HOST       默认 192.168.2.183
  REMOTE_SSH_PORT       默认 22
  REMOTE_SSH_USER       默认 root
  REMOTE_SSH_PASSWORD   SSH 密码；有 sshpass 时可实现基本无交互
  REMOTE_APP_DIR        默认 /home/diwei/antigravity/TwinSight
  REMOTE_COMPOSE_FILE   默认 docker-compose.yml
  REMOTE_START_NODE_SERVICES  默认 1；1=启动前后端 Node 服务，0=跳过
  REMOTE_BACKEND_CMD    默认 cd server && npm install && npm start
  REMOTE_FRONTEND_CMD   默认 npm install && npm run build && npm run preview -- --host 0.0.0.0 --port 4173

说明:
  1. 远端代码更新使用 fetch + reset --hard origin/main，不用 git pull。
  2. 会自动检测 compose 是否存在 api 服务；有则只重建 api，没有则重建整套服务。
  3. compose 完成后，会在远端后台重启后端与前端（可通过 REMOTE_START_NODE_SERVICES=0 关闭）。
  4. 会完整覆盖远端 /home/diwei/antigravity/TwinSight/public。
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
  2. 远端重建并启动容器服务
  3. 远端后台重启后端与前端 Node 服务
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
  [[ -x "$ROOT_DIR/scripts/sync-public-to-demo.sh" ]] || die "缺少脚本: scripts/sync-public-to-demo.sh"

  setup_ssh
  confirm_run
}

deploy_remote_api() {
  local q_remote_dir q_compose_file
  q_remote_dir="$(quote "$REMOTE_APP_DIR")"
  q_compose_file="$(quote "$REMOTE_COMPOSE_FILE")"

  log "远端同步代码并重建服务..."
  remote_exec "
    cd $q_remote_dir &&
    git fetch origin &&
    git reset --hard origin/main &&
    if docker compose --env-file .env -f $q_compose_file config --services | grep -qx 'api'; then
      docker compose --env-file .env -f $q_compose_file up -d --build api
    else
      docker compose --env-file .env -f $q_compose_file up -d --build
    fi
  "
  success "远端服务部署完成"
}

start_remote_node_services() {
  if [[ "$REMOTE_START_NODE_SERVICES" != "1" ]]; then
    warn "已按配置跳过前后端 Node 服务启动 (REMOTE_START_NODE_SERVICES=${REMOTE_START_NODE_SERVICES})"
    return
  fi

  local q_remote_dir q_backend_cmd q_frontend_cmd
  q_remote_dir="$(quote "$REMOTE_APP_DIR")"
  q_backend_cmd="$(quote "$REMOTE_BACKEND_CMD")"
  q_frontend_cmd="$(quote "$REMOTE_FRONTEND_CMD")"

  log "远端启动后端与前端 Node 服务..."
  remote_exec "
    set -e
    cd $q_remote_dir

    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
      echo 'WARN: 远端未检测到 node/npm，跳过前后端 Node 服务启动'
      exit 0
    fi

    mkdir -p .deploy-pids
    BACKEND_CMD=$q_backend_cmd
    FRONTEND_CMD=$q_frontend_cmd

    restart_managed_proc() {
      local name=\"\$1\"
      local run_cmd=\"\$2\"
      local pid_file=\".deploy-pids/\${name}.pid\"
      local log_file=\".deploy-pids/\${name}.log\"

      if [[ -f \"\$pid_file\" ]]; then
        local old_pid
        old_pid=\"\$(cat \"\$pid_file\" 2>/dev/null || true)\"
        if [[ -n \"\$old_pid\" ]] && kill -0 \"\$old_pid\" 2>/dev/null; then
          kill \"\$old_pid\" 2>/dev/null || true
          sleep 1
          kill -9 \"\$old_pid\" 2>/dev/null || true
        fi
      fi

      nohup bash -lc \"cd $q_remote_dir && \$run_cmd\" > \"\$log_file\" 2>&1 &
      echo \$! > \"\$pid_file\"
      echo \"OK: \${name} started, pid=\$(cat \"\$pid_file\"), log=\$log_file\"
    }

    restart_managed_proc backend \"\$BACKEND_CMD\"
    restart_managed_proc frontend \"\$FRONTEND_CMD\"
  "

  success "远端前后端 Node 服务已启动"
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
  start_remote_node_services
  sync_public
  success "192.168.2.183 总脚本执行完成"
}

main "$@"
