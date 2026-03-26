#!/usr/bin/env bash

# 将本地 public/ 完整覆盖同步到远端 /data/twinsight/public/
# 优先使用 rsync --delete；未安装 rsync 时回退到 tar + ssh。

set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LOCAL_PUBLIC_DIR="${LOCAL_PUBLIC_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public}"
REMOTE_SSH_HOST="${REMOTE_SSH_HOST:-demo.twinsight.cn}"
REMOTE_SSH_PORT="${REMOTE_SSH_PORT:-22}"
REMOTE_SSH_USER="${REMOTE_SSH_USER:-root}"
REMOTE_SSH_PASSWORD="${REMOTE_SSH_PASSWORD:-}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/data/twinsight}"
REMOTE_PUBLIC_DIR="${REMOTE_PUBLIC_DIR:-$REMOTE_APP_DIR/public}"

ASSUME_YES=0

usage() {
  cat <<'EOF'
用法:
  ./scripts/sync-public-to-demo.sh [选项]

选项:
  --yes         跳过确认
  -h, --help    显示帮助

环境变量:
  LOCAL_PUBLIC_DIR     默认 ./public
  REMOTE_SSH_HOST      默认 demo.twinsight.cn
  REMOTE_SSH_PORT      默认 22
  REMOTE_SSH_USER      默认 root
  REMOTE_SSH_PASSWORD  SSH 密码；未设置或缺少 sshpass 时走普通 ssh 交互
  REMOTE_APP_DIR       默认 /data/twinsight
  REMOTE_PUBLIC_DIR    默认 /data/twinsight/public

说明:
  1. 该脚本会完整覆盖远端 public 目录内容。
  2. 使用 rsync 时会带 --delete，远端多余文件会被删除。
  3. 未安装 rsync 时，会先清空远端 public，再通过 tar 流式上传。
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
      warn "未检测到 sshpass，将改用普通 ssh，并在连接远端时手动输入 SSH 密码"
    fi
  fi
}

remote_exec() {
  local cmd="$1"
  "${SSH_BASE[@]}" "$REMOTE_TARGET" "bash -lc $(quote "$cmd")"
}

confirm_sync() {
  if [[ "$ASSUME_YES" -eq 1 ]]; then
    return
  fi

  cat <<EOF

即将执行以下同步:
  本地目录: ${LOCAL_PUBLIC_DIR}
  远端主机: ${REMOTE_SSH_USER}@${REMOTE_SSH_HOST}:${REMOTE_SSH_PORT}
  远端目录: ${REMOTE_PUBLIC_DIR}

结果:
  远端 public 目录将被完整覆盖，多余文件会被删除。
EOF

  printf '\n继续请输入 yes: '
  local answer
  read -r answer
  [[ "$answer" == "yes" ]] || die "已取消执行"
}

prepare() {
  parse_args "$@"
  [[ -d "$LOCAL_PUBLIC_DIR" ]] || die "本地 public 目录不存在: $LOCAL_PUBLIC_DIR"
  has_cmd ssh || die "缺少命令: ssh"
  has_cmd tar || die "缺少命令: tar"

  setup_ssh
  confirm_sync
}

sync_with_rsync() {
  has_cmd rsync || return 1

  local rsync_cmd=(rsync -az --delete --progress -e "ssh -p $REMOTE_SSH_PORT -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30")

  if [[ -n "$REMOTE_SSH_PASSWORD" && "$(has_cmd sshpass && echo yes || echo no)" == "yes" ]]; then
    rsync_cmd=(sshpass -e "${rsync_cmd[@]}")
  fi

  log "使用 rsync 覆盖同步 public 目录..."
  remote_exec "mkdir -p $(quote "$REMOTE_PUBLIC_DIR")"
  "${rsync_cmd[@]}" "${LOCAL_PUBLIC_DIR}/" "${REMOTE_TARGET}:$(printf '%q' "${REMOTE_PUBLIC_DIR}/")"
  success "rsync 同步完成"
  return 0
}

sync_with_tar() {
  local q_remote_dir
  q_remote_dir="$(quote "$REMOTE_PUBLIC_DIR")"

  warn "未检测到 rsync，改用 tar + ssh 覆盖同步"
  remote_exec "mkdir -p $q_remote_dir && shopt -s dotglob nullglob && rm -rf $q_remote_dir/*"
  tar -C "$LOCAL_PUBLIC_DIR" -cf - . | "${SSH_BASE[@]}" "$REMOTE_TARGET" "bash -lc $(quote "mkdir -p $q_remote_dir && tar -xf - -C $q_remote_dir")"
  success "tar 同步完成"
}

verify_remote() {
  local q_remote_dir
  q_remote_dir="$(quote "$REMOTE_PUBLIC_DIR")"
  log "校验远端 public 目录..."
  remote_exec "find $q_remote_dir -maxdepth 2 -type f | sed -n '1,20p'"
}

main() {
  prepare "$@"

  if ! sync_with_rsync; then
    sync_with_tar
  fi

  verify_remote
  success "public 目录同步完成"
}

main "$@"
