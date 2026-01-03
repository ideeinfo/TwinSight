# n8n Custom Dockerfile for Railway
# 解决 Railway Volume 权限问题

FROM n8nio/n8n:latest

# 切换到 root 用户
USER root

# 安装所需工具
RUN apk add --no-cache su-exec

# 创建数据目录并设置正确权限
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node/.n8n

# 复制启动脚本
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

# 设置工作目录
WORKDIR /home/node

# 暴露端口
EXPOSE 5678

# 使用自定义启动脚本（以 root 启动，脚本内部切换到 node 用户）
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
