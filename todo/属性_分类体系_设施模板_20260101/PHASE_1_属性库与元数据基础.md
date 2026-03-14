# Phase 1 实施计划：属性库与元数据基础

## 1. 阶段目标
建立“属性、属性类别、单位字典、限定值选项”的最小闭环，为后续分类体系和设施模板提供稳定元数据底座。

## 2. 本阶段范围
*   新建属性类别、属性、限定值选项相关表。
*   建立国标单位字典加载与后端校验能力。
*   实现属性 CRUD、引用保护、数据类型规则校验。
*   完成属性创建/编辑弹窗与属性选择器的最小可用版本。

## 3. 主要交付物
*   数据表：`sys_property_categories`、`sys_properties`、`sys_property_value_options`
*   常量文件：`units.json`
*   接口：
    *   `GET /api/v1/property-categories`
    *   `POST /api/v1/property-categories`
    *   `GET /api/v1/properties`
    *   `POST /api/v1/properties`
    *   `PUT /api/v1/properties/{id}`
    *   `DELETE /api/v1/properties/{id}`
    *   `GET /api/v1/properties/{id}/usage`
*   前端：
    *   属性列表页
    *   属性创建/编辑弹窗
    *   属性选择器组件

## 3.1 推荐仓库落点
*   后端路由：`server/routes/v1/properties.js`
*   后端模型：`server/models/property.js`、`server/models/property-category.js`
*   后端服务：`server/services/property-service.js`
*   前端 API：`src/services/api/properties.ts`
*   前端组件：`src/components/metadata/PropertyEditorDialog.vue`、`src/components/metadata/PropertySelector.vue`
*   类型定义：`src/types/property-template.ts`

## 4. 数据与规则
*   `name` 允许重名；`property_key` 必须唯一。
*   `context` 固定为 `Element` / `Specification`。
*   `unit_code` 仅 `Integer` / `Number` 允许。
*   `precision` 仅 `Number` 允许。
*   `allowed_values` 仅 `Text` / `Integer` / `Number` 允许。
*   `Link` 类型必须声明内部目标或外部 URL 目标。

## 5. 前端实现重点
*   单弹窗动态表单，不拆分页。
*   类别下拉支持“选择已有 + 即时新增”。
*   单位选择器支持搜索和分组。
*   限定值输入采用 Tag/Pill 风格。
*   已被模板引用时，结构字段只读。

## 6. 后端实现重点
*   单位字典双端校验，后端拒绝非法 `unit_code`。
*   属性保存前统一执行数据类型规则校验。
*   删除与结构编辑前查询引用计数，若已被模板使用则返回 `409`。
*   统一走 `/api/v1` 路由，不新增旧 `/api` 风格接口。

## 6.1 任务拆分清单
*   数据库：
    *   新建属性类别表、属性表、属性值选项表
    *   为 `property_key`、`category_id` 建索引
*   后端：
    *   实现列表、详情、创建、更新、删除、使用情况查询
    *   封装数据类型规则校验器
    *   加载并缓存 `units.json`
*   前端：
    *   完成属性列表页检索和按类别筛选
    *   完成属性编辑弹窗动态联动
    *   完成可复用的属性选择器
*   测试：
    *   校验规则单测
    *   属性编辑弹窗 E2E

## 6.2 接口样例
```json
POST /api/v1/properties
{
  "propertyKey": "temperature",
  "name": "温度",
  "categoryId": "uuid-cat-1",
  "context": "Element",
  "dataType": "Number",
  "unitCode": "20.10",
  "precision": 1,
  "allowedValues": []
}
```

```json
GET /api/v1/properties/{id}/usage
{
  "propertyId": "uuid-prop-1",
  "directTemplateNodeUsageCount": 3,
  "templateCount": 1,
  "canEditStructure": false,
  "canDelete": false
}
```

## 6.3 非目标
*   本阶段不做分类体系导入。
*   本阶段不做模板分配和继承。
*   本阶段不做设施页内即时编辑。

## 7. 测试清单
*   同名属性可创建，重复 `property_key` 被拒绝。
*   非法 `unit_code`、`precision`、`allowed_values` 组合被拒绝。
*   Link 类型缺目标配置被拒绝。
*   已引用属性无法删除、无法修改结构字段。

## 8. 完成标准
*   属性库可独立维护，且所有规则在前后端一致。
*   后续模板模块可以稳定读取属性清单、类别分组和上下文信息。

## 9. 退出条件
*   属性库 API 稳定，可被模板分配器直接消费。
*   UI 已能完成属性创建、修改、查看使用情况。
*   对非法数据组合不存在前后端口径不一致的问题。
