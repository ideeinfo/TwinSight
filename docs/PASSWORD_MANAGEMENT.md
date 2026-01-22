# Twinsight 密码管理规范

本文档定义了 Twinsight 项目在不同环境下的密码和敏感信息管理方案。

## 环境分类

| 环境 | 用途 | 安全级别 | 密码管理方式 |
|------|------|----------|--------------|
| **开发环境** | 本地 Windows 开发 | 低 | 固定弱密码，便于开发 |
| **局域网环境** | Ubuntu 服务器测试 | 中 | 固定中等密码，团队共享 |
| **生产环境** | 阿里云 ECS | 高 | 强密码 + 密钥管理 |

---

## 一、密码生成规范

### 1.1 密码强度要求

| 环境 | 最小长度 | 要求 |
|------|----------|------|
| 开发 | 8 | 无特殊要求 |
| 测试 | 12 | 字母+数字 |
| 生产 | 16+ | 大小写+数字+特殊字符 |

### 1.2 生成强密码

```bash
# Linux/macOS - 生成 32 位随机密码
openssl rand -base64 32

# 或使用 pwgen
pwgen -s 32 1

# PowerShell - 生成随机密码
[System.Web.Security.Membership]::GeneratePassword(32, 8)
```

---

## 二、各环境密码配置

### 2.1 开发环境 (本地 Windows)

使用简单固定密码，便于开发调试：

```ini
# .env.local (已提交到 .gitignore)
DB_PASSWORD=password
INFLUX_PASSWORD=mis730607
N8N_PASSWORD=Mis730607
```

### 2.2 局域网环境 (Ubuntu 192.168.2.183)

使用中等强度密码，团队成员共享：

```ini
# /opt/twinsight/.env
DB_PASSWORD=Twinsight@LAN2026
INFLUX_PASSWORD=Influx@LAN2026
N8N_PASSWORD=N8n@LAN2026
```

### 2.3 生产环境 (阿里云 ECS)

**方案 A: 环境变量文件 (推荐小团队)**

```ini
# /opt/twinsight/.env (权限 600，仅 root 可读)
DB_PASSWORD=Ts#Pr0d@2026$Secure!
INFLUX_PASSWORD=Inf1ux#Pr0d@2026!
N8N_PASSWORD=N8n#Pr0d@2026$AI!
GEMINI_API_KEY=AIzaSy...实际密钥...
OPENWEBUI_API_KEY=sk-...实际密钥...
```

设置文件权限：
```bash
chmod 600 /opt/twinsight/.env
chown root:root /opt/twinsight/.env
```

**方案 B: 阿里云密钥管理服务 KMS (推荐企业级)**

1. 在阿里云控制台创建 KMS 密钥
2. 使用 KMS SDK 在应用启动时获取密钥
3. 不在服务器上存储明文密码

**方案 C: Docker Secrets (推荐 Swarm 集群)**

```bash
# 创建 secret
echo "Ts#Pr0d@2026$Secure!" | docker secret create db_password -

# 在 docker-compose.yml 中引用
services:
  postgres:
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    external: true
```

---

## 三、密钥轮换策略

### 3.1 轮换周期

| 密钥类型 | 开发环境 | 测试环境 | 生产环境 |
|----------|----------|----------|----------|
| 数据库密码 | 不轮换 | 每季度 | 每月 |
| API 密钥 | 不轮换 | 每半年 | 每季度 |
| JWT 密钥 | 不轮换 | 每季度 | 每月 |

### 3.2 轮换步骤

1. **生成新密码**
2. **更新数据库用户密码**
   ```sql
   ALTER USER postgres WITH PASSWORD 'NewPassword';
   ```
3. **更新 .env 文件**
4. **重启服务**
   ```bash
   docker compose down && docker compose up -d
   ```
5. **验证服务正常**
6. **记录轮换日志**

---

## 四、敏感信息清单

### 4.1 数据库凭证

| 服务 | 用户名 | 密码变量 | 用途 |
|------|--------|----------|------|
| PostgreSQL | postgres | `DB_PASSWORD` | 主数据库 |
| InfluxDB | admin | `INFLUX_PASSWORD` | 时序数据库 |
| InfluxDB | - | `INFLUX_TOKEN` | API 访问令牌 |

### 4.2 服务凭证

| 服务 | 用户名变量 | 密码变量 | 用途 |
|------|------------|----------|------|
| n8n | `N8N_USER` | `N8N_PASSWORD` | 工作流平台 |
| Grafana | `GRAFANA_USER` | `GRAFANA_PASSWORD` | 监控仪表盘 |

### 4.3 API 密钥

| 服务 | 变量名 | 获取方式 |
|------|--------|----------|
| Gemini | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| Open WebUI | `OPENWEBUI_API_KEY` | Open WebUI 设置页面生成 |

---

## 五、安全检查清单

### 部署前检查

- [ ] 所有密码已更改为环境特定值
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 生产环境密码符合强度要求
- [ ] API 密钥已正确配置
- [ ] 文件权限已正确设置

### 定期检查

- [ ] 密码轮换按计划执行
- [ ] 无密码泄露到代码仓库
- [ ] 日志中无敏感信息输出
- [ ] 备份文件已加密存储

---

## 六、推荐的密码管理工具

| 工具 | 适用场景 | 特点 |
|------|----------|------|
| **1Password** | 团队协作 | 共享保险库，浏览器插件 |
| **Bitwarden** | 开源自托管 | 可私有部署 |
| **阿里云 KMS** | 阿里云生产环境 | 与阿里云服务集成 |
| **HashiCorp Vault** | 企业级 | 动态密钥，审计日志 |

---

## 七、紧急响应

### 密钥泄露处理

1. **立即轮换**所有泄露的密钥
2. **检查日志**确认是否有未授权访问
3. **通知团队**成员
4. **更新所有使用该密钥的服务**
5. **复盘分析**泄露原因并改进流程
