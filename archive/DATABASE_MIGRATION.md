# 数据库迁移说明

## ⚠️ 数据库密码认证失败

自动迁移脚本因为数据库密码认证失败无法执行。请按以下步骤手动执行迁移：

## 🔧 手动执行 SQL 迁移

### 方案 1：使用 pgAdmin 或其他数据库工具

1. 打开 pgAdmin 或您喜欢的 PostgreSQL 客户端
2. 连接到您的 `tandem` 数据库
3. 打开并执行文件：`server/db/migrations/add-spec-name.sql`

**SQL 内容：**
```sql
-- 为 asset_specs 表添加 spec_name 字段
-- 规格名称：对应构件的类型名称属性

ALTER TABLE asset_specs 
ADD COLUMN IF NOT EXISTS spec_name VARCHAR(200);

-- 添加注释
COMMENT ON COLUMN asset_specs.spec_name IS '规格名称：取自构件的类型名称属性';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_asset_specs_name ON asset_specs(spec_name);
```

### 方案 2：使用 psql 命令行

```bash
# 连接到数据库
psql -U postgres -d tandem

# 执行迁移脚本
\i server/db/migrations/add-spec-name.sql

# 退出
\q
```

### 方案 3：修正 .env.local 中的密码后重试

1. 检查 `.env.local` 文件中的数据库配置
2. 确保 `DB_PASSWORD` 正确
3. 重新运行迁移脚本：

```bash
node server/scripts/add-spec-name-migration.js
```

## ✅ 验证迁移是否成功

执行以下 SQL 查询确认字段已添加：

```sql
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'asset_specs' AND column_name = 'spec_name';
```

如果返回结果显示 `spec_name` 列，则迁移成功！

## 📝 完成后的下一步

迁移完成后：

1. 刷新浏览器页面
2. 点击"提取并导出数据"按钮
3. 查看控制台日志，确认：
   - 资产数量（应该 > 0）
   - 空间数量（应该 > 0）
   - 数据库导入成功

## 🆘 如果仍有问题

请检查以下内容：

1. **空间提取失败（0 个空间）**
   - 查看浏览器控制台日志中"第一个房间的前20个属性"
   - 根据实际属性调整 `DataExportPanel.vue` 中的 `spaceMapping` 配置

2. **数据库约束错误**
   - 确认所有迁移都已执行
   - 检查 `server/db/schema.sql` 与实际数据库表结构是否一致
