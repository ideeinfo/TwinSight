# n8n Custom Dockerfile for Railway
# 解决 Railway Volume 权限问题 - 简化版本，以 root 运行

FROM n8nio/n8n:latest

# 保持 root 用户运行（Railway Volume 需要 root 权限）
USER root

# 设置 n8n 数据目录环境变量
ENV N8N_USER_FOLDER=/home/node/.n8n

# 创建数据目录
RUN mkdir -p /home/node/.n8n && chmod 777 /home/node/.n8n

# 设置工作目录
WORKDIR /home/node

# 暴露端口
EXPOSE 5678

# 直接启动 n8n（以 root 运行）
CMD ["n8n", "start"]
