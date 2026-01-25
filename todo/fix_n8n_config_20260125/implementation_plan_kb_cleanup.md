# 升级知识库重建功能以清除无效同步记录

## 目标
升级现有的 "创建知识库" (`create-kb`) 接口逻辑，使其在 `force=true` 模式下能够更彻底地清除旧的无效同步记录，确保重建后的知识库处于完全干净的状态。

## 问题分析
当前 `server/routes/files.js` 中的重建逻辑存在顺序问题：
1.  先删除了 `knowledge_bases` (父表)。
2.  再尝试根据父表 ID 删除 `kb_documents` (子表)。
   
由于父表记录已被删除，步骤 2 的子查询无法匹配到任何记录。虽然数据库层面配置了 `ON DELETE CASCADE`，但为了应对可能存在的孤儿记录（例如历史数据迁移导致的外键约束缺失或数据不一致），需要在代码层面显式地、正确地执行清理。

## 变更计划

### 后端 (Server)

#### [MODIFY] [files.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/files.js)
在 `router.post('/:id/create-kb')` 的 `force=true` 分支中优化清理逻辑：

1.  **查询现有记录**：获取当前关联的 `knowledge_bases` 记录的主键 `id` 和 `openwebui_kb_id`。
2.  **清理文档关联**：
    *   按内部主键删除：`DELETE FROM kb_documents WHERE kb_id = $1`
    *   (兜底) 按 Open WebUI ID 删除：`DELETE FROM kb_documents WHERE openwebui_kb_id = $2` (清除可能的存量孤儿数据)
3.  **删除知识库记录**：`DELETE FROM knowledge_bases WHERE id = $1`

## 验证计划
1.  手动触发重建知识库流程。
2.  验证 `kb_documents` 表中是否还有对应旧 KB 的记录残留。
