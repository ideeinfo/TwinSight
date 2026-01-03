FROM n8nio/n8n:latest

USER root
RUN apk add --no-cache su-exec

# 强制定义环境变量，防止嵌套
ENV N8N_USER_FOLDER=/home/node/.n8n

# 这里的逻辑不需要任何外部 entrypoint.sh 文件，直接写在 ENTRYPOINT 里
# 这解决了你日志里报错 "docker/entrypoint.sh not found" 的问题
ENTRYPOINT ["sh", "-c", "chown -R node:node /home/node/.n8n && exec su-exec node n8n"]