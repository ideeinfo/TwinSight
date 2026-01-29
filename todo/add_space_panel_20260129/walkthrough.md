# 空间管理功能 开发记录 (Walkthrough)

## 概述

本次开发为 TwinSight 应用添加了**空间管理功能**，用户可以通过左侧导航栏「空间」按钮进入空间列表页面，按楼层分组查看空间，并与 3D 模型进行交互（隔离显示、属性编辑等）。

## 实现的功能

### 1. SpacePanel 空间面板组件

**文件**: `src/components/SpacePanel.vue`

创建了新的空间面板组件，主要特性：

- **树形结构显示**：使用 Element Plus 的 `el-tree-v2` 虚拟滚动组件
  - 第一级：楼层（floor 字段）
  - 第二级：空间（显示 名称 + 编码）
- **搜索过滤**：支持按空间名称或编码搜索
- **多选功能**：支持通过 checkbox 多选空间或整个楼层
- **批量删除**：选中后显示删除按钮和选中计数
- **双向同步**：支持从模型反向定位到列表

### 2. AppViewer 集成

**文件**: `src/AppViewer.vue`

修改内容：
- 导入 SpacePanel 组件
- 添加 `v-else-if="currentView === 'spaces'"` 条件渲染
- 新增状态变量：
  - `spacePanelRef` - 面板组件引用
  - `savedSpaceSelections` - 空间选择状态
- 新增函数：
  - `onSpacesSelected(dbIds)` - 处理空间选择事件
  - `loadSpaceProperties(dbIds)` - 加载空间属性（反向定位专用）
- 更新 `onModelSelectionChanged` 支持 spaces 视图

### 3. 模型隔离功能

复用 MainView.vue 中已有的方法：
- `isolateAndFocusRooms(dbIds)` - 隔离显示选中的空间
- `showAllRooms()` - 显示所有空间

### 4. 国际化支持

**文件**: `src/i18n/index.js`

添加了中英文翻译：

```javascript
// 中文
spacePanel: {
  spaces: '空间列表',
  noFloor: '未分配楼层',
  loading: '加载中...'
}

// 英文
spacePanel: {
  spaces: 'Space List',
  noFloor: 'Unassigned Floor',
  loading: 'Loading...'
}
```

## 技术实现细节

### 树形数据结构

```javascript
const treeData = computed(() => {
  const floorMap = {};
  
  props.spaces.forEach(space => {
    const floor = space.floor || t('spacePanel.noFloor');
    
    if (!floorMap[floor]) {
      floorMap[floor] = {
        id: `floor-${floor}`,
        label: floor,
        isFloor: true,
        children: []
      };
    }
    
    floorMap[floor].children.push({
      id: `space-${space.dbId}`,
      label: space.name || space.code,
      code: space.code,
      dbId: space.dbId,
      isSpace: true
    });
  });

  return Object.values(floorMap)
    .sort((a, b) => /* 数字优先排序 */);
});
```

### 主题适配

使用语义化 CSS Token 确保深浅色主题兼容：
- `var(--list-bg)` - 列表背景色
- `var(--list-item-text)` - 列表项文本色
- `var(--md-sys-color-outline-variant)` - 边框色
- `var(--md-sys-color-primary)` - 主色调

### 性能优化

1. **虚拟滚动**：使用 `el-tree-v2` 的虚拟滚动，支持大量空间数据
2. **防抖处理**：`handleCheckChange` 使用 100ms 防抖优化性能
3. **ResizeObserver**：动态计算容器高度，适配布局变化

## 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新建 | `src/components/SpacePanel.vue` | 空间面板组件 |
| 修改 | `src/AppViewer.vue` | 添加 SpacePanel 集成 |
| 修改 | `src/i18n/index.js` | 添加 spacePanel 翻译 |

## 验证步骤

1. 启动开发服务器 `npm run dev`
2. 在浏览器中打开应用
3. 点击左侧导航栏的「空间」按钮
4. 验证空间列表按楼层分组显示
5. 测试搜索功能
6. 测试单选/多选空间后模型隔离显示
7. 测试右栏属性显示
8. 切换深色/浅色主题验证样式

## 后续优化建议

1. 添加空间属性编辑后的 API 保存功能
2. 添加空间关联文档的管理功能
3. 优化楼层排序逻辑（如 B1, B2, 1F, 2F 的自然排序）
