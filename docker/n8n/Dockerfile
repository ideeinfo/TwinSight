# n8n Custom Dockerfile for Railway
# 解决 Railway Volume 权限问题

FROM n8nio/n8n:latest

USER root

# 创建数据目录并设置正确权限
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node/.n8n

# 切换回 node 用户
USER node

# 设置工作目录
WORKDIR /home/node

# 暴露端口
EXPOSE 5678
