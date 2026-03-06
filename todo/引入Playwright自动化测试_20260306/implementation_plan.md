# 引入 Playwright 自动化测试实施计划 (Implementation Plan)

## 1. 目标与背景 (Goal & Context)
为项目引入 Playwright 作为前端页面的端到端（E2E）测试框架。此举旨在搭建自动化测试的基础路线，使得后续功能迭代后，不仅能自动跑测试，还能在测试失败时获取报错、截图等上下文，便于使用大模型（AI Agent）进行自动化代码修复。
本次实施重心在于**环境集成**和**编写基础范例**。

## 2. 设计规范检查 (Design Compliance Check)
> **重要**：在编写任何代码之前，请必须对照 `UI_DESIGN_SPEC.md` 进行核查。

- [x] **规范复习**: 本次不涉及 UI 改动，仅增加测试配置。
- [x] **Token 使用**: N/A
- [x] **组件选择**: N/A
- [x] **主题支持**: N/A

## 3. 变更计划 (Proposed Changes)

### package.json
- [ ] 在 `devDependencies` 中安装 `@playwright/test` 与 `@types/node`。
- [ ] 在 `scripts` 中增加命令 `"test:e2e": "playwright test"` 和 `"test:e2e:ui": "playwright test --ui"`。

### playwright.config.js [NEW]
- [ ] 新建 Playwright 全局配置文件，配置如：浏览器引擎（Chromium，Firefox等）、测试目录（指向 `tests` 文件夹）、本地开发服务器设置 (如 `baseURL: 'http://localhost:5173/'`) 等。

### tests/example.spec.js [NEW]
- [ ] 新增测试示例文件，包含一个基本的页面断言场景（例如检查项目主页是否渲染成功，或者是否包含特定元素的 Title）。

### .gitignore
- [ ] 追加忽略 Playwright 运行生成的产物：
  - `playwright-report/`
  - `test-results/`
  - `playwright/.cache/`

## 4. 验证计划 (Verification Plan)
### 自动化测试
- 命令: 
  - `npx playwright install` （安装对应浏览器依赖）
  - `npm run dev` （确保本地服务启动）
  - `npm run test:e2e`
- 期望结果：命令行终端打印出测试通过的提示。

### 手动验证
- [ ] 本地运行测试命令确保没有语法和环境错误。
- [ ] 确保 `playwright-report` 目录中生成了对应的 HTML 报告。
