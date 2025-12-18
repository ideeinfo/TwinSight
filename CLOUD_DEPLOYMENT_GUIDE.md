
# Tandem Demo 云部署指南

## 📋 项目架构分析

### 服务组件
| 组件 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| **前端 (Frontend)** | Vue 3 + Vite | 80/443 | 静态文件，需要 CDN |
| **后端 API (Server)** | Node.js + Express | 3001 | RESTful API |
| **PostgreSQL** | PostgreSQL 16 | 5432 | 主数据库 |
| **InfluxDB** | InfluxDB 2.x | 8086 | 时序数据库 |
| **Node-RED** | Node-RED | 1880 | IoT 数据流处理 |
| **pgAdmin** | pgAdmin 4 | 5050 | 数据库管理（开发用） |

### 数据流
```
传感器/设备 → Node-RED → InfluxDB (时序数据)
                 ↓
用户 → CDN → 前端静态文件
         ↓
      API Server ← → PostgreSQL (结构化数据)
```

---

## ⚠️ 重要：数据迁移说明

> **本地 Docker 中的数据（PostgreSQL、InfluxDB）不会自动部署到云端！**

Docker volumes 中的数据存储在本地机器上，部署代码到云端时：
- 云端数据库是**空的**
- 需要**重新初始化**数据库结构
- 如需迁移现有数据，需要**手动导出/导入**

### 数据迁移方案

#### PostgreSQL 数据导出/导入

```bash
# 1. 导出本地数据
docker exec tandem-postgres pg_dump -U postgres tandem > backup.sql

# 2. 上传到云端服务器后导入
# Railway: 使用 Railway CLI
railway run psql $DATABASE_URL < backup.sql

# 或直接连接远程数据库
psql "postgresql://user:pass@host:5432/tandem" < backup.sql
```

#### InfluxDB 数据导出/导入

```bash
# 1. 导出本地数据
docker exec tandem-influxdb influx backup /tmp/backup --token YOUR_TOKEN
docker cp tandem-influxdb:/tmp/backup ./influx_backup

# 2. 导入到云端 InfluxDB
# 需要先设置远程连接，或使用 InfluxDB Cloud 的导入功能
```

#### 推荐做法

| 场景 | 建议 |
|------|------|
| **开发/测试** | 不迁移数据，使用 `db:init` 初始化空数据库 |
| **生产环境** | 使用上述导出/导入命令迁移数据 |
| **时序数据** | 使用 InfluxDB Cloud，通过 Node-RED 持续写入 |


---

## 🌐 云服务商对比

### 推荐方案对比

| 服务商 | 优势 | 劣势 | 月费估算 | 推荐场景 |
|--------|------|------|----------|----------|
| **Railway** ⭐ | 部署最简单，自动 CI/CD，免费层 | 资源限制 | $5-20 | 快速原型/小团队 |
| **Render** | 免费层慷慨，自动 SSL | 冷启动延迟 | $0-25 | 个人项目/演示 |
| **Fly.io** | 全球边缘部署，性价比高 | 配置稍复杂 | $5-30 | 高性能需求 |
| **Vercel + Railway** | 前端极快，后端简单 | 需两个平台 | $0-20 | 前端优先项目 |
| **AWS (ECS/RDS)** | 企业级，高度可控 | 配置复杂，费用高 | $50-200+ | 企业生产环境 |
| **阿里云** | 国内访问快，中文支持 | 需备案 | ¥100-500 | 国内用户为主 |

---

## 🚀 方案一：Railway（推荐 - 最简单）

Railway 支持直接从 GitHub 部署，自动检测项目类型并配置。

### 步骤 1：准备 Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile
# ============= 后端服务 =============
FROM node:20-alpine

WORKDIR /app

# 复制后端代码
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

COPY server ./server

# 复制前端构建产物
COPY dist ./dist

# 设置环境变量
ENV NODE_ENV=production
ENV SERVER_PORT=3001

WORKDIR /app/server
EXPOSE 3001

