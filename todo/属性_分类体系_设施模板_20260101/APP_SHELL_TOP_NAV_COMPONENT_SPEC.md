# AppShell / AppTopNav 组件接口草案

## 1. 目标
定义登录后全局壳层 `AppShell` 与标题栏组件 `AppTopNav` 的职责、接口和与现有 `TopBar.vue` 的边界，避免后续出现双顶栏和状态重复管理。

## 2. 组件边界

### 2.1 `AppShell`
职责：
*   登录后页面统一壳层
*   渲染全局顶栏
*   承载子路由内容
*   可放全局面包屑、页面容器、统一 loading/error 占位

不负责：
*   设施工作页内部工具栏按钮
*   属性/分类/模板页面的具体业务逻辑

### 2.2 `AppTopNav`
职责：
*   展示 logo
*   展示一级导航：`Home / Facilities / Manage`
*   展示用户菜单入口
*   展示当前激活入口
*   响应导航点击并跳路由

不负责：
*   设施工作页内部“视图切换、通知、手册”等 Viewer 工具栏按钮
*   业务侧边栏

### 2.3 `TopBar.vue`
职责保留：
*   设施工作页工具栏
*   视图按钮、当前视图名称、帮助、用户下拉等 viewer 内工具

约束：
*   不能承担全局一级导航职责

## 3. 推荐结构

```vue
<AppShell>
  <AppTopNav />
  <RouterView />
</AppShell>
```

设施工作页内部：

```vue
<FacilityWorkspaceView>
  <AppViewer>
    <TopBar />
  </AppViewer>
</FacilityWorkspaceView>
```

## 4. `AppShell` 接口草案

### 4.1 Props
*   无必须 props，优先通过 router/store 驱动

### 4.2 内部状态来源
*   `useAuthStore()`
*   `useRoute()`
*   `useRouter()`

### 4.3 责任
*   判断当前是否为登录后受保护页面
*   决定是否显示 `AppTopNav`
*   统一内容区布局宽度、内边距、滚动容器

## 5. `AppTopNav` 接口草案

### 5.1 Props
```ts
interface AppTopNavProps {
  activeKey?: 'home' | 'facilities' | 'manage'
}
```

实际实现建议：
*   优先直接由 `useRoute().meta.topNav` 推导
*   不要求父组件手动传 `activeKey`

### 5.2 Emits
```ts
type AppTopNavEmits = {
  navigate: [key: 'home' | 'facilities' | 'manage']
}
```

但更建议：
*   组件内部直接 `router.push`
*   不强依赖父组件转发导航事件

### 5.3 展示元素
*   Logo
*   一级导航项
*   右侧用户菜单
*   可选：全局通知入口

## 6. 状态映射规则

### 6.1 激活态
*   `/home` => `home`
*   `/facilities`、`/facilities/:facilityId` => `facilities`
*   `/manage/*` => `manage`

### 6.2 点击行为
*   点击 `Home` => `/home`
*   点击 `Facilities` => `/facilities`
*   点击 `Manage` => `/manage/properties` 或用户上次停留的管理子页

### 6.3 Logo 行为
*   登录后点击 logo => `/home`
*   未登录状态点击 logo => `/`

## 7. 与现有 `TopBar.vue` 的关系

### 7.1 共存策略
*   `AppTopNav`：全局一级导航
*   `TopBar.vue`：设施工作页内部工具栏

### 7.2 避免重复
以下内容只保留一份：
*   Logo：放在 `AppTopNav`
*   一级导航：放在 `AppTopNav`

以下内容继续留在 `TopBar.vue`：
*   当前视图名称
*   Views 面板按钮
*   Viewer 内帮助/工具按钮

## 8. 布局建议

### 8.1 非设施工作页
```text
AppTopNav
--------------------------------
Page Content
```

### 8.2 设施工作页
```text
AppTopNav
--------------------------------
TopBar (viewer tools)
--------------------------------
AppViewer content
```

## 9. 视觉与交互要求
*   顶栏一级导航使用明显 active 状态
*   与现有深色主题兼容
*   导航项文案固定为：
    *   `Home`
    *   `Facilities`
    *   `Manage`
*   在小屏下允许折叠为菜单，但桌面优先显示完整文本导航

## 10. 实施顺序
*   第一步：新增 `AppShell.vue`
*   第二步：新增 `AppTopNav.vue`
*   第三步：router meta 增加 `topNav`
*   第四步：在设施工作页保留 `TopBar.vue`
*   第五步：清理旧的“logo 直接跳 /viewer”之类逻辑

## 11. 验收标准
*   登录后所有主页面都显示统一顶栏
*   顶栏 active 状态与路由一致
*   设施工作页同时存在 `AppTopNav + TopBar`，且职责不冲突
*   没有页面因为新增全局导航而丢失原有 viewer 工具栏能力
