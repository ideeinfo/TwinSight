# 系统配置 UI 自动化测试 实施计划 (Implementation Plan)

## 1. 目标与背景 (Goal & Context)
在引入 Playwright 自动化测试基建的基础上，为用户指定的“系统配置”功能编写专门的自动化测试用例集。
该测试需要涵盖：
1. 验证用户（需具备 admin 权限）能够通过右上角头像下拉菜单正常打开系统配置弹窗。
2. 弹窗内包含的每一个配置标签页（InfluxDB, LLM, Knowledge Base, Workflow, IoT Triggers）均可正常点击并完成面板切换，确保组件挂载稳定，不会触发前端崩溃。

## 2. 设计规范检查 (Design Compliance Check)
> **重要**：在编写任何代码之前，请必须对照 `UI_DESIGN_SPEC.md` 进行核查。

- [x] **规范复习**: 本计划不修改 UI 和线上逻辑，仅产出端到端测试用例代码。
- [x] **Token 使用**: N/A
- [x] **组件选择**: N/A
- [x] **主题支持**: N/A

## 3. 变更计划 (Proposed Changes)

### tests/system-config.spec.js [NEW]
- [ ] **前置状态模拟 (Setup)**:
  - 通过 `page.addInitScript` 或 `page.evaluate` 在浏览器 localStorage 和 Pinia 的 auth store 中自动注入管理员 (admin) 的登录状态和权限，避免冗长的账号密码登录流程。
- [ ] **交互行为模拟**:
  - 定位右上角的 `.avatar-trigger` 并触发点击事件（等待 `.dropdown-panel` 渲染完成）。
  - 点击下拉菜单中的 `系统配置` 按钮。
- [ ] **UI 渲染及切换稳定性断言**:
  - 验证 `.system-config-dialog` 出现。
  - 依序点击左边侧栏的 5 个 Tab (`influxdb`, `llm`, `knowledge`, `workflow`, `iot`)。
  - 对于每次点击，等待对应右侧内容的根元素挂载，断言诸如“Base URL”、“Provider”、“IoT Triggers List”等特征文案出现，确保渲染树未抛出 JavaScript 致命错误且无白屏。

## 4. 验证计划 (Verification Plan)
### 自动化测试
- 命令: `npm run test:e2e tests/system-config.spec.js` (或者通过含有参数的 `npm run test:e2e:ui` 进行调试查看)。
- 预期结果: 3 个端到端引擎（Chromium, Webkit, Firefox）全部执行通过，各 Tab 页能稳定渲染完成。

### 手动验证
- [ ] 无需手动页面验证，自动化走查即通过。
