# 动态 UI 抓取脚本增强

## 背景

现有脚本只抓取页面**静态可见**元素，导致 `modals: []` 全为空。对话框（由按钮点击触发）、下拉选项（由 select/combobox 展开触发）、日期选择器等动态 UI 组件均无法抓取。

## 核心思路

新增 `interactive_scraper.py` 模块，在静态抓取完成后，**自动发现可交互元素 → 点击触发 → 等待 DOM 变化 → 抓取新出现的元素 → 恢复原状 → 截图存档**。

> [!IMPORTANT]
> 动态抓取具有破坏性（可能触发表单提交、删除操作等），需要**白名单策略**或用户确认机制。

## 提议的改动

---

### 抓取引擎

#### [NEW] interactive_scraper.py

新模块，核心函数：

1. **`discover_interactive_elements(page)`**
   - 查找"可能触发弹窗"的按钮：`button:has-text("Add")`, `button:has-text("Create")`, `button:has-text("New")`, `button:has-text("Import")`, `button:has-text("Edit")`
   - 查找下拉控件：`select`, `[role="combobox"]`, `[role="listbox"]`, `.dropdown-trigger`
   - 查找日期控件：`input[type="date"]`, `input[type="datetime-local"]`, `.date-picker`
   - 返回按类型分组的交互元素列表

2. **`click_and_capture_modal(page, button_element)`**
   - 记录点击前的 DOM 快照（`document.querySelectorAll('[role="dialog"]').length`）
   - 点击按钮
   - 等待新 dialog 出现（`page.wait_for_selector('[role="dialog"]', state="visible", timeout=5000)`）
   - 调用现有 `extract_page_elements()` 抓取对话框内元素
   - **截图**对话框状态 (`page.screenshot()`)
   - 关闭对话框（点击 X/Cancel/按 Escape）
   - 等待 dialog 消失
   - 返回 `{ trigger, dialog_elements, screenshot_path }`

3. **`expand_and_capture_dropdown(page, select_element)`**
   - 点击下拉控件
   - 等待选项列表出现（`[role="option"]`, `option`, `.dropdown-item`）
   - 抓取所有选项的文本和值
   - 按 Escape 关闭
   - 返回 `{ trigger, options[] }`

4. **`capture_date_picker(page, input_element)`**
   - 聚焦/点击日期输入框
   - 等待日历面板出现
   - 抓取日历面板结构
   - 按 Escape 关闭
   - 返回面板元数据

---

#### [MODIFY] scraper.py

- 在 `scrape_page()` 中，静态抓取完成后调用 `interactive_scraper` 的函数
- 新增 `--interactive` 命令行参数，默认关闭，需显式启用
- 新增 `--screenshot-dir` 参数，保存交互状态截图
- 输出 JSON 新增字段：`dynamicElements: { modals: [], dropdowns: [], datePickers: [] }`

---

#### [MODIFY] extractors.py

- 新增 `extract_modal_elements(page)` — 专门提取 dialog 内部的表单控件
  - 提取 dialog 标题、所有 label+input 对、按钮（Submit/Cancel/OK）
  - 识别必填字段（`*` 标记或 `required` 属性）
- 新增 `extract_dropdown_options(page, element)` — 提取展开后的选项列表

---

### 安全与配置

#### [NEW] interaction_config.json

```json
{
  "buttonWhitelist": ["Add", "Create", "New", "Import", "Edit", "Upload"],
  "buttonBlacklist": ["Delete", "Remove", "Reset", "Confirm", "Submit"],
  "maxModalsPerPage": 10,
  "modalCloseStrategies": ["button:has-text('Cancel')", "button:has-text('Close')", "[aria-label='Close']", "Escape"],
  "waitAfterClick": 2000,
  "screenshotOnCapture": true
}
```

## 验证计划

### 自动测试
```bash
# 运行增强后的脚本（交互模式）
python3 scraper.py --url https://tandem.autodesk.com/pages/manage/parameters --interactive --screenshot-dir ./screenshots

# 验证 JSON 输出中 dynamicElements 不再为空
python3 -c "import json; d=json.load(open('UI/page_structure_*.json')); print(d.get('dynamicElements',{}))"
```

### 手动验证
- 检查截图目录中是否生成了对话框截图
- 对比截图与实际系统确认字段完整性
