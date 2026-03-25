#!/usr/bin/env bash

# 将 192.168.2.183 上的 twinsight PostgreSQL 数据完整覆盖到远端 Docker PostgreSQL。
# 密码不写入仓库，优先从环境变量读取；未提供时会交互输入。

set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SOURCE_DB_HOST="${SOURCE_DB_HOST:-192.168.2.183}"
SOURCE_DB_PORT="${SOURCE_DB_PORT:-5432}"
SOURCE_DB_NAME="${SOURCE_DB_NAME:-twinsight}"
SOURCE_DB_USER="${SOURCE_DB_USER:-postgres}"
SOURCE_DB_PASSWORD="${SOURCE_DB_PASSWORD:-}"

REMOTE_SSH_HOST="${REMOTE_SSH_HOST:-demo.twinsight.cn}"
REMOTE_SSH_PORT="${REMOTE_SSH_PORT:-22}"
REMOTE_SSH_USER="${REMOTE_SSH_USER:-root}"
REMOTE_SSH_PASSWORD="${REMOTE_SSH_PASSWORD:-}"

REMOTE_DB_NAME="${REMOTE_DB_NAME:-twinsight}"
REMOTE_DB_USER="${REMOTE_DB_USER:-postgres}"
REMOTE_DB_PASSWORD="${REMOTE_DB_PASSWORD:-}"
REMOTE_DB_CONTAINER="${REMOTE_DB_CONTAINER:-}"

WORK_DIR_DEFAULT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tmp/db-sync"
WORK_DIR="${WORK_DIR:-$WORK_DIR_DEFAULT}"
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_DIR:-/root/twinsight-db-backups}"

ASSUME_YES=0
KEEP_LOCAL_DUMP=0
SKIP_REMOTE_BACKUP=0

usage() {
  cat <<'EOF'
用法:
  ./scripts/sync-postgres-183-to-demo.sh [选项]

选项:
  --yes                   跳过覆盖确认
  --keep-dump             保留本地导出的 SQL 文件
  --skip-remote-backup    跳过远端覆盖前备份
  --remote-container NAME 显式指定远端 PostgreSQL 容器名
  -h, --help              显示帮助

关键环境变量:
  SOURCE_DB_HOST          默认 192.168.2.183
  SOURCE_DB_PORT          默认 5432
  SOURCE_DB_NAME          默认 twinsight
  SOURCE_DB_USER          默认 postgres
  SOURCE_DB_PASSWORD      源库密码

  REMOTE_SSH_HOST         默认 demo.twinsight.cn
  REMOTE_SSH_PORT         默认 22
  REMOTE_SSH_USER         默认 root
  REMOTE_SSH_PASSWORD     SSH 密码；未设置或缺少 sshpass 时走系统 ssh 交互/密钥

  REMOTE_DB_NAME          默认 twinsight
  REMOTE_DB_USER          默认 postgres
  REMOTE_DB_PASSWORD      远端库密码
  REMOTE_DB_CONTAINER     远端 PostgreSQL 容器名；未设置时自动探测

示例:
  export SOURCE_DB_PASSWORD='***'
  export REMOTE_DB_PASSWORD='***'
  export REMOTE_SSH_PASSWORD='***'
  ./scripts/sync-postgres-183-to-demo.sh --yes

说明:
  1. 该脚本会完整替换远端数据库内容。
  2. 当前仓库里的生产 compose 默认容器名是 twinsight-postgres。
  3. 若线上还是旧配置（例如库名仍是 tandem），请显式设置 REMOTE_DB_NAME。
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

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令: $1"
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

find_pg_dump() {
  if has_cmd pg_dump; then
    command -v pg_dump
    return 0
  fi

  local candidates=(
    "/opt/homebrew/opt/libpq/bin/pg_dump"
    "/usr/local/opt/libpq/bin/pg_dump"
    "/opt/homebrew/bin/pg_dump"
    "/usr/local/bin/pg_dump"
  )
  local candidate

  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

quote() {
  printf '%q' "$1"
}

prompt_secret() {
  local var_name="$1"
  local prompt_text="$2"
  local value="${!var_name:-}"

  if [[ -n "$value" ]]; then
    return
  fi

  read -r -s -p "$prompt_text: " value
  printf '\n'
  if [[ -z "$value" ]]; then
    die "$var_name 不能为空"
  fi
  printf -v "$var_name" '%s' "$value"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --yes)
        ASSUME_YES=1
        ;;
      --keep-dump)
        KEEP_LOCAL_DUMP=1
        ;;
      --skip-remote-backup)
        SKIP_REMOTE_BACKUP=1
        ;;
      --remote-container)
        [[ $# -ge 2 ]] || die "--remote-container 需要一个值"
        REMOTE_DB_CONTAINER="$2"
        shift
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
      warn "未检测到 sshpass，将改用普通 ssh，并在连接远端时手动输入 SSH 密码"
    fi
  fi
}

remote_exec() {
  local cmd="$1"
  "${SSH_BASE[@]}" "$REMOTE_TARGET" "bash -lc $(quote "$cmd")"
}

detect_remote_container() {
  if [[ -n "$REMOTE_DB_CONTAINER" ]]; then
    return
  fi

  log "探测远端 PostgreSQL 容器名..."
  REMOTE_DB_CONTAINER="$(
    remote_exec "docker ps --format '{{.Names}}' | grep -E '^(twinsight-postgres|tandem-postgres)$' | head -n 1 || true"
  )"

  if [[ -z "$REMOTE_DB_CONTAINER" ]]; then
    REMOTE_DB_CONTAINER="$(
      remote_exec "docker ps --format '{{.Names}}' | grep 'postgres' | head -n 1 || true"
    )"
  fi

  [[ -n "$REMOTE_DB_CONTAINER" ]] || die "未能自动探测远端 PostgreSQL 容器，请通过 --remote-container 显式指定"
  success "远端 PostgreSQL 容器: $REMOTE_DB_CONTAINER"
}

