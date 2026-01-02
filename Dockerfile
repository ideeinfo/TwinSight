# ============= 多阶段构建 =============

# 阶段1: 构建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# 复制前端依赖文件
COPY package*.json ./
RUN npm ci

# 复制前端源码并构建
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public

# 构建参数（通过 --build-arg 传入）
ARG VITE_API_URL
ARG VITE_INFLUX_URL
ARG VITE_INFLUX_ORG
ARG VITE_INFLUX_BUCKET
ARG VITE_INFLUX_TOKEN

RUN npm run build

# 阶段2: 构建后端
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --only=production

# 阶段3: 生产镜像
FROM node:20-alpine

WORKDIR /app

# 安装必要的工具（用于健康检查和脚本执行）
RUN apk add --no-cache wget

# 从后端构建阶段复制依赖
COPY --from=backend-builder /app/node_modules ./node_modules

# 复制后端代码
COPY server ./

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /app/dist ./dist

# 复制 public 目录中的静态资源（模型文件等）
COPY public ./public

# 复制启动脚本
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# 设置环境变量
ENV NODE_ENV=production
ENV SERVER_PORT=3001

# EXPOSE 3001
# HEALTHCHECK 被注释掉，交由 Railway 平台处理
# HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
#     CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# 创建持久化目录（用于 Volume 挂载）
# 生产环境使用 /app/uploads，通过 DATA_PATH 环境变量配置
RUN mkdir -p /app/uploads/models /app/uploads/docs /app/uploads/files /app/uploads/data

# 使用 CMD 而非 ENTRYPOINT，以便 Railway 的 startCommand 能正确覆盖
CMD ["node", "index.js"]

