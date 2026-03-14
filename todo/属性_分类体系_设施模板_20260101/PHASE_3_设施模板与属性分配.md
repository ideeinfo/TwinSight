# Phase 3 实施计划：设施模板与属性分配

## 1. 阶段目标
实现设施模板核心工作台，完成“分类节点分配属性、父子继承、复制到、属性反向视图、模板复制”全闭环。

## 2. 本阶段范围
*   新建设施模板表和节点属性直接分配关系表。
*   搭建模板主界面：左侧分类树，右侧节点视图/属性视图。
*   实现属性分配弹窗、继承查询、复制到、模板复制。
*   引入模板状态与版本字段，为后续设施应用做准备。

## 3. 主要交付物
*   数据表：`sys_facility_templates`、`rel_template_node_properties`
*   接口：
    *   `GET /api/v1/facility-templates`
    *   `POST /api/v1/facility-templates`
    *   `PUT /api/v1/facility-templates/{id}`
    *   `DELETE /api/v1/facility-templates/{id}`
    *   `GET /api/v1/facility-templates/{id}/tree`
    *   `GET /api/v1/facility-templates/{id}/nodes/{node_id}/properties`
    *   `POST /api/v1/facility-templates/{id}/nodes/{node_id}/assign`
    *   `POST /api/v1/facility-templates/{id}/nodes/{node_id}/copy-to`
    *   `GET /api/v1/facility-templates/{id}/property-view`
    *   `POST /api/v1/facility-templates/{id}/copy`

## 3.1 推荐仓库落点
*   后端路由：`server/routes/v1/facility-templates.js`
*   后端模型：`server/models/facility-template.js`
*   后端服务：`server/services/template-service.js`
*   前端 API：`src/services/api/facilityTemplates.ts`
*   前端组件：`src/components/metadata/TemplateWorkbench.vue`、`src/components/metadata/TemplatePropertyView.vue`
*   页面入口：`src/views/MetadataManagementView.vue` 或独立模板管理页

## 4. 关键业务规则
*   `rel_template_node_properties` 仅保存直接分配，不保存继承结果。
*   查询节点属性时返回 `direct`、`inherited`、`inherited_from_node_id`。
*   若属性已在上级节点直接分配，则禁止对子节点重复直接分配。
*   模板复制为深拷贝映射关系，不复制应用关系。

## 5. 前端实现重点
*   模板页是完整分栏工作台，不是弹窗。
*   左侧节点行支持名称、Badge、状态高亮、Hover 操作。
*   空节点显示空态 + `Assign Parameters` 主按钮。
*   分配器使用大尺寸 Modal，支持搜索、分组、排序、批量勾选。
*   右侧提供两种模式：
    *   节点视图：看当前节点的直接/继承属性
    *   属性视图：看所有属性的分配状态与多重分配情况

## 6. 后端实现重点
*   继承计算统一放 Service 层。
*   `copy-to` 接口返回成功、跳过、冲突统计。
*   属性反向视图需返回每个属性命中的节点列表和多重分配摘要。
*   模板状态至少包含 `Draft` / `Published`。

## 6.1 任务拆分清单
*   数据库：
    *   新建模板表与直接分配关系表
    *   增加模板版本号、状态、复制来源字段
*   后端：
    *   实现模板 CRUD
    *   实现节点有效属性查询
    *   实现分配、反分配、复制到、模板复制
    *   实现属性视角查询
*   前端：
    *   完成模板工作台布局
    *   完成空态与节点视图
    *   完成属性视图和 Popover 清单
    *   完成分配弹窗
*   测试：
    *   继承算法测试
    *   复制到冲突测试
    *   模板工作台 E2E

## 6.2 接口样例
```json
GET /api/v1/facility-templates/{id}/nodes/{nodeId}/properties
{
  "nodeId": "uuid-node-1",
  "directCount": 2,
  "effectiveCount": 5,
  "items": [
    {
      "propertyId": "uuid-prop-1",
      "name": "温度",
      "context": "Element",
      "assignedDirectly": true,
      "inheritedFromNodeId": null
    },
    {
      "propertyId": "uuid-prop-2",
      "name": "制造商",
      "context": "Specification",
      "assignedDirectly": false,
      "inheritedFromNodeId": "uuid-parent-1"
    }
  ]
}
```

```json
POST /api/v1/facility-templates/{id}/nodes/{nodeId}/copy-to
{
  "targetNodeIds": ["uuid-node-2", "uuid-node-3"]
}
```

```json
{
  "copied": 3,
  "skipped": 1,
  "conflicts": [
    {
      "targetNodeId": "uuid-node-3",
      "propertyId": "uuid-prop-2",
      "reason": "already_inherited_from_ancestor"
    }
  ]
}
```

## 6.3 非目标
*   本阶段不做设施页面内模板即时编辑。
*   本阶段不做资产数据重建。

## 7. 测试清单
*   父节点属性对子节点可见。
*   子节点重复分配继承属性时被拒绝。
*   空节点显示正确空态。
*   反向属性视图正确显示多节点分配。
*   模板复制后与源模板映射解绑。

## 8. 完成标准
*   模板配置员可以在一个页面内完成树节点分配、复制、反向检查和模板复制。

## 9. 退出条件
*   直接分配、继承展示、复制到、模板复制全部闭环。
*   属性视角与节点视角口径一致。
