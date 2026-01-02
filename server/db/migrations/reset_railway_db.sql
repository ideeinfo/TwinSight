-- ========================================
-- Railway 数据库结构修复迁移脚本
-- 用于将错误创建的表结构更新为正确结构
-- 注意：此脚本会删除现有数据，请先备份！
-- ========================================

-- 删除所有表（按依赖顺序反向删除）
DROP TABLE IF EXISTS kb_documents CASCADE;
DROP TABLE IF EXISTS knowledge_bases CASCADE;
DROP TABLE IF EXISTS document_exif CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS mapping_configs CASCADE;
DROP TABLE IF EXISTS views CASCADE;
DROP TABLE IF EXISTS influx_configs CASCADE;
DROP TABLE IF EXISTS spaces CASCADE;
DROP TABLE IF EXISTS classifications CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS asset_specs CASCADE;
DROP TABLE IF EXISTS model_files CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- 删除函数
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 现在运行 init-all.sql 的内容...
-- （请在运行此脚本后，接着运行 init-all.sql）

SELECT 'All tables dropped. Please run init-all.sql next.' as status;
