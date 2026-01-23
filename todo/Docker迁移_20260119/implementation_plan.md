# Docker 服务迁移至局域网 Ubuntu 服务器实施计划

> **服务器 IP**: 192.168.2.183  
> **SSH 用户名**: diwei  
> **更新日期**: 2026-01-23

## 当前进度

| 阶段 | 状态 |
|------|------|
| 本地 Docker 容器统一 | ✅ 完成 |
| 配置文件创建 | ✅ 完成 |
| 数据导出 | ✅ 完成 |
| 上传配置到 Ubuntu | ⏳ 进行中 |
| 启动 Ubuntu 服务 | ⏳ 待执行 |
| 数据导入 | ⏳ 待执行 |
| 本地开发切换 | ⏳ 待执行 |

---

## 已完成的工作

### 1. 本地 Docker 容器统一命名 ✅
- 所有容器统一为 `twinsight-*` 前缀
- PostgreSQL、InfluxDB、Node-RED、n8n、Open WebUI 已迁移到 docker-compose 管理
- 旧容器已删除，数据通过 external volumes 保留

### 2. 配置文件和脚本 ✅

| 文件 | 用途 |
|------|------|
| `docker/docker-compose.lan.yml` | 局域网 Docker Compose 配置 |
| `docker/.env.lan.example` | 环境变量模板 |
| `.env.lan` | 本地连接 Ubuntu 配置 |
| `scripts/deploy-lan.sh` | Ubuntu 部署脚本 |

### 3. 数据备份 ✅
- `D:\TwinSIght\backup\postgres_twinsight.sql` (1.37 MB)

---

## 待执行步骤

### 第一步：在 Ubuntu 创建目录并上传文件

**1.1 SSH 登录 Ubuntu：**
```powershell
ssh diwei@192.168.2.183
```

**1.2 在 Ubuntu 上执行：**
```bash
sudo mkdir -p /opt/twinsight
sudo chown diwei:diwei /opt/twinsight
exit
```

**1.3 上传配置文件（Windows PowerShell）：**
```powershell
scp d:\TwinSIght\antigravity\twinsight\docker\docker-compose.lan.yml diwei@192.168.2.183:/opt/twinsight/docker-compose.yml
scp d:\TwinSIght\antigravity\twinsight\docker\.env.lan.example diwei@192.168.2.183:/opt/twinsight/.env
scp d:\TwinSIght\antigravity\twinsight\scripts\deploy-lan.sh diwei@192.168.2.183:/opt/twinsight/
scp D:\TwinSIght\backup\postgres_twinsight.sql diwei@192.168.2.183:/opt/twinsight/
```

---

### 第二步：在 Ubuntu 启动服务

**2.1 SSH 登录后执行：**
```bash
cd /opt/twinsight

# 编辑 .env (GEMINI_API_KEY 已通过 AI 面板配置，此处无需设置)
nano .env

# 设置脚本权限并启动
chmod +x deploy-lan.sh
./deploy-lan.sh
```

**2.2 或手动启动：**
```bash
docker compose pull
docker compose up -d
docker compose ps
```

---

### 第三步：导入 PostgreSQL 数据

```bash
docker exec -i twinsight-postgres psql -U postgres twinsight < /opt/twinsight/postgres_twinsight.sql
```

---

### 第四步：配置本地开发环境

**Windows PowerShell：**
```powershell
cd d:\TwinSIght\antigravity\twinsight

# 备份当前配置
Copy-Item .env.local .env.local.backup

# 使用局域网配置
Copy-Item .env.lan .env.local

# 重启后端服务
cd server
npm run dev
```

---

## 服务访问地址

| 服务 | Ubuntu 地址 |
|------|-------------|
| PostgreSQL | 192.168.2.183:5432 |
| InfluxDB | http://192.168.2.183:8086 |
| Node-RED | http://192.168.2.183:1880 |
| n8n | http://192.168.2.183:5678 |
| Open WebUI | http://192.168.2.183:3080 |

---

## 配置
用docker-compose中的用户名密码登录Open WebUI，创建权限组（所有权限），将当前用户分配到权限组
创建Open WebUI的Token，填写到n8n流程的调用Open WebUI RAG节点，取名Header Auth
配置Open WebUI的LLM API连接地址、文档参数（Top K=10；块大小=800）

## Open WebUI管理配置面板提示词：

### 任务:
请根据提供的上下文 (Context) 回答用户的问题。

### 规则:
1. **语言限制**：必须使用简体中文回答。
2. **思考过程**：在给出正式回答前，请先在 <thought> 标签中展示你的推理过程，分析上下文与问题的关联。
3. **准确性**：如果上下文中没有提到相关信息，请诚实告知，不要胡编乱造。
4. **引用规范**：在回答的关键句末尾，使用 [id] 的格式标注引用来源（如果 Context 中有 id 的话）。
5. **技术格式**：如果是代码或 PowerShell 命令，请确保格式正确并符合 Windows 环境规范。

### 上下文 (Context):
{{CONTEXT}}

### 用户问题:
{{QUERY}}

## 在知识库创建模型时的提示词：
你是一个建筑设施设备运营维护专家，优先使用知识库，在知识库无相关知识的情况可以联网搜索，必须提供引用来源，为建筑运维人员提供帮助。如果知识库以及联网都没找到，就如实回答“没有相关知识”。

## Homeassistant令牌(XPS)

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIwODI4ZTlkMzI2YjU0ZTg1YWJmNGI5NTQwOGI0MjU3NyIsImlhdCI6MTc2OTE3NzcxMCwiZXhwIjoyMDg0NTM3NzEwfQ.HegG1f9hgUSKjStQ6vz21u_MJ9Vg2R23ebL5C9yY9Nc


## open WebUI Token(XPS):

sk-ca761aa4d9164f9b9930cb4dea16a894


## influxdb Token(XPS):


nLGajutgYSfV65VhAw0hakHeeKnwAXAvvnap1yQHNl87Q6C1H4oua35MOu1XG2HJqOWGAmAJLuctHq7LOLPNhQ==


## 让docker自启动

sudo systemctl enable docker.service
sudo systemctl enable containerd.service

验证状态：sudo systemctl is-enabled docker

## 让已有的docker容器自启动
docker update --restart unless-stopped twinsight-open-webui
docker update --restart unless-stopped twinsight-postgres
docker update --restart unless-stopped twinsight-n8n
docker update --restart unless-stopped twinsight-nodered
docker update --restart unless-stopped twinsight-influxdb


## 故障排除

### Ubuntu 防火墙
```bash
sudo ufw allow 5432/tcp  # PostgreSQL
sudo ufw allow 8086/tcp  # InfluxDB
sudo ufw allow 1880/tcp  # Node-RED
sudo ufw allow 5678/tcp  # n8n
sudo ufw allow 3080/tcp  # Open WebUI
```

### 测试网络连接
```powershell
Test-NetConnection -ComputerName 192.168.2.183 -Port 5432
```
