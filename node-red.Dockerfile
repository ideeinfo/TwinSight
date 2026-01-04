FROM nodered/node-red:latest

USER root

ENV NODE_RED_USER_DIR=/data

# 复制预定义的 package.json 并安装依赖
COPY nodered/package.json .
RUN npm install --unsafe-perm --no-update-notifier --no-fund --only=production

# 复制 flows.json 和 settings.js (如果有)
# COPY nodered/flows.json /data/flows.json
# COPY nodered/settings.js /data/settings.js

# 直接以 root 运行，在启动时修复权限
# Railway 容器环境是隔离的，以 root 运行是安全的
ENTRYPOINT ["sh", "-c", "mkdir -p /data && chmod -R 777 /data && node-red"]
