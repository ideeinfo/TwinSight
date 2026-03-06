# 修复 IoT 触发器配置页面的样式及排版漂移问题

> **背景描述**：
> 当用户在系统配置中点击进入“IoT 触发器”页面时，由于内部表格的宽度较大，将父容器（Tab 内容区）强行撑开，导致 `el-tabs` 在 Flex 布局中不可避免地挤压了左侧的 `.el-tabs__header`（标签页导航）。这引起了左侧导航宽度的缩小和活动指示器（蓝色竖条）发生界面漂移和内容重叠。并且因为暗黑模式的原因，IoT 表格内的“编辑/删除”按钮（因为使用了原生深色的 link type）几乎在背景中不可见。

## 拟定修改（Proposed Changes）

### 1. 修复界面漂移 (SystemConfigPanel.vue)
我们将通过完善 Flex 布局的约束指令，阻止子元素撑破父级容器，保证弹窗各区块拥有稳定的分配空间。
- **[MODIFY] src/components/SystemConfigPanel.vue**
  - 为左侧的导航区 `.config-tabs :deep(.el-tabs__header)` 添加 `flex-shrink: 0;` 以保证它固定在 180px 拒绝被压缩。
  - 为右侧的内容区 `.config-tabs :deep(.el-tabs__content)` 添加 `flex: 1; min-width: 0;`（利用 `min-width: 0` 截断子元素内部无限宽度生长的机制），保证内容只在可用空间内滚动。
  - 将 `.tab-content.full-width` 也设置为 `min-width: 0;`。

### 2. 修复按钮能见度低的问题 (IoTConfig.vue)
提升操作列各个控制按钮的对比度，避免被隐匿在界面的底色中。
- **[MODIFY] src/components/config/IoTConfig.vue**
  - 将“操作”列下的 `el-button` 由 `link`（纯文本链接形式的深色原色）修改为 `plain` 或为其定制更高的亮度样式：`type="primary" plain size="small"` 以及 `type="danger" plain size="small"` 以增强按钮外框与底层背景的反差，使用户更易于看清和点击。
