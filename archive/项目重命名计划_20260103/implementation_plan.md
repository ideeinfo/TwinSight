# 项目重命名计划：tandem-demo → twinsight

## 目标
将项目从 `tandem-demo` 统一重命名为 `twinsight`，确保生产环境使用一致的命名。

---

## 修改范围总览

| 类别 | 影响范围 | 风险等级 |
|------|----------|----------|
| 1. package.json | 项目名称 | 低 |
| 2. docker-compose | 容器名、网络名 | 中 |
| 3. 环境变量文件 | 数据库名、Bucket名 | 中 |
| 4. 文档 | 说明文档 | 低 |
| 5. Railway 配置 | 服务名、变量 | 低 |
| 6. 数据库 | 数据库名、表数据 | 高 |
| 7. InfluxDB | Bucket名 | 高 |
| 8. GitHub 仓库 | 仓库名 | 中 |

---

## 阶段 1：代码和配置文件修改（低风险）

### 1.1 package.json
- [x] `package.json` → `"name": "twinsight"`
- [x] `server/package.json` → `"name": "twinsight-server"`

### 1.2 docker-compose.yml
- [x] `name: tandem-demo` → `name: twinsight`
- [x] `container_name: tandem-postgres` → `container_name: twinsight-postgres`
- [x] `container_name: tandem-n8n` → `container_name: twinsight-n8n`
- [x] `container_name: tandem-open-webui` → `container_name: twinsight-open-webui`
- [x] `tandem-network` → `twinsight-network`
- [x] `POSTGRES_DB: tandem` → `POSTGRES_DB: twinsight`
- [x] `DOCKER_INFLUXDB_INIT_BUCKET: tandem` → `DOCKER_INFLUXDB_INIT_BUCKET: twinsight`
- [x] `WEBUI_NAME=Tandem AI` → `WEBUI_NAME=Twinsight AI`

### 1.3 环境变量文件
- [x] `.env.local` → `DB_NAME=twinsight`
- [x] `server/.env` → `DB_NAME=twinsight`
- [x] `docker/.env.example` → 更新相关引用
- [x] `docker/.env.production.example` → 更新所有 tandem 引用

---

## 阶段 2：代码引用修改（低风险）

### 2.1 n8n 服务配置
- [x] `server/services/n8n-service.js` → 更新 metadata.source

### 2.2 其他代码文件
- [x] 搜索并替换所有 `tandem-demo` → `twinsight`
- [x] 搜索并替换所有 `Tandem` (知识库名/注释) → `Twinsight`

---

## 阶段 3：文档更新（低风险）

- [x] `server/README.md` → 更新项目名和数据库名
- [x] `docker/README.md` → 更新所有引用
- [x] `CLOUD_DEPLOYMENT_GUIDE.md` → 更新所有引用
- [ ] 其他 .md 文件 (归档文档不需要修改)

---

## 阶段 4：Railway 配置（中风险）

> ⚠️ 需要在 Railway 控制台手动操作

- [x] 更新 tandem-demo 服务的环境变量
- [x] 确认 DATABASE_URL 中的数据库名
- [x] 确认 INFLUX_BUCKET 环境变量

---

## 阶段 5：数据库迁移（高风险）

> ⚠️ 影响生产数据，需要先备份

### 5.1 PostgreSQL
- [x] 创建新数据库 `twinsight`（通过重命名 `tandem`）
- [x] 迁移数据从 `tandem` 到 `twinsight`
- [x] 更新连接字符串

### 5.2 InfluxDB
- [ ] 创建新 Bucket `twinsight`
- [ ] 迁移数据从 `tandem` 到 `twinsight`
- [ ] 更新所有 Bucket 引用

---

## 阶段 6：GitHub 仓库重命名（中风险）

- [ ] 在 GitHub 仓库设置中重命名为 `twinsight`
- [ ] 更新本地 remote URL
- [ ] 更新 Railway 的 GitHub 连接

---

## 执行顺序建议

1. **先执行阶段 1-3**（代码和配置修改）
2. **本地测试**确保一切正常
3. **执行阶段 4**（Railway 配置）
4. **备份数据后执行阶段 5**（数据库迁移）
5. **最后执行阶段 6**（GitHub 重命名）

---

## 待确认事项

1. 是否需要保留旧数据库/Bucket 作为备份？
2. Railway 上的数据库是否需要重建？
3. 是否有其他需要通知的依赖方？
