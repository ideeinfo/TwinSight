FROM n8nio/n8n:latest

USER root

# n8n 镜像基于 Alpine，使用 apk 和 su-exec
RUN apk add --no-cache su-exec

ENV N8N_USER_FOLDER=/home/node/.n8n

# 权限修复 + 降权启动
ENTRYPOINT ["sh", "-c", "chown -R node:node /home/node/.n8n && exec su-exec node n8n"]