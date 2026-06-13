#!/usr/bin/env bash

# 将本地 public/ 覆盖同步到 192.168.2.183:/home/diwei/antigravity/TwinSight/public/
# 复用通用同步脚本，默认使用 SSH key 直连。

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYNC_SCRIPT="$ROOT_DIR/scripts/sync-public-to-demo.sh"

[[ -x "$SYNC_SCRIPT" ]] || {
  echo "错误: 缺少可执行脚本 $SYNC_SCRIPT" >&2
  exit 1
}

export LOCAL_PUBLIC_DIR="${LOCAL_PUBLIC_DIR:-$ROOT_DIR/public}"
export REMOTE_SSH_HOST="${REMOTE_SSH_HOST:-192.168.2.183}"
export REMOTE_SSH_PORT="${REMOTE_SSH_PORT:-22}"
export REMOTE_SSH_USER="${REMOTE_SSH_USER:-diwei}"
export REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/diwei/antigravity/TwinSight}"
export REMOTE_PUBLIC_DIR="${REMOTE_PUBLIC_DIR:-$REMOTE_APP_DIR/public}"

usage() {
  cat <<EOF
用法:
  ./scripts/sync-public-to-183.sh [选项]

选项:
  --yes         跳过确认
  -h, --help    显示帮助

环境变量:
  LOCAL_PUBLIC_DIR     默认 $LOCAL_PUBLIC_DIR
  REMOTE_SSH_HOST      默认 $REMOTE_SSH_HOST
  REMOTE_SSH_PORT      默认 $REMOTE_SSH_PORT
  REMOTE_SSH_USER      默认 $REMOTE_SSH_USER
  REMOTE_SSH_PASSWORD  可选；默认走 SSH key 登录
  REMOTE_APP_DIR       默认 $REMOTE_APP_DIR
  REMOTE_PUBLIC_DIR    默认 $REMOTE_PUBLIC_DIR

说明:
  1. 会把本地 public 目录内容覆盖同步到远端 public 目录。
  2. 底层优先使用 rsync --delete；远端多余文件会被删除。
  3. 若本机未安装 rsync，会回退到 tar + ssh。
EOF
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
esac

exec "$SYNC_SCRIPT" "$@"
