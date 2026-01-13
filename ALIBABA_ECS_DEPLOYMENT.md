# 阿里云 ECS (Ubuntu) 专项部署方案

本指南专门针对**中国大陆地域**的阿里云 ECS 服务器（Ubuntu 22.04 LTS）编写，着重解决了**网络连接**、**镜像加速**和**AI 服务访问**等本地化问题。

## 📋 部署前准备

### 1. 服务器选型建议
- **按量付费/包年包月**：建议先按量付费测试，稳定后转包年包月。
- **地域**：建议选择 **华东1 (杭州)** 或 **华北2 (北京)**，与您的其他阿里云服务（如 OSS、RDS）保持同地域以内网互通。
- **操作系统**：**Ubuntu 22.04 LTS (64位)**。
- **配置推荐**：
  - **最低配置**：2 vCPU / 4 GiB 内存 (无 AI 模型本地推理，仅运行核心服务)
  - **推荐配置**：4 vCPU / 8 GiB 内存 (流畅运行 n8n + 数据库 + 缓存)

### 2. 安全组配置 (防火墙)
进入 ECS 控制台 -> 安全组，添加入方向规则：

| 端口/范围 | 协议 | 授权对象 | 说明 |
|-----------|------|----------|------|
| 22/22     | TCP  | 您的公网IP | SSH 远程连接 (建议仅对特定IP开放) |
| 80/80     | TCP  | 0.0.0.0/0| HTTP Web 服务 |
| 443/443   | TCP  | 0.0.0.0/0| HTTPS Web 服务 |

> ⚠️ **注意**：3001, 5678, 5432 等特定服务端口**不要**直接对公网开放，请通过 Nginx 反向代理（已配置在 80/443）访问，以保障安全。

---

## 🛠️ 第一步：环境初始化 (国内加速)

登录服务器后，按顺序执行以下命令。

### 1. 替换阿里云 Apt 源
Ubuntu ECS 默认通常已配置阿里云源，可跳过此步。如下载慢，可手动执行：

```bash
# 备份
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak

# 替换为阿里云镜像源
sudo sed -i 's/http:\/\/archive.ubuntu.com/http:\/\/mirrors.aliyun.com/g' /etc/apt/sources.list

# 更新
sudo apt update && sudo apt upgrade -y
```

### 2. 安装 Docker & Docker Compose (使用国内源)

```bash
# 卸载旧版本
sudo apt-get remove docker docker-engine docker.io containerd runc

# 安装依赖
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 添加阿里云 Docker GPG 密钥
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 软件源
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 验证
sudo docker run --rm hello-world
```

### 3. 配置 Docker 镜像加速
这是**最关键**的一步，否则无法拉取 Docker Hub 镜像。

1.  登录 [阿里云容器镜像服务控制台](https://cr.console.aliyun.com/)。
2.  在左侧菜单选择“镜像工具” -> “镜像加速器”。
3.  复制您的专属加速器地址 (如 `https://xxxx.mirror.aliyuncs.com`)。
4.  配置 Daemon：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://YOUR_ID.mirror.aliyuncs.com"]
}
EOF
# (请将 https://YOUR_ID.mirror.aliyuncs.com 替换为您实际的地址)

sudo systemctl daemon-reload
sudo systemctl restart docker
```

---

## 🚀 第二步：代码部署

### 1. 克隆代码
如果 GitHub 访问慢，可以使用 GitHub 镜像站或通过本地上传。

**推荐：使用 Gitee 镜像 / 本地上传**
1.  本地压缩项目代码：`zip -r twinsight.zip . -x "node_modules/*" ".git/*" "dist/*"`
2.  使用 `scp` 上传：`scp twinsight.zip root@your-ecs-ip:/opt/`
3.  服务器解压：
    ```bash
    sudo apt install unzip
    cd /opt
    unzip twinsight.zip -d twinsight
    cd twinsight/docker
    ```

### 2. 配置环境变量
```bash
cp .env.production.example .env
nano .env
```

**关键配置项修改**：

```ini
# --- 基础配置 ---
NODE_ENV=production
# 数据库密码 (务必修改)
DB_PASSWORD=SecurePassword123
POSTGRES_PASSWORD=SecurePassword123

# --- AI 服务网络优化 (中国大陆专用) ---

# 1. Hugging Face 镜像 (Open WebUI 下载模型用)
HF_ENDPOINT=https://hf-mirror.com