CMD ["node", "index.js"]
```

### 步骤 2：创建 railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node server/index.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### 步骤 3：修改 server/index.js 添加健康检查

```javascript
// 添加健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 静态文件服务（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}
```

### 步骤 4：Railway 部署流程

1. **访问 [railway.app](https://railway.app)** → 用 GitHub 登录
2. **New Project** → **Deploy from GitHub Repo**
3. **选择 `ideeinfo/tandem-demo` 仓库**
4. **添加 PostgreSQL**：
   - 点击 **Add Service** → **Database** → **PostgreSQL**
   - Railway 会自动注入 `DATABASE_URL` 环境变量
5. **配置环境变量**：
   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}  # 自动填充
   SERVER_PORT=3001
   # InfluxDB（如果需要）
   INFLUX_URL=https://your-influxdb-cloud.com
   INFLUX_ORG=your-org
   INFLUX_BUCKET=tandem
   INFLUX_TOKEN=your-token
   ```
6. **部署**：点击 **Deploy** 即可

### 步骤 5：配置自定义域名

1. 在 Railway 项目设置中，点击 **Settings** → **Domains**
2. 添加自定义域名或使用 Railway 提供的 `*.up.railway.app`

---

## 🚀 方案二：Vercel（前端）+ Railway（后端）

### 前端部署（Vercel）

1. **访问 [vercel.com](https://vercel.com)** → GitHub 登录
2. **Import Project** → 选择仓库
3. **配置**：
   - Framework: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **环境变量**：
   ```
   VITE_API_URL=https://your-railway-backend.up.railway.app
   VITE_INFLUX_URL=https://your-influxdb-cloud.com
   VITE_INFLUX_ORG=your-org
   VITE_INFLUX_BUCKET=tandem
   VITE_INFLUX_TOKEN=your-token
   ```

### 后端部署（Railway）

同方案一的步骤，但只部署 `server` 目录。

---

## 🚀 方案三：Docker Compose + 云服务器

适用于需要完全控制的场景（AWS EC2、阿里云 ECS、腾讯云 CVM）。

### 步骤 1：完善 docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:16-alpine
    container_name: tandem-postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-tandem}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - tandem-network

  # InfluxDB 时序数据库
  influxdb:
    image: influxdb:2.7-alpine
    container_name: tandem-influxdb
    restart: always
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: admin
      DOCKER_INFLUXDB_INIT_PASSWORD: adminpassword
      DOCKER_INFLUXDB_INIT_ORG: demo
      DOCKER_INFLUXDB_INIT_BUCKET: tandem
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: ${INFLUX_TOKEN}
    volumes:
      - influxdb_data:/var/lib/influxdb2
    networks:
      - tandem-network

  # 后端 API 服务
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: tandem-api
    restart: always
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-tandem}
      DB_USER: ${DB_USER:-postgres}
      DB_PASSWORD: ${DB_PASSWORD:-password}
      INFLUX_URL: http://influxdb:8086
      INFLUX_ORG: demo
      INFLUX_BUCKET: tandem
      INFLUX_TOKEN: ${INFLUX_TOKEN}
    depends_on:
      - postgres
      - influxdb
    networks:
      - tandem-network

  # Nginx 反向代理 + 前端
  nginx:
    image: nginx:alpine
    container_name: tandem-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./dist:/usr/share/nginx/html:ro
      - ./certbot/conf:/etc/letsencrypt:ro
    depends_on:
      - api
    networks:
      - tandem-network

volumes:
  postgres_data:
  influxdb_data:

networks:
  tandem-network:
    driver: bridge
```

### 步骤 2：创建 Dockerfile.api

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --only=production

COPY server ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "index.js"]
```

### 步骤 3：创建 nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    upstream api {
        server api:3001;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # 前端静态文件
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        # API 代理
        location /api/ {
            proxy_pass http://api/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_cache_bypass $http_upgrade;
        }

        # 上传文件目录
        location /uploads/ {
            proxy_pass http://api/uploads/;
        }

        # 模型文件目录
        location /models/ {
            alias /usr/share/nginx/html/models/;
        }
    }
}
```

### 步骤 4：云服务器部署脚本

创建 `deploy.sh`：

```bash
#!/bin/bash
set -e

