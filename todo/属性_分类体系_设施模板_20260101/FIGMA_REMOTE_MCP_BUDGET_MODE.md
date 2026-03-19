# Figma Remote MCP Budget Mode

## 目标

在 Figma `Starter / Free` 套餐下，Remote MCP 只有有限的月度调用额度。当前方案的目标不是追求“随时可查”，而是尽量把一次调用拿到的信息最大化，减少重复取数。

## 当前推荐配置

当前 Codex 侧使用的是 Remote MCP 最小配置：

```toml
[features]
rmcp_client = true

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
http_headers = { "X-Figma-Region" = "us-east-1" }
startup_timeout_sec = 15
tool_timeout_sec = 90
```

说明：
- 这已经是 Remote MCP 的最小可用配置。
- `startup_timeout_sec` 和 `tool_timeout_sec` 只影响等待时间，不影响 Figma 计费额度。
- 节省调用次数的关键不在配置项，而在请求组织方式。

## 最省额度的使用原则

### 1. 一次只看一个明确目标

错误方式：
- “帮我看看这个 Figma 文件，顺便把所有页面都分析一下”

推荐方式：
- “只看这个 frame，检查是否符合 `Manage / Properties` 页面规范”

原因：
- 范围越大，越容易触发多次读取和补充调用。

### 2. 始终提供精确的 Figma 链接

优先提供：
- 具体 `Frame`
- 或具体 `Section`
- 不要只给文件首页链接

推荐：
- 直接复制选中页面区域后的分享链接

不推荐：
- 只给文件根链接，让模型自己继续定位

### 3. 先做“结构审查”，再做“视觉细查”

第一轮先问：
- 页面结构是否完整
- 导航是否正确
- 区块划分是否符合文档

第二轮再问：
- 间距、字号、对齐、色彩、组件状态

原因：
- 结构审查通常只需要更少上下文。
- 先结构后视觉，能避免在错误页面上浪费额度。

### 4. 一个回合只做一种任务

把任务拆成以下几类，单次只选一类：
- 设计复核
- 与实施文档比对
- 生成前端实现建议
- 提取样式 token

不要一次混问：
- “既帮我评审设计，又生成 Vue 代码，再补文档”

### 5. 默认不要截图，不要导出，不要全量枚举

只有在以下情况再要求更重的读取：
- 需要核对像素级布局
- 需要看 hover / active / disabled 视觉差异
- 需要核对复杂组件层级

默认优先：
- 先让模型做结构和规范比对

### 6. 同一页面尽量在一个问题里问全

推荐把问题写成：
- 目标页面
- 对照文档
- 检查范围
- 输出格式

这样可以避免来回追问导致的重复读取。

## 推荐提问模板

### 模板 1：单页面结构复核

```text
请只检查这个 Figma Frame，不要扩展到其他页面。

Figma 链接：
<粘贴具体 frame 链接>

对照文档：
- /Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/FRONTEND_PAGE_COMPONENT_MAP.md
- /Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/GLOBAL_NAV_AND_INFORMATION_ARCHITECTURE.md

任务：
- 只检查信息架构、主要区块、导航入口、主操作按钮是否正确
- 不做视觉美化建议
- 不检查其他页面

输出：
- 按“符合 / 缺失 / 偏差”三类给结论
- 如有问题，给出最小修改建议
```

### 模板 2：单页面视觉复核

```text
请只检查这个 Figma Frame 的视觉一致性，不要分析其他页面。

Figma 链接：
<粘贴具体 frame 链接>

对照文档：
- /Volumes/DATA/antigravity/TwinSight/UI_DESIGN_SPEC.md

任务：
- 只检查色彩层级、字体层级、表格密度、按钮风格、暗色主题一致性
- 不做代码实现建议
- 不扩展到交互流程

输出：
- 列出 5 条以内最重要的偏差
- 每条偏差说明“问题 + 建议改法”
```

### 模板 3：页面与实施计划比对

```text
请只对这个 Figma Frame 做需求符合性检查。

Figma 链接：
<粘贴具体 frame 链接>

对照文档：
- /Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/FACILITY_TEMPLATE_PLAN.md
- /Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PHASE_4_资产联动与设施内即时编辑.md

任务：
- 只核对该页面是否覆盖实施计划中的必备功能点
- 不做视觉建议
- 不看其他 frame

输出：
- 缺失功能点
- 可延后功能点
- 当前可以进入开发的部分
```

## 不推荐的高消耗问法

以下问法会明显增加重复读取概率：

- “把整个文件都看一遍”
- “先自己看看哪里有问题”
- “把所有页面都和文档逐条比对”
- “顺便帮我生成完整前端代码”
- “如果有问题再自己多查几层”

## 最佳工作流

建议按这个顺序使用额度：

1. 先在 Figma 里确定要评审的单个 Frame
2. 把该 Frame 链接发给 Codex
3. 明确本轮只做一种任务
4. 一次性给出对照文档路径
5. 拿到结果后，本地先改设计
6. 改完后再发起下一轮复核

这样通常能把一次调用的有效产出拉到最高。

## 适合 Free 套餐的结论

如果你继续使用 Free 套餐，建议把 Figma MCP 只用于以下高价值场景：
- 关键页面上线前的单页复核
- 与实施计划的符合性检查
- 复杂页面的结构核对

不建议把它用于：
- 日常频繁巡检
- 整站式设计审查
- 大量页面的探索式浏览

## 当前结论

- 当前 Remote MCP 配置已可继续使用。
- 真正的节省方案，是把每次请求收敛为“单 frame、单任务、单输出目标”。
- 如需长期高频使用，仍建议升级到支持 Desktop MCP 的付费方案。
