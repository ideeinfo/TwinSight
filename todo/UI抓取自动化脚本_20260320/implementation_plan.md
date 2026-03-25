# Autodesk Tandem UI 元素抓取自动化脚本 实施计划 (Implementation Plan)

## 1. 目标与背景 (Goal & Context)

编写一个 Python 自动化脚本，使用 Playwright (async) + BeautifulSoup4 对 Autodesk Tandem 系统 (`https://tandem.autodesk.com/pages/manage/parameters`) 进行递归遍历，抓取每个页面的 UI 元素元数据（Input, Button, Select, Table, Modal），输出为结构化 JSON 文件。

**核心需求**：
- 递归遍历所有可导航页面（菜单、侧边栏链接等）
- 登录逻辑提供占位符，由用户手动完成登录
- 处理 iframe 内嵌内容
- 提取元素的标签名、文本内容、坐标尺寸、关键样式
- 自动忽略隐藏元素
- 按页面输出 JSON 文件到 `UI/` 目录

## 2. 设计规范检查 (Design Compliance Check)

> **注意**：本任务为独立工具脚本，不涉及 TwinSight 前端 UI 组件和设计规范。

- [x] **规范复习**: 本任务不涉及 UI_DESIGN_SPEC.md
- [x] **Token 使用**: 不适用（独立 Python 脚本）
- [x] **组件选择**: 不适用
- [x] **主题支持**: 不适用

## 3. 变更计划 (Proposed Changes)

### [NEW] `scripts/ui-scraper/requirements.txt`
- 定义 Python 依赖：`playwright`, `beautifulsoup4`, `lxml`

### [NEW] `scripts/ui-scraper/extractors.py`
工具模块，负责元素元数据提取逻辑：
- `extract_element_metadata(page, element)` — 使用 Playwright API 提取单个元素的：
  - `tagName`: 标签名
  - `innerText` / `value`: 文本或值
  - `boundingBox`: `{x, y, width, height}` 绝对坐标和尺寸
  - `styles`: `{backgroundColor, fontSize, border}` 关键样式
  - `attributes`: id, name, class, placeholder, type 等常用属性
- `extract_page_elements(page)` — 批量提取页面中的 5 类目标元素：
  - `input` (含 `textarea`)
  - `button` (含 `[role="button"]`, `a.btn`)
  - `select` (含自定义 dropdown `[role="listbox"]`)
  - `table`
  - `[role="dialog"]`, `.modal` (Modal)
- `is_visible(element)` — 通过 `element.is_visible()` + computed style 过滤隐藏元素
- `extract_iframe_elements(page)` — 递归进入 iframe 提取元素

### [NEW] `scripts/ui-scraper/scraper.py`
主脚本，负责页面遍历和调度逻辑：

#### 核心架构
```
┌─────────────────────────────────────────┐
│              main()                     │
│  1. 启动 Playwright (chromium)          │
│  2. 打开入口 URL                         │
│  3. 暂停等待用户手动登录                    │
│  4. 调用 crawl() 开始递归遍历             │
│  5. 关闭浏览器                            │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           crawl(page, url, visited)     │
│  1. 检查 url 是否已访问 (Set)            │
│  2. page.goto(url)                      │
│  3. page.wait_for_load_state("networkidle") │
│  4. 调用 extract_page_elements()         │
│  5. 调用 extract_iframe_elements()       │
│  6. 保存 JSON 到 UI/ 目录                │
│  7. 发现当前页面的导航链接                  │
│  8. 递归访问新链接                         │
└─────────────────────────────────────────┘
```

#### 关键设计决策

1. **登录处理**：使用 `input("按 Enter 继续...")` 暂停脚本，用户在浏览器中手动登录后按 Enter 恢复爬取。
2. **URL 过滤策略**：
   - 只爬取同域名 (`tandem.autodesk.com`) 下的链接
   - 使用 `Set[str]` 记录已访问 URL，避免重复
   - 忽略锚点链接 (`#`)、静态资源链接 (`.js`, `.css`, `.png` 等)
   - 忽略外部链接和 `javascript:void(0)` 类链接
3. **导航链接发现**：
   - 抓取 `<a href>` 标签 + 侧边栏菜单项 (`nav a`, `[role="menuitem"]`)
   - 检测可点击元素（按钮打开子页面/模态框的情况）
4. **网络等待**：每次导航后使用 `page.wait_for_load_state("networkidle")`
5. **错误容跌**：每个页面的抓取用 try/except 包裹，失败不中断整体流程
6. **并发控制**：单线程顺序爬取，避免触发反爬机制

#### 输出格式
```json
{
  "url": "https://tandem.autodesk.com/pages/manage/parameters",
  "title": "Page Title",
  "timestamp": "2026-03-20T13:50:00+08:00",
  "elements": {
    "inputs": [
      {
        "tagName": "INPUT",
        "type": "text",
        "value": "",
        "placeholder": "Search...",
        "id": "search-input",
        "name": "q",
        "className": "search-field",
        "boundingBox": {"x": 120, "y": 80, "width": 300, "height": 40},
        "styles": {
          "backgroundColor": "rgb(255, 255, 255)",
          "fontSize": "14px",
          "border": "1px solid rgb(204, 204, 204)"
        }
      }
    ],
    "buttons": [...],
    "selects": [...],
    "tables": [...],
    "modals": [...]
  },
  "iframes": [
    {
      "src": "...",
      "elements": { ... }
    }
  ]
}
```

文件命名规则：`page_structure_{url_slug}_{timestamp}.json`

## 4. 验证计划 (Verification Plan)

### 自动化测试
- 无自动化测试（本脚本为独立工具，依赖外部网站，不适合单元测试）

### 手动验证
1. **安装依赖**:
   ```bash
   cd scripts/ui-scraper
   pip install -r requirements.txt
   playwright install chromium
   ```
2. **运行脚本**:
   ```bash
   python scraper.py
   ```
3. **验证登录流程**:
   - 脚本应自动打开浏览器并导航到入口 URL
   - 终端提示 "请在浏览器中完成登录，然后按 Enter 继续..."
   - 用户手动登录后按 Enter，脚本继续运行
4. **验证输出**:
   - 检查 `UI/` 目录下是否生成了 `page_structure_*.json` 文件
   - 打开 JSON 文件验证：结构完整、元素数量合理、坐标/样式数据非空
5. **验证递归遍历**：
   - 检查日志输出中是否访问了多个不同页面
   - 确认没有重复访问同一 URL
