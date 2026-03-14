# 前端页面与组件结构草案

## 1. 目标
将“属性、分类体系、设施模板”模块映射到当前 TwinSight 前端结构，避免后续实现时页面入口、组件边界、状态流混乱。

## 2. 页面入口建议

### 2.1 顶栏全局导航
*   建议新增全局标题栏组件：`src/components/layout/AppTopNav.vue`
*   建议新增登录后壳层组件：`src/components/layout/AppShell.vue`
*   登录后标题栏提供三个一级入口：
    *   `Home`
    *   `Facilities`
    *   `Manage`
*   该导航在登录后的主页面保持一致显示。

### 2.2 首页入口
*   建议新增页面：`src/views/HomeLandingView.vue`
*   页面职责：
    *   作为登录后的默认落点
    *   展示系统首页信息与设施入口
    *   支持从首页选择进入某个设施

### 2.3 设施页入口
*   建议新增页面：`src/views/FacilitiesView.vue`
*   页面职责：
    *   展示设施列表
    *   提供创建设施、编辑设施、进入设施详情的统一入口

### 2.4 元数据管理主入口
*   建议新增页面：`src/views/MetadataManagementView.vue`
*   页面职责：
    *   承载三个一级 Tab：`属性库`、`分类体系`、`设施模板`
    *   管理公共筛选条件、基础 loading 状态和错误提示
    *   负责路由参数与子页面状态同步

### 2.5 设施内局部编辑入口
*   不新增独立页面，挂到现有设施属性面板链路。
*   建议在属性面板中打开 `TemplateInlineEditorDialog` 或复用 `TemplateWorkbench` 的局部模式。

## 3. 组件树建议

### 3.1 顶栏与一级页面
*   `AppShell`
*   `AppTopNav`
*   `HomeLandingPage`
*   `FacilityListPage`
*   `FacilityCardGrid`
*   `FacilityCreateDialog`
*   `FacilityWorkspaceEntry`

### 3.2 属性库 Tab
*   `PropertyLibraryPage`
*   `PropertyToolbar`
*   `PropertyTable`
*   `PropertyEditorDialog`
*   `PropertySelector`
*   `PropertyUsageDialog`

### 3.3 分类体系 Tab
*   `ClassificationSchemaPage`
*   `ClassificationSchemaTable`
*   `ClassificationImportDialog`
*   `ClassificationPreviewTable`
*   `ClassificationTree`
*   `ClassificationFlatTable`

### 3.4 设施模板 Tab
*   `FacilityTemplatePage`
*   `TemplateWorkbench`
*   `TemplateTreePanel`
*   `TemplateNodePropertyPanel`
*   `TemplatePropertyView`
*   `AssignPropertiesDialog`
*   `CopyToDialog`

## 4. 关键组件职责

### 4.1 `PropertyEditorDialog`
*   单弹窗动态表单
*   负责数据类型联动、单位选择、限定值录入
*   不负责列表刷新，由父层在成功后触发 reload

### 4.2 `ClassificationImportDialog`
*   负责上传、预览、错误展示、确认导入
*   与后端的 `preview/commit` 两段式接口直接对应

### 4.3 `TemplateWorkbench`
*   页面级容器，不做具体业务计算
*   只维护：
    *   当前模板
    *   当前节点
    *   当前右侧视图模式
    *   分配弹窗开关状态

### 4.4 `TemplateTreePanel`
*   渲染左侧分类树
*   显示节点名称、Badge、状态色、Hover 操作
*   不自行计算继承，只消费 API 返回的聚合数据

### 4.5 `TemplateNodePropertyPanel`
*   展示当前节点直接分配与继承属性
*   负责空态、局部移除、打开分配弹窗

### 4.6 `TemplatePropertyView`
*   展示“属性 -> 节点”反向分配视图
*   支持 `+N more` 和 Hover Popover
*   每行提供快速编辑入口

## 5. 状态管理建议

### 5.1 可直接本地状态管理的内容
*   列表页搜索关键词
*   当前选中节点
*   当前弹窗开关
*   当前右侧视图模式
*   顶栏当前激活入口

### 5.2 建议抽成 composable 的内容
*   `useAppNavigation`
*   `useFacilities`
*   `useProperties`
*   `useClassificationSchemas`
*   `useFacilityTemplates`
*   `useTemplateWorkbench`

### 5.3 不建议进入全局 Pinia 的内容
*   模板页的局部选中节点
*   导入预览临时数据
*   分配弹窗临时勾选状态

## 6. API 调用层建议
*   `src/services/api/properties.ts`
*   `src/services/api/classificationSchemas.ts`
*   `src/services/api/facilityTemplates.ts`

每个文件只负责领域接口封装，不混入页面状态逻辑。

## 7. 与现有组件的复用建议
*   资产映射阶段可复用 [MappingConfigPanel.vue](/Volumes/DATA/antigravity/TwinSight/src/components/MappingConfigPanel.vue) 的“字段映射表格”交互模式。
*   搜索下拉可参考仓库现有 `SearchableSelect` 能力，但模板分配器不应退化成简单下拉。
*   主题风格沿用当前深色/浅色主题 token，不额外造一套样式系统。

## 8. 页面状态流

### 8.0 登录后主流程
1. 用户登录成功。
2. 默认跳转到 `Home`。
3. 用户可从顶栏切换到 `Facilities` 或 `Manage`。
4. 用户在 `Home` 或 `Facilities` 选择某个设施后，进入设施工作页。
5. 用户在 `Manage` 中维护属性、分类体系、设施模板。

### 8.3 路由壳层建议
1. `App.vue` 保持最薄，只负责 `router-view` 和全局 provider。
2. 登录后页面统一挂到 `AppShell` 下，由 `AppShell` 渲染 `AppTopNav + 子路由内容区`。
3. 设施工作页可继续复用现有 `AppViewer.vue`，但路由入口从旧 `/viewer` 迁移到新的设施工作路径。

### 8.1 模板工作台
1. 页面进入，加载模板列表。
2. 选择模板后加载左侧树聚合数据。
3. 默认进入 `属性视图` 或恢复上次视图模式。
4. 选中节点后加载节点有效属性。
5. 打开分配弹窗，选择属性并提交。
6. 成功后刷新树聚合计数和右侧当前视图。

### 8.2 分类体系导入
1. 上传文件。
2. 调用 preview。
3. 展示错误或预览表格。
4. 用户确认后调用 commit。
5. 返回列表页并刷新。

## 9. 组件设计约束
*   树节点必须支持大数量渲染，必要时引入虚拟滚动。
*   分配弹窗必须支持搜索、分组、排序、批量勾选四种操作并存。
*   右侧属性视图和节点视图的数据模型要可切换，但不能共用一份混乱的列表状态。

## 10. 后续可继续补充的设计产物
*   每个页面的线框图
*   组件 props / emits 表
*   与后端响应模型一一对应的 TypeScript 类型文件
*   router 重构草案
*   `AppShell` / `AppTopNav` 组件接口说明