echo "🚀 开始部署 Tandem Demo..."

# 1. 拉取最新代码
git pull origin main

# 2. 构建前端
echo "📦 构建前端..."
npm install
npm run build

# 3. 启动 Docker 服务
echo "🐳 启动 Docker 服务..."
docker-compose down
docker-compose up -d --build

# 4. 初始化数据库（首次）
echo "🗃️ 初始化数据库..."
docker exec tandem-api node scripts/init-db.js

echo "✅ 部署完成！"
echo "访问: http://your-domain.com"
```

---

## 🔧 GitHub Actions 自动部署

### 创建 .github/workflows/deploy.yml

```yaml
name: Deploy to Cloud

on:
  push:
    branches: [main, db]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd server && npm ci

      - name: Build frontend
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_INFLUX_URL: ${{ secrets.VITE_INFLUX_URL }}
          VITE_INFLUX_ORG: ${{ secrets.VITE_INFLUX_ORG }}
          VITE_INFLUX_BUCKET: ${{ secrets.VITE_INFLUX_BUCKET }}
          VITE_INFLUX_TOKEN: ${{ secrets.VITE_INFLUX_TOKEN }}

      # ========== Railway 部署 ==========
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: tandem-demo

      # ========== 或者 Vercel 部署（前端）==========
      # - name: Deploy to Vercel
      #   uses: amondnet/vercel-action@v25
      #   with:
      #     vercel-token: ${{ secrets.VERCEL_TOKEN }}
      #     vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
      #     vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
      #     vercel-args: '--prod'
```

### 配置 GitHub Secrets

在仓库 **Settings** → **Secrets and variables** → **Actions** 中添加：

| Secret 名称 | 说明 |
|------------|------|
| `RAILWAY_TOKEN` | Railway API Token |
| `VITE_API_URL` | 后端 API 地址 |
| `VITE_INFLUX_URL` | InfluxDB 地址 |
| `VITE_INFLUX_ORG` | InfluxDB 组织 |
| `VITE_INFLUX_BUCKET` | InfluxDB Bucket |
| `VITE_INFLUX_TOKEN` | InfluxDB Token |

---

## 📊 InfluxDB 云服务方案

如果需要时序数据，推荐使用 **InfluxDB Cloud**：

1. 访问 [cloud2.influxdata.com](https://cloud2.influxdata.com)
2. 注册免费账户（免费层：30天数据保留）
3. 创建 Bucket：`tandem`
4. 获取 API Token
5. 配置环境变量

---

## 💰 成本估算

### 小型项目（< 1000 用户/月）
| 服务 | 月费 |
|------|------|
| Railway (API + PostgreSQL) | $5-10 |
| Vercel (前端) | 免费 |
| InfluxDB Cloud | 免费层 |
| **总计** | **$5-10/月** |

### 中型项目（1000-10000 用户/月）
| 服务 | 月费 |
|------|------|
| Railway Pro | $20 |
| PostgreSQL (更大存储) | +$10 |
| InfluxDB Cloud 付费 | $25 |
| **总计** | **$55/月** |

### 企业级（> 10000 用户/月）
| 服务 | 月费 |
|------|------|
| AWS ECS / 阿里云 ECS | $50-100 |
| RDS PostgreSQL | $50-100 |
| InfluxDB Cloud 企业版 | $100+ |
| **总计** | **$200+/月** |

---

## ✅ 部署检查清单

- [ ] 环境变量已正确配置
- [ ] PostgreSQL 数据库已初始化
- [ ] 前端 `VITE_API_URL` 指向正确的后端地址
- [ ] CORS 已配置允许前端域名
- [ ] SSL 证书已配置（HTTPS）
- [ ] 健康检查端点正常
- [ ] 上传目录权限正确
- [ ] 日志收集已配置

---

## 🔗 有用链接

- [Railway 文档](https://docs.railway.app)
- [Vercel 文档](https://vercel.com/docs)
- [Fly.io 文档](https://fly.io/docs)
- [InfluxDB Cloud](https://www.influxdata.com/products/influxdb-cloud/)
