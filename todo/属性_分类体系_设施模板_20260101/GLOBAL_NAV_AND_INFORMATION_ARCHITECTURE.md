# 全局导航与信息架构设计稿

## 1. 目标
围绕新增的顶栏一级导航 `Home / Facilities / Manage`，把 TwinSight 的登录后页面结构重组为清晰的信息架构，使“首页、设施管理、基础数据管理、设施工作页”各自边界明确。

## 2. 当前代码现状
基于当前仓库，登录后页面结构存在以下问题：
*   `src/router/index.js` 目前只有 `/`、`/viewer`、`/assets` 等少量路由。
*   `/` 当前直接指向 `HomeView.vue`，更多是营销/登录落点，不是登录后系统首页。
*   `TopBar.vue` 当前只存在于 `AppViewer.vue` 内部，不是全局登录后导航。
*   `HomeView.vue` 和登录弹窗成功回调当前直接跳转 `/viewer`，这与“登录后先进入 Home，再选择设施”的目标流程冲突。
*   因此如果直接追加 `Home / Facilities / Manage`，会出现“只有 Viewer 页面有标题栏，其他页面没有”的结构不一致问题。

## 3. 目标信息架构

### 3.1 一级入口
*   `Home`
    *   登录后默认页
    *   展示系统首页内容、最近访问设施、设施快捷入口
*   `Facilities`
    *   设施列表
    *   创建设施
    *   编辑设施
    *   进入某个设施
*   `Manage`
    *   属性库管理
    *   分类体系管理
    *   设施模板管理

### 3.2 二级页面
*   `Facilities/:facilityId`
    *   进入设施工作页
    *   可进一步承接现有 Viewer / 资产 / 文档 / 物联等能力
*   `Manage/properties`
*   `Manage/classifications`
*   `Manage/templates`

## 4. 推荐路由结构

### 4.1 路由表草案
```text
/
  -> 登录前：展示登录入口
  -> 登录后：重定向到 /home

/home
  -> HomeLandingView

/facilities
  -> FacilitiesView

/facilities/:facilityId
  -> FacilityWorkspaceView
  -> 内部可复用现有 AppViewer

/manage
  -> redirect /manage/properties

/manage/properties
  -> MetadataManagementView (properties tab)

/manage/classifications
  -> MetadataManagementView (classifications tab)

/manage/templates
  -> MetadataManagementView (templates tab)
```

### 4.2 最小改造原则
*   保留现有 `AppViewer.vue` 作为设施工作页核心容器。
*   不强制一次性重写所有旧路由，但新顶栏必须基于新路由结构工作。
*   旧 `/viewer` 可在迁移期短暂保留，并重定向到 `/facilities/:facilityId`。

## 5. 页面职责边界

### 5.1 Home
*   不是设施管理后台。
*   不是属性/模板配置页。
*   只负责“系统首页 + 快速进入设施”。

### 5.2 Facilities
*   负责设施对象本身的管理：
    *   列表
    *   创建
    *   编辑
    *   删除
    *   进入设施
*   不直接承载属性、分类体系、设施模板管理。

### 5.3 Manage
*   负责基础数据管理：
    *   属性
    *   分类体系
    *   设施模板
*   不承担设施列表管理职责。

### 5.4 Facility Workspace
*   是用户进入某个设施后的工作页。
*   可包含模型、资产、文档、物联、视图等设施相关功能。
*   允许从设施属性面板局部打开模板编辑，但不等于 `Manage` 页面本身。

## 6. 顶栏导航设计

### 6.1 组件结构建议
*   `AppShell`
    *   `AppTopNav`
    *   `router-view`

### 6.2 顶栏行为
*   Logo 点击返回 `/home`
*   `Home` 点击跳转 `/home`
*   `Facilities` 点击跳转 `/facilities`
*   `Manage` 点击跳转 `/manage/properties` 或上次访问的管理子页
*   当前路由所在一级入口高亮

### 6.3 顶栏状态
*   登录后显示
*   登录前可不显示完整导航，或仅显示简化版头部
*   在设施工作页中仍显示全局导航，确保可随时切回 `Home` 或 `Manage`

## 7. 登录后主流程

### 7.1 标准流程
1. 用户打开系统。
2. 未登录时停留在登录入口页。
3. 登录成功后跳转 `/home`。
4. 用户从 `Home` 选择设施，进入 `/facilities/:facilityId`。
5. 用户如需维护属性、分类体系、设施模板，则通过 `Manage` 进入后台配置页。

### 7.2 非标准流程
*   若用户直接访问 `/manage/*` 或 `/facilities/:facilityId`，未登录则先跳登录。
*   登录成功后可跳回原目标页；若没有原目标页，则回 `/home`。

## 8. 与现有代码的接入建议

### 8.1 Router
*   扩展 `src/router/index.js`
*   引入嵌套路由：
    *   `AppShell` 作为登录后壳层
    *   子路由挂 `home / facilities / manage`

### 8.2 App
*   `src/App.vue` 保持最薄，只做 provider 与最外层 `router-view`
*   不把导航直接塞进 `App.vue`，避免登录前后逻辑混乱

### 8.3 TopBar
*   当前 `src/components/TopBar.vue` 偏设施工作页工具栏
*   不建议直接在其上硬塞 `Home / Facilities / Manage`
*   应拆出新的全局导航组件 `AppTopNav.vue`
*   `TopBar.vue` 可继续保留为设施工作页内部工具栏

### 8.4 Viewer
*   `AppViewer.vue` 继续服务于设施工作页
*   但路由入口应从“孤立 viewer 页”转为“某个设施下的工作页”

## 9. 页面与组件建议

### 9.1 新增视图
*   `src/views/HomeLandingView.vue`
*   `src/views/FacilitiesView.vue`
*   `src/views/MetadataManagementView.vue`
*   `src/views/FacilityWorkspaceView.vue`

### 9.2 新增布局组件
*   `src/components/layout/AppShell.vue`
*   `src/components/layout/AppTopNav.vue`

### 9.3 复用现有组件
*   设施工作页继续复用 `AppViewer.vue`
*   基础数据管理页继续复用本轮规划的 metadata 组件

## 10. 实施顺序建议
*   第一步：建立新路由和 `AppShell`
*   第二步：实现 `AppTopNav`
*   第三步：接入 `HomeLandingView`、`FacilitiesView`、`MetadataManagementView`
*   第四步：将现有 Viewer 挂接到设施工作页路由
*   第五步：再接入属性、分类体系、设施模板的具体内容

## 11. 验收标准
*   登录后默认进入 `/home`
*   顶栏始终显示 `Home / Facilities / Manage`
*   `Facilities` 只负责设施管理
*   `Manage` 只负责属性、分类体系、设施模板管理
*   进入某个设施后仍可通过顶栏切换其他一级入口

## 12. 后续可继续细化的内容
*   路由守卫与登录回跳规则
*   顶栏 active 状态规则
*   Facilities 页线框图
*   Home 页设施卡片布局
*   `AppShell` 与 `AppTopNav` 的组件接口草案
