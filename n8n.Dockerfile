# 显式指定使用 alpine 版本，这样才有 apk 命令
FROM n8nio/n8n:2.0.3-alpine

USER root

# 安装 su-exec
RUN apk add --no-cache su-exec

# 设置环境变量，防止嵌套
ENV N8N_USER_FOLDER=/home/node/.n8n

# 这里的逻辑：抢回权限 -> 启动
ENTRYPOINT ["sh", "-c", "chown -R node:node /home/node/.n8n && exec su-exec node n8n"]