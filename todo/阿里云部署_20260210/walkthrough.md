# 阿里云部署与数据迁移 Walkthrough

> **完成时间**: 2026-02-10
> **目标**: 将 TwinSight 迁移至阿里云 Ubuntu 24.04 服务器，并通过 demo.twinsight.cn 提供服务。

## 1. 部署文件清单

已创建并推送到仓库的文件：

| 文件路径 | 用途 |
|---|---|
| `docker/docker-compose.cloud.yml` | 生产环境编排，端口绑定 127.0.0.1，数据挂载命名卷 |
| `docker/nginx-cloud.conf` | 宿主机 Nginx 完整配置，含 SSL 和反向代理 |
| `docker/.env.cloud.example` | 环境变量模板 |
| `.github/workflows/deploy.yml` | GitHub Actions 自动部署 (SSH) |
| `scripts/deploy-cloud.sh` | 本地一键部署脚本 |
| `scripts/backup-183.sh` | 旧服务器数据导出脚本 |

## 2. 关键配置说明

### Nginx 反向代理
采用子域名方案，SSL 证书由 Certbot 管理：
- `demo.twinsight.cn` -> Node API (3001)
- `n8n.twinsight.cn` -> n8n (5678)
- `ai.twinsight.cn` -> Open WebUI (8080)
- `nodered.twinsight.cn` -> Node-RED (1880)
- `grafana.twinsight.cn` -> Grafana (3000)

### 数据迁移方案
使用 Docker 命名卷物理备份方式迁移 InfluxDB，确保 Token 和元数据完全一致：
1. 192.168.2.183: `docker run ... tar czf /backup/influx_full_backup.tar.gz ...`
2. Aliyun: `docker run ... tar xzf /backup/influx_full_backup.tar.gz ...`

## 3. 验证
CICD 工作流已配置，推送到 `main` 分支后自动触发部署。