confirm_overwrite() {
  if [[ "$ASSUME_YES" -eq 1 ]]; then
    return
  fi

  cat <<EOF

即将执行以下操作:
  源库:    ${SOURCE_DB_USER}@${SOURCE_DB_HOST}:${SOURCE_DB_PORT}/${SOURCE_DB_NAME}
  目标机:  ${REMOTE_SSH_USER}@${REMOTE_SSH_HOST}:${REMOTE_SSH_PORT}
  目标库:  容器 ${REMOTE_DB_CONTAINER} 内 ${REMOTE_DB_USER}/${REMOTE_DB_NAME}

结果:
  远端 ${REMOTE_DB_NAME} 将被完整替换，现有数据会被删除。
EOF

  if [[ "$SKIP_REMOTE_BACKUP" -eq 0 ]]; then
    printf '  覆盖前会先备份远端到: %s\n' "$REMOTE_BACKUP_DIR"
  else
    printf '  你已选择跳过远端备份。\n'
  fi

  printf '\n继续请输入 yes: '
  read -r answer
  [[ "$answer" == "yes" ]] || die "已取消执行"
}

prepare() {
  parse_args "$@"

  need_cmd ssh
  mkdir -p "$WORK_DIR"

  prompt_secret SOURCE_DB_PASSWORD "请输入源库密码 (SOURCE_DB_PASSWORD)"
  prompt_secret REMOTE_DB_PASSWORD "请输入远端库密码 (REMOTE_DB_PASSWORD)"

  setup_ssh
  detect_remote_container
  confirm_overwrite
}

dump_source_db() {
  local timestamp="$1"
  local pg_dump_bin
  LOCAL_DUMP_FILE="$WORK_DIR/source-${SOURCE_DB_NAME}-${timestamp}.sql"

  log "从 ${SOURCE_DB_HOST} 导出 PostgreSQL 到本地文件..."

  if pg_dump_bin="$(find_pg_dump)"; then
    PGPASSWORD="$SOURCE_DB_PASSWORD" "$pg_dump_bin" \
      --host="$SOURCE_DB_HOST" \
      --port="$SOURCE_DB_PORT" \
      --username="$SOURCE_DB_USER" \
      --dbname="$SOURCE_DB_NAME" \
      --format=plain \
      --clean \
      --if-exists \
      --create \
      --no-owner \
      --no-privileges \
      --encoding=UTF8 \
      --file="$LOCAL_DUMP_FILE"
  elif has_cmd docker; then
    warn "未检测到本机 pg_dump，改用 Docker postgres 镜像导出"
    docker run --rm \
      -e PGPASSWORD="$SOURCE_DB_PASSWORD" \
      postgres:16-alpine \
      pg_dump \
      --host="$SOURCE_DB_HOST" \
      --port="$SOURCE_DB_PORT" \
      --username="$SOURCE_DB_USER" \
      --dbname="$SOURCE_DB_NAME" \
      --format=plain \
      --clean \
      --if-exists \
      --create \
      --no-owner \
      --no-privileges \
      --encoding=UTF8 > "$LOCAL_DUMP_FILE"
  else
    die "本机既没有 pg_dump，也没有 docker。请安装 PostgreSQL 客户端，或安装 Docker 后重试。"
  fi

  success "源库导出完成: $LOCAL_DUMP_FILE"
}

