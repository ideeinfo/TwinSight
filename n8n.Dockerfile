FROM n8nio/n8n:latest

USER root

ENV N8N_USER_FOLDER=/home/node/.n8n

# 直接以 root 运行，不需要切换用户
# Railway 容器环境是隔离的，以 root 运行是安全的
ENTRYPOINT ["sh", "-c", "mkdir -p /home/node/.n8n && chmod -R 777 /home/node/.n8n && n8n"]