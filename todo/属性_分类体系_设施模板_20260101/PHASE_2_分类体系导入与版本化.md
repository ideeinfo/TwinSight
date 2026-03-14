# Phase 2 实施计划：分类体系导入与版本化

## 1. 阶段目标
将当前项目中“扁平 classifications 表”的能力，与“分类体系定义 + 树结构 + 导入校验 + 版本管理”彻底分离，建立面向模板配置的正式分类体系子系统。

## 2. 本阶段范围
*   新建分类体系与分类节点表。
*   实现 CSV/XLSX 上传、预览、校验、正式导入。
*   实现树查询、编码/描述搜索、Excel 导出。
*   引入版本化与已引用保护策略。

## 3. 主要交付物
*   数据表：`sys_classification_schemas`、`sys_classification_nodes`
*   接口：
    *   `POST /api/v1/classification-schemas/import/preview`
    *   `POST /api/v1/classification-schemas/import/commit`
    *   `GET /api/v1/classification-schemas`
    *   `GET /api/v1/classification-schemas/{id}`
    *   `GET /api/v1/classification-schemas/{id}/tree`
    *   `GET /api/v1/classification-schemas/{id}/export`
    *   `PUT /api/v1/classification-schemas/{id}`
    *   `DELETE /api/v1/classification-schemas/{id}`

## 3.1 推荐仓库落点
*   后端路由：`server/routes/v1/classification-schemas.js`
*   后端模型：`server/models/classification-schema.js`
*   后端服务：`server/services/classification-schema-service.js`
*   前端 API：`src/services/api/classificationSchemas.ts`
*   前端组件：`src/components/metadata/ClassificationImportDialog.vue`、`src/components/metadata/ClassificationTree.vue`

## 4. 数据与规则
*   体系与节点全部使用 UUID。
*   同一体系版本内编码唯一。
*   `Level` 必须连续，不允许跳级。
*   非根节点父级必须存在于前序记录中。
*   已被模板引用的体系禁止删除。
*   已发布且被引用的体系重新上传时生成新版本，不做原地覆盖。

## 5. 前端实现重点
*   上传页采用“两步式导入”：预览后确认。
*   错误按行高亮，返回 `row_no + column + message`。
*   列表页显示名称、版本号、节点数、引用模板数、更新时间。
*   详情页提供树视图和表格视图两种浏览方式。

## 6. 后端实现重点
*   支持 CSV 与 XLSX 两种解析链路。
*   统一清洗 BOM、全角空格、尾部空格、空行。
*   将导入错误结构化输出，便于前端精确高亮。
*   为 `schema_id + code`、`schema_id + path` 建索引。

## 6.1 任务拆分清单
*   数据库：
    *   新建分类体系表与节点表
    *   增加版本号、状态、来源文件字段
*   后端：
    *   实现预览解析器
    *   实现正式导入事务
    *   实现树查询、搜索、导出
    *   实现已引用删除保护与新版本创建策略
*   前端：
    *   完成上传、预览、错误表格
    *   完成列表页、详情页、双视图浏览
*   测试：
    *   CSV/XLSX 双格式解析测试
    *   版本切换与引用保护测试

## 6.2 接口样例
```json
POST /api/v1/classification-schemas/import/preview
{
  "name": "OmniClass 2026",
  "fileToken": "upload-token-1"
}
```

```json
{
  "ok": false,
  "errors": [
    {
      "rowNo": 12,
      "column": "Level",
      "message": "Level 3 的父级 Level 2 不存在"
    }
  ],
  "previewRows": []
}
```

## 6.3 非目标
*   本阶段不做模板节点属性分配。
*   本阶段不做设施应用关系。

## 7. 测试清单
*   缺列、重复编码、层级跳级、缺父级均在预览阶段拦截。
*   导出结果可以再次导入。
*   已被模板引用的体系删除失败。
*   已发布体系重传时正确生成新版本。

## 8. 完成标准
*   分类体系可被模板稳定引用，且后续结构调整不会悄悄破坏存量模板。

## 9. 退出条件
*   导入、预览、导出、树查询全部可用。
*   已引用体系的删除/重传策略稳定。