backup_remote_db() {
  local timestamp="$1"
  local remote_backup_file="${REMOTE_BACKUP_DIR}/${REMOTE_DB_NAME}-before-sync-${timestamp}.sql"
  local q_backup_dir q_backup_file q_password q_user q_db q_container

  q_backup_dir="$(quote "$REMOTE_BACKUP_DIR")"
  q_backup_file="$(quote "$remote_backup_file")"
  q_password="$(quote "$REMOTE_DB_PASSWORD")"
  q_user="$(quote "$REMOTE_DB_USER")"
  q_db="$(quote "$REMOTE_DB_NAME")"
  q_container="$(quote "$REMOTE_DB_CONTAINER")"

  log "备份远端当前数据库..."
  remote_exec "mkdir -p $q_backup_dir && docker exec -e PGPASSWORD=$q_password $q_container pg_dump -U $q_user -d $q_db --format=plain --clean --if-exists --create --no-owner --no-privileges > $q_backup_file"
  success "远端备份完成: $remote_backup_file"
}

restore_remote_db() {
  local q_password q_user q_container

  q_password="$(quote "$REMOTE_DB_PASSWORD")"
  q_user="$(quote "$REMOTE_DB_USER")"
  q_container="$(quote "$REMOTE_DB_CONTAINER")"

  log "将源库 SQL 导入远端容器内 PostgreSQL..."
  cat "$LOCAL_DUMP_FILE" | "${SSH_BASE[@]}" "$REMOTE_TARGET" "bash -lc $(quote "docker exec -i -e PGPASSWORD=$q_password $q_container psql -v ON_ERROR_STOP=1 -U $q_user -d postgres")"
  success "远端覆盖完成"
}

verify_remote_db() {
  local q_password q_user q_db q_container

  q_password="$(quote "$REMOTE_DB_PASSWORD")"
  q_user="$(quote "$REMOTE_DB_USER")"
  q_db="$(quote "$REMOTE_DB_NAME")"
  q_container="$(quote "$REMOTE_DB_CONTAINER")"

  log "校验远端数据库..."
  remote_exec "docker exec -e PGPASSWORD=$q_password $q_container psql -At -U $q_user -d $q_db -c \"SELECT 'public_tables=' || count(*) FROM information_schema.tables WHERE table_schema = 'public';\""
}

cleanup() {
  if [[ -n "${LOCAL_DUMP_FILE:-}" && -f "${LOCAL_DUMP_FILE:-}" && "$KEEP_LOCAL_DUMP" -ne 1 ]]; then
    rm -f "$LOCAL_DUMP_FILE"
  fi
}

sanitize_dump_file() {
  [[ -n "${LOCAL_DUMP_FILE:-}" && -f "${LOCAL_DUMP_FILE:-}" ]] || die "未找到导出的 SQL 文件，无法清洗"

  # 兼容较老的 PostgreSQL 服务端。新版本 pg_dump 可能输出老版本不识别的 SET 语句。
  log "清洗 dump 里的高版本 PostgreSQL 兼容性语句..."
  perl -0pi -e 's/^SET transaction_timeout = 0;\n//mg' "$LOCAL_DUMP_FILE"
}

main() {
  local timestamp
  timestamp="$(date +%Y%m%d%H%M%S)"

  trap cleanup EXIT

  prepare "$@"
  dump_source_db "$timestamp"
  sanitize_dump_file

  if [[ "$SKIP_REMOTE_BACKUP" -eq 0 ]]; then
    backup_remote_db "$timestamp"
  else
    warn "已跳过远端备份"
  fi

  restore_remote_db
  verify_remote_db
  success "数据库同步完成"
}

main "$@"
