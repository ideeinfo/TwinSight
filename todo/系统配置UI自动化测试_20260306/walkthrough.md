# 系统配置 Playwright E2E 测试演练记录

## 1. 测试内容与目标
完成针对 `SystemConfigPanel.vue` (系统配置) 的端到端测试，模拟 Admin 用户登录、打开系统配置面板，并切换 5 个不同的配置页签。核心目标在于验证组件在 DOM 加载时的渲染稳定性及数据注入策略。

## 2. 遇到的主要问题与解决策略

### 2.1 Admin 权限注入失败与 `authStore` 拦截
- **问题**: 测试在初始定位 `.config-container` 时持续由于 `hasPermission('system:admin')` 鉴权失败，导致渲染 `<div class="access-denied">`，使得配置面板的主容器无法被匹配。
- **原因**: 仅通过修改 `localStorage.setItem('user')` 并不能满足 `auth.ts` 中针对 `getCurrentUser` 的接口调用逻辑，因为前端在挂载时会调用接口获取最新权限数据覆盖 `localStorage`。此外，最初我们将 Mock Route 设置为了 `/api/v1/me`，而实际上服务调用的路径是 `/api/v1/auth/me`，导致拦截未生效。
- **解决方案**: 在 `tests/system-config.spec.js` 的 `beforeEach` 钩子中，使用 `page.route` 拦截了确切的 **`**/api/v1/auth/me`** 端点以及 **`**/api/v1/system-config`**。我们在 Mock 的 `/api/v1/auth/me` 响应里确保注入了 `roles: ['admin']` 和 `permissions: ['system:admin']`，使 `SystemConfigPanel` 成功获得了系统配置界面的访问权。

### 2.2 测试加载被 Vite 热更新与长连接阻塞挂起
- **问题**: 使用默认的 `page.goto('/')` 后再 `page.goto('/viewer')`，在执行测试用例时经常被 Chromium 或相关测试挂起并中止 (Timeout / Error 130)。
- **原因**: Vue 的单页面应用在使用 `page.goto` 等待页面完成 `load` 事件时，如果存在一些轮询的长连接或者前置跳转未完成网络闲置状态，测试框架便会无限期等待。
- **解决方案**: 去除多余的 `/` 跳转并简化至只包含目标路由 `/viewer`，并给跳转指令加上 `{ waitUntil: 'domcontentloaded' }` 参数，指示在 DOM 构建后立即放行断言，而不需要等待网络请求沉寂。

### 2.3 `el-tabs` 组件的多语言及渲染机制造成 Locator 匹配超时
- **问题**: 最初的测试在 InfluxDB, LLM, Knowledge Base, Workflow 切换时采用 `.getByLabel('URL')` 或是 `page.locator('.el-tabs__item', { hasText: 'InfluxDB' })` 进行定位报错。
- **原因**: 系统支持 i18n 且 Element Plus 组件内并不含有标准的 `<label for="xxx">`，因此通过内部文本判断标签页以及定位表单的稳定性极差；并且在不同的层级渲染或者多语言切换时容易找错或者找不到。
- **解决方案**:
  1. 将判断表单项 `URL` / `Token` 渲染的方式更换成根据内部属性定位器 `page.locator('input[name="influx-url"]')` 这种确切绑定的 `name` 属性，增强了判断精度和稳定性。
  2. 舍弃使用 `hasText` 过滤标签按钮，改用 Element Plus 为 Tab 在 DOM 中生成的稳定标识：**`id="tab-llm"`**，**`id="tab-workflow"`** 等精确定位元素位置。

## 3. 最终验证结果
重构测试脚本后执行全量测试命令：`npm run test:e2e tests/system-config.spec.js`。
在 Chromium, Webkit 以及 Firefox 三种浏览器内核下均在 ~6秒 内顺利完成并 100% 测试通过。系统配置自动化测试稳定生效。
