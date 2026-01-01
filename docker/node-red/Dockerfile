# Node-RED Custom Dockerfile for Railway
# 解决 Railway Volume 权限问题

FROM nodered/node-red:latest

# 切换到 root 用户修复权限
USER root

# 创建数据目录并设置正确权限
RUN mkdir -p /data && chown -R node-red:node-red /data

# 预先复制 settings.js 到 /data 目录（避免第一次启动的复制权限问题）
RUN cp /usr/src/node-red/node_modules/node-red/settings.js /data/settings.js \
    && chown node-red:node-red /data/settings.js

# 切换回 node-red 用户
USER node-red

# 暴露端口
EXPOSE 1880

# 启动命令
CMD ["npm", "start", "--", "--userDir", "/data"]
