# 文档模块 P2 - 自动化部署验证文档

## 1. 变更摘要
为确保 Railway 部署时自动执行数据库迁移，实施了以下变更：

- **自动化脚本**: 创建 `server/scripts/migrate.js`，实现迁移文件的自动扫描与执行。
- **启动配置**: 修改 `server/package.json` 的 `start` 命令，增加 `node scripts/migrate.js` 前置步骤。
- **迁移文件管理**: 将 `server/db/migrations/document_module_p2.sql` 移动并重命名为 `server/migrations/006_document_module_p2.sql`，纳入统一版本管理。
- **自动关联逻辑优化**: 修改 `server/services/document-matching-service.js`，引入文件名模糊匹配逻辑（>=4个连续字符重合即视为关联）。

## 2. 验证结果

### 2.1 迁移脚本逻辑
- [x] **幂等性**: 脚本会检查 `_migrations` 表，跳过已执行的文件。
- [x] **安全性**: 现有 SQL 脚本 (004, 005, 006) 均包含 `IF NOT EXISTS` 保护，即使首次部署时未记录状态，重复执行也不会报错。
- [x] **原子性**: 单个迁移文件在事务中运行，失败自动回滚。

### 2.2 部署流程模拟
1.  **构建阶段**: Dockerfile 构建不受影响。
2.  **启动阶段**:
    - 系统启动 -> 执行 `npm start`
    - -> 运行 `migrate.js` -> 成功 -> 输出 `✅ ...`
    - -> 运行 `node index.js` -> 服务器上线

### 2.3 模糊匹配逻辑验证
- [x] **精确匹配**: 包含完整 Asset Code 的文件名 (e.g., `TESTUNIQUE-001_Report`) 正确匹配，置信度 80%+。
- [x] **模糊名称匹配**: 文件名包含资产/空间名称的连续子串 (>=4 chars, e.g., `SpecialHandlingUnit`) 正确匹配，置信度 85%。
- [x] **无关文件**: 无关名称文件正确返回无匹配。
- [x] **验证脚本**: `scripts/test-matching.js` 全部 4 个测试用例通过。

## 3. 回滚计划
如果部署失败，Railway 会自动回滚到上一个成功部署的版本。
如需手动回滚数据库变更，需编写对应的 down-migration 脚本（当前阶段未包含，依赖备份）。

## 4. 后续建议
- 监控首次部署日志，确认迁移成功日志输出。
- 将来建议引入专门的迁移工具（如 `node-pg-migrate` 或 `Knex`）以获得更强大的回滚和状态管理能力。
