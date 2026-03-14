# Router 重构草案

## 1. 目标
将当前扁平路由结构重构为“登录前入口 + 登录后壳层 + 一级导航子路由”的模式，支撑 `Home / Facilities / Manage` 三个顶栏入口。

## 2. 当前问题
当前 `src/router/index.js` 的主要问题：
*   `/` 直接指向 `HomeView.vue`
*   `/viewer`、`/assets` 都直接加载 `AppViewer.vue`
*   没有登录后壳层路由
*   没有 `home / facilities / manage` 的一级路由
*   没有针对“未登录访问受保护页面”的统一守卫

## 3. 目标路由结构

```ts
[
  {
    path: '/',
    name: 'PublicEntry',
    component: PublicEntryView
  },
  {
    path: '/',
    component: AppShell,
    children: [
      {
        path: 'home',
        name: 'HomeLanding',
        component: HomeLandingView,
        meta: { requiresAuth: true, topNav: 'home' }
      },
      {
        path: 'facilities',
        name: 'Facilities',
        component: FacilitiesView,
        meta: { requiresAuth: true, topNav: 'facilities' }
      },
      {
        path: 'facilities/:facilityId',
        name: 'FacilityWorkspace',
        component: FacilityWorkspaceView,
        meta: { requiresAuth: true, topNav: 'facilities' }
      },
      {
        path: 'manage',
        redirect: '/manage/properties'
      },
      {
        path: 'manage/properties',
        name: 'ManageProperties',
        component: MetadataManagementView,
        meta: { requiresAuth: true, topNav: 'manage', manageTab: 'properties' }
      },
      {
        path: 'manage/classifications',
        name: 'ManageClassifications',
        component: MetadataManagementView,
        meta: { requiresAuth: true, topNav: 'manage', manageTab: 'classifications' }
      },
      {
        path: 'manage/templates',
        name: 'ManageTemplates',
        component: MetadataManagementView,
        meta: { requiresAuth: true, topNav: 'manage', manageTab: 'templates' }
      }
    ]
  },
  {
    path: '/viewer',
    redirect: '/home'
  },
  {
    path: '/assets',
    redirect: '/home'
  }
]
```

## 4. 登录前后流转

### 4.1 登录前
*   用户打开 `/`
*   页面显示当前 `HomeView.vue` 的营销/介绍/登录入口内容

### 4.2 登录成功后
*   当前 `HomeView.vue` 中 `onLoginSuccess()` 不再跳 `/viewer`
*   改为：
    *   若存在 `redirect` query，跳回目标页
    *   否则跳 `/home`

### 4.3 未登录访问受保护路由
*   访问 `/home`、`/facilities`、`/manage/*`、`/facilities/:facilityId`
*   若未登录，则跳回 `/`
*   并附带 query：
  *   `?redirect=/manage/templates`
  *   `?redirect=/facilities/12`

## 5. 路由守卫建议

### 5.1 beforeEach
```ts
router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.isAuthenticated && localStorage.getItem('accessToken')) {
    await authStore.checkAuth();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      path: '/',
      query: { redirect: to.fullPath }
    };
  }

  if (to.path === '/' && authStore.isAuthenticated) {
    return '/home';
  }
});
```

### 5.2 设计原则
*   不在组件内部到处手写“如果登录就 push X”
*   跳转规则尽量收敛到 router 守卫
*   组件只负责表达意图，例如“登录成功”

## 6. 与现有页面的映射

### 6.1 `HomeView.vue`
*   保留为登录前入口页，名称语义上更接近 `PublicEntryView`
*   短期可不改文件名，文档中建议未来重命名

### 6.2 `AppViewer.vue`
*   保留为设施工作页的核心容器
*   由 `FacilityWorkspaceView.vue` 包一层再接入

### 6.3 `TopBar.vue`
*   不作为 router 顶层导航组件
*   继续只服务设施工作页内部工具栏

## 7. 迁移顺序
*   第一步：新增 `AppShell`、`HomeLandingView`、`FacilitiesView`、`MetadataManagementView`、`FacilityWorkspaceView`
*   第二步：扩展 router.children 结构
*   第三步：加入 beforeEach 守卫
*   第四步：修改 `HomeView.vue` 登录成功后的跳转逻辑
*   第五步：把旧 `/viewer`、`/assets` 切到兼容重定向

## 8. 验收标准
*   登录成功默认到 `/home`
*   受保护路由未登录会回 `/` 且保留 redirect
*   进入 `/manage/*` 时顶栏激活 `Manage`
*   进入 `/facilities/:facilityId` 时顶栏激活 `Facilities`

## 9. 后续可继续补充
*   路由命名规范
*   路由懒加载切分建议
*   404 与无权限页面
