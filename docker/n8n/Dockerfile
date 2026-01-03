FROM n8nio/n8n:latest

# 切换到 root 用户以修改权限
USER root

# 安装必要的工具
RUN apk add --no-cache su-exec

# 编写启动脚本直接处理权限
RUN echo '#!/bin/sh\n\
    # 检查挂载目录的所有权，如果不是 node 用户则修改它\n\
    chown -R node:node /home/node/.n8n\n\
    # 使用 su-exec 以 node 用户身份启动 n8n\n\
    exec su-exec node n8n' > /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

# 暴露端口
EXPOSE 5678

ENTRYPOINT ["/docker-entrypoint.sh"]
