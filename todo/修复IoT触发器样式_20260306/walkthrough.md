# IoT 触发器配置页面样式修复记录

## 1. 修复内容概述
针对系统配置中“IoT 触发器”页面表格外溢导致的 `el-tabs` 挤压漂移（蓝色 Indicator 与文字重叠），以及操作按钮（编辑/删除）在深色底色下辨识度低的问题进行了整体修复。

## 2. 详细修复点

### 2.1 修复排版溢出与漂移
- **文件**: `src/components/SystemConfigPanel.vue`
- 由于内部包含的 `<IoTConfig />` 中具有 `el-table` 组件，表格在未加限制时会尝试撑破可用空间。
- 我们为左边的导航侧边栏 `.config-tabs :deep(.el-tabs__header)` 添加了 `flex-shrink: 0;`。
- 我们为右边承载内容的地方（`.config-tabs :deep(.el-tabs__content)` 和 `.tab-content.full-width`）添加了严格的 `flex: 1; min-width: 0;`。
- **效果**: 内容在过长时只会在右侧内部发生水平或者垂直滚动，彻底斩断了外溢影响侧边栏的情况。

### 2.2 修复按钮辨识度和样式
- **文件**: `src/components/config/IoTConfig.vue`
- **问题**: 原来“操作”列下的按钮使用的属性为 `type="primary" link` 和 `type="danger" link`。由于没有实体背景和边框，结合系统的主题导致其融入了深色表格背景内，无法看清。
- **修复**: 移除了 `link` 样式，替换为 `plain size="small" circle`（带有原色主题背景色微透和圆形精简边界的实体图标按钮）。
- **效果**: 各个数据行的编辑和删除按钮具备了高亮的视觉外框和交互状态，一目了然。

## 3. 测试与验证
重新运行了 `test:e2e`，在 Chromium 等内核下均顺利通过，确认 DOM 的正常渲染。界面重构生效。
