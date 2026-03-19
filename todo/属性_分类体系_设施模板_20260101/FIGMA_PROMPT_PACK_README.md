# Figma Prompt Pack 使用说明

## 1. 目的
这套 prompt 包用于把现有 TwinSight 前端规划文档转换成适合 `Figma Make` 使用的页面级设计输入。

目标不是重新发明一套视觉语言，而是：
*   尽量复核并延续当前 TwinSight 的 UI 风格
*   在现有 `Home / Facilities / Manage` 信息架构下生成页面设计
*   让生成结果更接近真实产品后台，而不是营销站或通用 SaaS 模板

## 2. 风格来源
以下规范已被提炼进 prompt：
*   [UI_DESIGN_SPEC.md](/Volumes/DATA/antigravity/TwinSight/UI_DESIGN_SPEC.md)
*   [theme.css](/Volumes/DATA/antigravity/TwinSight/src/theme.css)
*   [dark.css](/Volumes/DATA/antigravity/TwinSight/src/dark.css)
*   [light.css](/Volumes/DATA/antigravity/TwinSight/src/light.css)
*   [FRONTEND_PAGE_COMPONENT_MAP.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/FRONTEND_PAGE_COMPONENT_MAP.md)
*   [GLOBAL_NAV_AND_INFORMATION_ARCHITECTURE.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/GLOBAL_NAV_AND_INFORMATION_ARCHITECTURE.md)

## 3. 文件结构
*   [PROMPT_00_GLOBAL_STYLE.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PROMPT_00_GLOBAL_STYLE.md)
*   [PROMPT_01_NAV_SHELL.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PROMPT_01_NAV_SHELL.md)
*   [PROMPT_02_HOME.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PROMPT_02_HOME.md)
*   [PROMPT_03_FACILITIES.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PROMPT_03_FACILITIES.md)
*   [PROMPT_04_MANAGE_PROPERTIES.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PROMPT_04_MANAGE_PROPERTIES.md)
*   [PROMPT_05_MANAGE_CLASSIFICATIONS.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PROMPT_05_MANAGE_CLASSIFICATIONS.md)
*   [PROMPT_06_MANAGE_TEMPLATES.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PROMPT_06_MANAGE_TEMPLATES.md)

## 4. 推荐用法

### 4.1 单页面生成
将以下三段拼接后，一次性粘贴到 Figma Make：
1. `PROMPT_00_GLOBAL_STYLE`
2. `PROMPT_01_NAV_SHELL`
3. 目标页面 prompt，例如 `PROMPT_02_HOME`

### 4.2 迭代修正
生成首版后，用追加 prompt 的方式修正：
*   保持更紧凑的表格密度
*   降低营销感
*   更接近深色工程管理后台
*   强化顶部导航 active 状态

## 5. 推荐生成顺序
1. Home
2. Facilities
3. Manage / Properties
4. Manage / Classifications
5. Manage / Templates

## 6. 使用注意事项
*   不要单独只用页面 prompt，必须带上 `Global Style`。
*   这套 prompt 默认按桌面端优先生成。
*   如需移动端，可在生成后追加一句：`Now generate a mobile adaptation while preserving the same information architecture.`
*   如果生成结果偏离现有 TwinSight 风格，优先补一句：
  *   `Do not redesign the brand. Match the existing TwinSight dark engineering console style.`
