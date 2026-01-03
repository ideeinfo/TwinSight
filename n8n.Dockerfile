FROM n8nio/n8n:latest

USER root

# Debian 使用 apt-get，安装 gosu 来代替 su-exec
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*

ENV N8N_USER_FOLDER=/home/node/.n8n

# gosu 的用法和 su-exec 一样
ENTRYPOINT ["sh", "-c", "chown -R node:node /home/node/.n8n && exec gosu node n8n"]