# Phase 4 实施计划：资产联动与设施内即时编辑

## 1. 阶段目标
把模板能力从“后台配置”推进到“设施实际使用”，打通资产映射、设施页属性面板即时编辑、IoT 分类参数复用。

## 2. 本阶段范围
*   资产设置页读取模板属性并按类别分组展示。
*   支持多个模型属性字段映射为分类编码字段。
*   从设施属性面板进入模板编辑，并按 `Element` / `Specification` 过滤。
*   建立模板更新后设施待同步提示。
*   让 IoT 设备分类可复用同一套属性/分类/模板底座。
*   确保这些能力从全局 `Facilities` 页进入设施工作页，而基础数据配置统一从 `Manage` 页进入。

## 3. 主要交付物
*   接口：
    *   `GET /api/v1/facility-templates/{id}/grouped-properties`
    *   `GET /api/v1/facility-templates/{id}/contexts/{context}/properties`
    *   `POST /api/v1/assets/mapping/apply-template`
    *   `GET /api/v1/facility-templates/{id}/sync-status`
*   前端：
    *   资产映射页接入模板属性清单
    *   设施页属性面板模板快捷编辑入口
    *   模板更新提示 UI

## 3.1 推荐仓库落点
*   前端 API：`src/services/api/facilityTemplates.ts`、`src/services/api/assets.ts`
*   前端页面/组件：
    *   资产映射相关组件可复用现有 `src/components/MappingConfigPanel.vue`
    *   设施属性面板入口需接到现有 Viewer / 右侧面板链路
*   后端服务：`server/services/template-application-service.js`

## 4. 联动规则
*   资产映射页按属性类别展示模板属性。
*   `Element` 属性只进入构件标签页，`Specification` 属性只进入规格标签页。
*   模板新版本发布后，设施打开时比较 `applied_version_no` 与最新版本，提示是否更新资产数据。
*   IoT 首阶段只使用 `Element` 上下文，但底层完全复用。
*   用户登录后默认先到 `Home`，选择设施后进入设施工作页；不得把管理页当作默认首页。

## 5. 前端实现重点
*   资产映射页支持“模板属性 -> 模型属性字段”的成组映射。
*   设施属性面板打开模板编辑时自动带入当前模板、当前分类节点、当前上下文。
*   模板更新提示要区分“新增属性”“删除属性”“分类变化导致映射失效”。

## 6. 后端实现重点
*   需要提供稳定的“按类别分组”和“按上下文过滤”的模板属性接口。
*   模板更新后返回结构化差异摘要，供前端渲染提示。
*   设施应用关系尚未完全落地时，至少保留 `template_id / applied_version_no / sync_status` 语义。

## 6.1 任务拆分清单
*   后端：
    *   实现模板属性分组读取
    *   实现上下文过滤读取
    *   实现模板差异摘要接口
    *   实现设施同步状态查询
*   前端：
    *   将模板属性注入资产映射页
    *   增加设施页属性面板模板编辑快捷入口
    *   增加模板更新提示与确认交互
*   测试：
    *   资产映射联调用例
    *   设施页即时编辑入口用例
    *   更新提示流程用例

## 6.2 接口样例
```json
GET /api/v1/facility-templates/{id}/grouped-properties
{
  "templateId": "uuid-template-1",
  "versionNo": 3,
  "groups": [
    {
      "categoryName": "设备参数",
      "items": [
        {
          "propertyId": "uuid-prop-1",
          "name": "温度",
          "context": "Element"
        }
      ]
    }
  ]
}
```

```json
GET /api/v1/facility-templates/{id}/sync-status
{
  "templateId": "uuid-template-1",
  "latestVersionNo": 3,
  "appliedVersionNo": 2,
  "syncStatus": "OUTDATED",
  "diffSummary": {
    "addedProperties": 4,
    "removedProperties": 1,
    "changedNodes": 2
  }
}
```

## 6.3 非目标
*   本阶段不做完整 facility 权限体系改造。
*   本阶段不做最终设施列表/创建流程重构。

## 7. 测试清单
*   资产映射页可读取模板属性并完成保存。
*   构件页和规格页只看到对应上下文属性。
*   模板发布后设施页出现待同步提示。
*   IoT 分类可读取并显示同一套属性定义。

## 8. 完成标准
*   模板能力真正进入设施使用链路，而不是停留在配置后台。

## 9. 退出条件
*   资产映射能直接消费模板数据。
*   设施页能感知模板更新并打开局部编辑入口。