# 2. Gemini API 代理配置
# 由于国内无法连接 googleapis.com，您有两个选择：

# 方案 A: 使用 HTTP 代理 (如果您有梯子/代理服务器)
# HTTPS_PROXY=http://user:pass@proxy-host:port

# 方案 B: 使用 API 中转服务
# 将 Base URL 替换为支持国内访问的中转域名

# 方案 C: 这接替换为国产大模型 (推荐，见下文)
```

---

## 🌩️ 第三步：配置 AI 模型服务

在阿里云 ECS 上，您可以选择通过代理访问 Gemini，或直接使用更适合国内环境的国产大模型。

### 选项一：使用国产大模型 (强烈推荐 🌟)

相比通过代理访问 Gemini，使用国产大模型（如 DeepSeek、通义千问）延迟更低，且不需要复杂的网络配置。

#### 推荐模型
1.  **DeepSeek (深度求索)**: 性价比极高，编码能力强。接口完全兼容 OpenAI。
    -   API Base: `https://api.deepseek.com/v1`
    -   API Key: 申请 `sk-xxxx`
2.  **通义千问 (Qwen)**: 阿里云原生支持，内网延迟极低。
    -   API Base: `https://dashscope.aliyuncs.com/compatible-mode/v1` (兼容模式)

#### 配置步骤
编辑 `docker-compose.prod.yml`，修改 `open-webui` 和 `n8n` 的配置：

```yaml
  open-webui:
    environment:
      # 将 OpenAI 接口指向国产模型 API
      OPENAI_API_BASE_URLS: https://api.deepseek.com/v1
      OPENAI_API_KEYS: your-deepseek-api-key
      # 如需让 Open WebUI 界面显示正确的模型名列表，它会自动获取，无需额外配置

  n8n:
    environment:
      # n8n 可以继续使用 OpenAI 节点，但 Base URL 指向 DeepSeek
      # 或者在环境变量中配置供 HTTP Request 节点使用
      DEEPSEEK_API_KEY: your-deepseek-api-key
```

### 选项二：使用 Gemini (需解决连通性)

如果您必须使用 Google Gemini，需要配置代理。

#### 修改 `docker-compose.prod.yml`
编辑文件：`nano docker-compose.prod.yml`

**1. 针对 Open WebUI**
找到 `open-webui` 服务，修改 `OPENAI_API_BASE_URLS` 指向中转地址：

```yaml
  open-webui:
    environment:
      # ...
      # 使用 Cloudflare Worker 或其他中转地址
      OPENAI_API_BASE_URLS: https://gateway.ai.cloudflare.com/v1/ACCOUNT_ID/GATEWAY/openai
```

**2. 针对 n8n 和 后端 API**
如果使用官方 SDK，通常需要设置 `HTTPS_PROXY` 环境变量：

```yaml
  n8n:
    environment:
      # ...
      # [新增] 设置代理
      HTTPS_PROXY: http://your-proxy-ip:port
      # 或者，如果您的中转服务支持 OpenAI 兼容格式，可以在 n8n 中配置 OpenAI 节点指向中转地址

  api:
    environment:
      # [新增] 设置代理
      HTTPS_PROXY: http://your-proxy-ip:port
```

> **提示**：如果没有代理服务器，建议购买一个便宜的香港 ECS 搭建 Nginx 正向代理，或者使用 Cloudflare Workers 搭建 API 中转。

---

## ▶️ 第四步：启动服务

```bash
# 启动所有服务
docker compose -f docker-compose.prod.yml up -d

# 查看日志确保无错
docker compose -f docker-compose.prod.yml logs -f
```

## 🌐 第五步：Nginx 配置与 SSL

为了通过 HTTPS 访问，建议配置 Nginx。
`docker/nginx.conf` 已经包含了基础配置。

### 申请免费 SSL 证书
在 ECS 上安装 Certbot：

```bash
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# 申请证书 (需先停止占用 80 端口的服务)
docker compose -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone -d your-domain.com

# 证书会自动存放在 /etc/letsencrypt/live/your-domain.com/
# 将证书复制到 docker/ssl 目录
mkdir -p ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/

# 重启 Nginx
docker compose -f docker-compose.prod.yml up -d nginx
```

现在，您可以通过 `https://your-domain.com` 访问系统了！
