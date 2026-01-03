FROM nodered/node-red:latest

USER root

ENV NODE_RED_USER_DIR=/data

# 直接以 root 运行，在启动时修复权限
# Railway 容器环境是隔离的，以 root 运行是安全的
ENTRYPOINT ["sh", "-c", "mkdir -p /data && chmod -R 777 /data && node-red"]
