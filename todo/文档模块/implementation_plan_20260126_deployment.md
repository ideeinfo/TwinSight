# 文档模块 P2 部署自动化实施计划

## 目标
实现 `server/db/migrations/document_module_p2.sql` 脚本在 Railway 部署时的自动执行，确保数据库结构与代码同步。

## 用户审查要求
> [!IMPORTANT]
> 此变更修改了服务器的启动命令。虽然这在 Railway 等容器化环境中是标准做法，但如果在本地开发环境直接运行 `npm start`，也会触发迁移检查。

## 提议变更

### 后端 (Server)

#### [NEW] [migrate.js](file:///Volumes/DATA/Qoder/TwinSight/server/scripts/migrate.js)
创建一个轻量级的迁移运行脚本，逻辑如下：
1.  连接数据库。
2.  检查/创建 `_migrations` 表（记录已运行的迁移文件）。
3.  扫描 `db/migrations` 目录下的所有 `.sql` 文件。
4.  按文件名排序，对比 `_migrations` 表。
5.  执行未运行的 SQL 脚本，并记录到 `_migrations` 表。
6.  如果在 Docker/Railway 环境中（通过 `NODE_ENV=production` 或特定环境变量判断），失败时退出进程。

#### [MODIFY] [package.json](file:///Volumes/DATA/Qoder/TwinSight/server/package.json)
修改 `start` 脚本，在启动服务器前先运行迁移：
```diff
- "start": "node index.js",
+ "start": "node scripts/migrate.js && node index.js",
```

## 验证计划

### 自动化测试
1.  **本地模拟运行**:
    - 设置环境变量连接本地测试数据库。
    - 运行 `node server/scripts/migrate.js`。
    - 验证 `document_tags` 等表是否成功创建。
    - 再次运行脚本，验证是否跳过已运行的迁移。

### 手动验证
1.  查看 Railway 部署日志（如果用户提供权限，或者在这里模拟）：确认启动日志中包含迁移成功的输出 `✅ Migration document_module_p2.sql executed`。
