
# Tandem Demo 云部署指南

> **最后更新**: 2024-12-30  
> **版本**: 2.0 - 增补 n8n、Open WebUI 等 AI/IoT 服务

---

## 📋 目录

- [项目架构分析](#-项目架构分析)
- [数据迁移说明](#-重要数据迁移说明)
- [部署策略选择](#-部署策略选择)
- [方案一：Railway 快速部署](#-方案一railway推荐--最简单)
- [方案二：Vercel + Railway 分离部署](#-方案二vercel前端-railway后端)
- [方案三：自托管服务器 + Docker Compose](#-方案三docker-compose--云服务器)
- [AI 服务部署：n8n 工作流](#-ai-服务部署n8n-工作流)
- [AI 服务部署：Open WebUI](#-ai-服务部署open-webui)
- [IoT 服务部署](#-iot-服务部署)
- [端口暴露与反向代理](#-端口暴露与反向代理配置)
- [数据库自动初始化](#-数据库自动初始化机制)
- [GitHub Actions 自动部署](#-github-actions-自动部署)
- [成本估算](#-成本估算)
- [部署检查清单](#-部署检查清单)

---

## 📊 项目架构分析

### 服务组件

| 组件 | 技术栈 | 端口 | 必需 | 说明 |
|------|--------|------|------|------|
| **前端 (Frontend)** | Vue 3 + Vite | 80/443 | ✅ | 静态文件，需要 CDN |
| **后端 API (Server)** | Node.js + Express | 3001 | ✅ | RESTful API |
| **PostgreSQL** | PostgreSQL 16 + pgvector | 5432 | ✅ | 主数据库 |
| **InfluxDB** | InfluxDB 2.x | 8086 | ⚠️ | 时序数据库（如需时序数据） |
| **n8n** | n8n | 5678 | ⚠️ | AI 工作流自动化 |
| **Open WebUI** | Open WebUI | 3080 | ⚠️ | AI 对话界面 |
| **Node-RED** | Node-RED | 1880 | ⚠️ | IoT 数据流处理 |
| **Grafana** | Grafana | 3000 | ⚠️ | 数据可视化 |
| **pgAdmin** | pgAdmin 4 | 5050 | ❌ | 数据库管理（开发用） |

### 服务架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           云部署架构                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Nginx 反向代理 (80/443)                        │  │
│  │  / → 前端  │  /api/* → API  │  /n8n/* → n8n  │  /ai/* → WebUI   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│         ┌──────────────────────────┼──────────────────────────┐         │
│         ▼                          ▼                          ▼         │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐  │
│  │   前端      │            │   后端 API  │            │ PostgreSQL  │  │
│  │  (静态文件) │───────────▶│  (Node.js)  │───────────▶│  (核心数据) │  │
│  │             │            │   :3001     │            │   :5432     │  │
│  └─────────────┘            └─────────────┘            └─────────────┘  │
│                                    │                                     │
│         ┌──────────────────────────┼──────────────────────────┐         │
│         ▼                          ▼                          ▼         │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐  │
│  │   n8n       │            │ Open WebUI  │            │  InfluxDB   │  │
│  │ (AI 工作流) │            │ (AI 对话)   │            │ (时序数据)  │  │
│  │   :5678     │            │   :8080     │            │   :8086     │  │
│  └─────────────┘            └─────────────┘            └─────────────┘  │
│                                                                          │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐  │
│  │  Node-RED   │            │   Grafana   │            │   pgAdmin   │  │
│  │ (IoT 数据)  │            │ (可视化)    │            │ (管理工具)  │  │
│  │   :1880     │            │   :3000     │            │   :5050     │  │
│  └─────────────┘            └─────────────┘            └─────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 数据流

```
传感器/设备 → Node-RED → InfluxDB (时序数据)
                 ↓
用户 → Nginx → 前端静态文件
         ↓
      API Server ← → PostgreSQL (结构化数据)
         ↓
      n8n (AI 分析) → Open WebUI (Gemini API)
```

---

## ⚠️ 重要：数据迁移说明

> **本地 Docker 中的数据（PostgreSQL、InfluxDB）不会自动部署到云端！**

Docker volumes 中的数据存储在本地机器上，部署代码到云端时：
- 云端数据库是**空的**
- 需要**自动初始化**数据库结构（已配置）
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
| **开发/测试** | 不迁移数据，容器启动时自动初始化空数据库 |
| **生产环境** | 使用上述导出/导入命令迁移数据 |
| **时序数据** | 使用 InfluxDB Cloud，通过 Node-RED 持续写入 |


---

## 🎯 部署策略选择

### 推荐方案对比

| 服务商 | 复杂度 | 月费估算 | Docker 支持 | 全服务栈 | 推荐场景 |
|--------|--------|----------|------------|----------|----------|
| **Railway** ⭐ | 🟢 简单 | $5-20 | ✅ 完整 | ✅ 是 | 快速原型/小团队 |
| **Render** | 🟢 简单 | $0-25 | ✅ 完整 | ✅ 是 | 个人项目/演示 |
| **Fly.io** | 🟡 中等 | $5-30 | ✅ 完整 | ✅ 是 | 全球边缘部署 |
| **Vercel + Railway** | 🟡 中等 | $0-20 | 🔶 部分 | 🔶 拆分 | 前端优先项目 |
| **Google Cloud Run** | 🟢 简单 | 按用量 | ✅ 完整 | 🔶 部分 | 无服务器/按需扩展 |
| **AWS ECS + RDS** | 🔴 复杂 | $50-200+ | ✅ 完整 | ✅ 是 | 企业生产环境 |
| **自托管 VPS** | 🔴 复杂 | $10-50 | ✅ 完整 | ✅ 是 | 完全控制/全服务 |

### 分层部署策略建议

由于项目包含多个服务，建议采用**分层部署**：

| 层级 | 服务 | 推荐平台 | 理由 |
|------|------|----------|------|
| **核心应用层** | 前端 + 后端 + PostgreSQL | Railway / Cloud Run | 自动 CI/CD，托管数据库 |
| **AI 服务层** | n8n + Open WebUI | Railway 或 独立 VPS | 可选部署，资源灵活 |
| **IoT/监控层** | InfluxDB + Node-RED + Grafana | 独立 VPS 或云托管 | 持久化数据，高可用 |

---

## 🚀 方案一：Railway（推荐 - 最简单）

Railway 支持直接从 GitHub 部署，自动检测项目类型并配置。

### 已配置文件

项目已包含以下 Railway 配置：

- `Dockerfile` - 多阶段构建，包含前端和后端
- `railway.json` - Railway 部署配置
- `docker/entrypoint.sh` - 容器启动脚本，支持自动数据库初始化

### railway.json 配置

```json
{
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "Dockerfile"
    },
    "deploy": {
        "startCommand": "node scripts/post-deploy.js && node index.js",
        "healthcheckPath": "/api/health",
        "healthcheckTimeout": 60,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 5,
        "numReplicas": 1
    }
}
```

### 部署流程

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
   # Gemini API（如需 AI 功能）
   GEMINI_API_KEY=your-gemini-api-key
   # InfluxDB（如果需要）
   INFLUX_URL=https://your-influxdb-cloud.com
   INFLUX_ORG=your-org
   INFLUX_BUCKET=tandem
   INFLUX_TOKEN=your-token
   ```
6. **部署**：点击 **Deploy** 即可

### 配置自定义域名

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

### 配置文件

项目已包含生产环境配置文件：

| 文件 | 说明 |
|------|------|
| `docker/docker-compose.prod.yml` | 生产环境完整服务栈 |
| `docker/nginx.conf` | Nginx 反向代理配置 |
| `docker/.env.production.example` | 环境变量模板 |
| `docker/entrypoint.sh` | 容器启动脚本 |

### 部署步骤

#### 1. 准备服务器

```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 克隆代码
git clone https://github.com/ideeinfo/tandem-demo.git /opt/tandem-demo
cd /opt/tandem-demo
```

#### 2. 配置环境变量

```bash
cd docker
cp .env.production.example .env
# 编辑 .env 文件，填写实际配置
nano .env
```

#### 3. 配置 SSL 证书

```bash
# 创建 SSL 目录
mkdir -p docker/ssl

# 使用 Let's Encrypt（推荐）
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# 复制证书
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/ssl/
```

#### 4. 启动服务

```bash
# 启动核心服务
docker-compose -f docker-compose.prod.yml up -d

# 启动包含管理工具（pgAdmin）
docker-compose -f docker-compose.prod.yml --profile admin up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 停止服务
docker-compose -f docker-compose.prod.yml down
```

---

## 🤖 AI 服务部署：n8n 工作流

n8n 是一个强大的工作流自动化平台，用于处理 AI 分析任务。

### Railway 部署 n8n

1. 在 Railway 项目中添加新服务
2. 选择 **Docker Image** → `n8nio/n8n:latest`
3. 配置环境变量：
   ```
   N8N_HOST=0.0.0.0
   N8N_PORT=5678
   N8N_PROTOCOL=https
   WEBHOOK_URL=https://your-n8n-domain/
   N8N_BASIC_AUTH_ACTIVE=true
   N8N_BASIC_AUTH_USER=admin
   N8N_BASIC_AUTH_PASSWORD=your-password
   GEMINI_API_KEY=your-gemini-api-key
   N8N_BLOCK_ENV_ACCESS_IN_NODE=false
   TZ=Asia/Shanghai
   ```
4. 暴露端口 `5678`
5. 配置持久化存储卷 `/home/node/.n8n`

### 自托管部署 n8n

使用 `docker/docker-compose.prod.yml` 中已包含 n8n 配置：

```yaml
n8n:
  image: n8nio/n8n:latest
  container_name: tandem-n8n
  restart: unless-stopped
  environment:
    - N8N_HOST=${N8N_HOST:-localhost}
    - N8N_PORT=5678
    - GEMINI_API_KEY=${GEMINI_API_KEY}
    # ... 更多配置
  volumes:
    - n8n_data:/home/node/.n8n
```

### 导入工作流

项目中的 n8n 工作流位于 `n8n-workflows/` 目录，部署后可通过 n8n 界面导入。

---

## 🤖 AI 服务部署：Open WebUI

Open WebUI 提供类似 ChatGPT 的 AI 对话界面，支持 Gemini API。

### Railway 部署 Open WebUI

1. 在 Railway 项目中添加新服务
2. 选择 **Docker Image** → `ghcr.io/open-webui/open-webui:main`
3. 配置环境变量：
   ```
   WEBUI_NAME=Tandem AI
   DEFAULT_LOCALE=zh-CN
   ENABLE_API_KEYS=true
   OPENAI_API_BASE_URLS=https://generativelanguage.googleapis.com/v1beta/openai
   OPENAI_API_KEYS=your-gemini-api-key
   ENABLE_SIGNUP=false
   ENABLE_RAG_WEB_SEARCH=true
   HF_ENDPOINT=https://hf-mirror.com
   ```
4. 暴露端口 `8080`
5. 配置持久化存储卷 `/app/backend/data`

### 自托管部署 Open WebUI

使用 `docker/docker-compose.prod.yml` 中已包含 Open WebUI 配置。

---

## 📡 IoT 服务部署

### InfluxDB 云服务方案

推荐使用 **InfluxDB Cloud**（免费层支持 30 天数据保留）：

1. 访问 [cloud2.influxdata.com](https://cloud2.influxdata.com)
2. 注册免费账户
3. 创建 Bucket：`tandem`
4. 获取 API Token
5. 配置环境变量

### Node-RED 部署

Node-RED 用于 IoT 数据采集和处理。推荐与完整服务栈一起部署在自托管服务器上。

### Grafana 部署

Grafana 用于数据可视化仪表盘。可使用：
- **Grafana Cloud** - 免费层足够小型项目使用
- **自托管** - 使用 `docker-compose.prod.yml` 配置

---

## 🌐 端口暴露与反向代理配置

### Nginx 统一端口映射

使用 `docker/nginx.conf` 配置，通过 Nginx 反向代理统一暴露所有服务：

| 路径 | 目标服务 | 说明 |
|------|----------|------|
| `/` | 前端静态文件 | Vue 应用 |
| `/api/*` | 后端 API (:3001) | RESTful API |
| `/n8n/*` | n8n (:5678) | AI 工作流 |
| `/ai/*` | Open WebUI (:8080) | AI 对话 |
| `/nodered/*` | Node-RED (:1880) | IoT 数据流 |
| `/grafana/*` | Grafana (:3000) | 监控仪表盘 |
| `/webhook/*` | n8n Webhook | 外部 Webhook 接入 |

### 配置示例

```nginx
# API 代理
location /api/ {
    proxy_pass http://api:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# n8n 工作流
location /n8n/ {
    proxy_pass http://n8n:5678/;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# Open WebUI
location /ai/ {
    proxy_pass http://open-webui:8080/;
    proxy_buffering off;  # 支持流式响应
}
```

### Railway 端口暴露

Railway 自动处理端口暴露，每个服务获得独立域名：
- 主应用：`tandem-demo.up.railway.app`
- n8n：`tandem-n8n.up.railway.app`
- Open WebUI：`tandem-ai.up.railway.app`

---

## 🔧 数据库自动初始化机制

### 初始化脚本

项目包含 `server/scripts/post-deploy.js` 脚本，在容器启动时自动执行：

1. **等待数据库就绪** - 最多重试 30 次
2. **检查表结构** - 判断是否需要初始化
3. **创建表结构** - 执行 `db/schema.sql`
4. **创建基础数据** - 创建系统必需的初始数据

### 工作原理

```javascript
// 容器启动时执行
async function main() {
    // 1. 等待数据库就绪
    await waitForDatabase();
    
    // 2. 检查并初始化数据库结构
    await initializeDatabase();
    
    // 3. 启动应用
    console.log('✅ 初始化完成，准备启动应用');
}
```

### 配置要点

- **幂等执行**：脚本可重复执行，不会报错
- **自动检测**：仅在表不存在时创建
- **环境变量**：支持 `DATABASE_URL` 或独立配置

---

## 🔧 GitHub Actions 自动部署

### 已配置工作流

`.github/workflows/deploy.yml` 支持多种部署方式：

| 部署目标 | 触发条件 | 说明 |
|----------|----------|------|
| **Railway** | 推送到 main/db 分支 | 自动部署 |
| **Vercel** | 手动触发 | 前端部署 |
| **SSH** | 手动触发 | 自托管服务器 |
| **Docker** | 手动触发 | 仅构建镜像 |

### 配置 GitHub Secrets

在仓库 **Settings** → **Secrets and variables** → **Actions** 中添加：

| Secret 名称 | 说明 | 必需 |
|------------|------|------|
| `RAILWAY_TOKEN` | Railway API Token | ✅ |
| `VITE_API_URL` | 后端 API 地址 | ✅ |
| `VITE_INFLUX_URL` | InfluxDB 地址 | ⚠️ |
| `VITE_INFLUX_ORG` | InfluxDB 组织 | ⚠️ |
| `VITE_INFLUX_BUCKET` | InfluxDB Bucket | ⚠️ |
| `VITE_INFLUX_TOKEN` | InfluxDB Token | ⚠️ |
| `SSH_HOST` | SSH 服务器地址 | ⚠️ |
| `SSH_USERNAME` | SSH 用户名 | ⚠️ |
| `SSH_PRIVATE_KEY` | SSH 私钥 | ⚠️ |
| `VERCEL_TOKEN` | Vercel Token | ⚠️ |
| `VERCEL_ORG_ID` | Vercel 组织 ID | ⚠️ |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID | ⚠️ |

### 手动触发部署

1. 访问仓库的 **Actions** 标签页
2. 选择 **Deploy to Cloud** 工作流
3. 点击 **Run workflow**
4. 选择部署目标（railway/vercel/ssh/docker）
5. 点击 **Run workflow** 开始部署

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
| n8n (Railway) | +$5 |
| Open WebUI (Railway) | +$5 |
| **总计** | **$65/月** |

### 企业级（> 10000 用户/月）
| 服务 | 月费 |
|------|------|
| 自托管 VPS (4核8G) | $50-100 |
| RDS PostgreSQL | $50-100 |
| InfluxDB Cloud 企业版 | $100+ |
| **总计** | **$200+/月** |

---

## ✅ 部署检查清单

### 核心应用
- [ ] 环境变量已正确配置
- [ ] PostgreSQL 数据库已连接
- [ ] 数据库表结构已自动创建
- [ ] 前端 `VITE_API_URL` 指向正确的后端地址
- [ ] CORS 已配置允许前端域名
- [ ] SSL 证书已配置（HTTPS）
- [ ] 健康检查端点正常 (`/api/health`)

### AI 服务
- [ ] Gemini API Key 已配置
- [ ] n8n 工作流已导入
- [ ] Open WebUI 管理员账户已创建
- [ ] Webhook URL 已配置

### IoT 服务
- [ ] InfluxDB 已连接
- [ ] Node-RED 数据流已配置
- [ ] Grafana 仪表盘已创建

### 运维
- [ ] 日志收集已配置
- [ ] 监控告警已配置
- [ ] 备份策略已制定

---

## 🔗 有用链接

- [Railway 文档](https://docs.railway.app)
- [Vercel 文档](https://vercel.com/docs)
- [Fly.io 文档](https://fly.io/docs)
- [InfluxDB Cloud](https://www.influxdata.com/products/influxdb-cloud/)
- [n8n 文档](https://docs.n8n.io/)
- [Open WebUI 文档](https://docs.openwebui.com/)
- [Let's Encrypt](https://letsencrypt.org/)
