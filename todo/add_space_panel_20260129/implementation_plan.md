# 空间管理功能 实施计划 (Implementation Plan)

## 1. 目标与背景 (Goal & Context)

### 目标
实现空间（Space）管理功能，用户可以通过左侧导航栏「空间」按钮进入空间列表页面，查看、选择、编辑空间信息，并与模型交互。

### 功能需求
1. **空间列表面板**：点击导航栏「空间」按钮，左栏打开空间列表
   - 将当前模型的空间按楼层（floor 字段）分组成树结构
   - 每行显示：空间名称 + 空间编码
   - 整体样式参考资产列表 `AssetPanel.vue`

2. **模型隔离显示**：
   - 点击空间前的 checkbox，在模型中隔离显示该空间
   - 点击楼层前的 checkbox，隔离显示该楼层所有空间
   - 支持多选

3. **右栏属性编辑**：
   - 点击 checkbox 触发刷新右栏的元素、类型面板
   - 支持编辑/多选编辑空间属性
   - 支持上传/删除/查看文档
   - 整体沿用现有的右栏属性显示/编辑和文档管理逻辑

4. **批量删除**：
   - 支持多选删除功能

## 2. 设计规范检查 (Design Compliance Check)
> **重要**：在编写任何代码之前，请必须对照 `UI_DESIGN_SPEC.md` 进行核查。

- [x] **规范复习**: 是否已阅读 `UI_DESIGN_SPEC.md`？
- [x] **Token 使用**: 是否使用了语义化 Token (如 `var(--md-sys-color-primary)`) 而非十六进制色值？
- [x] **组件选择**: 是否优先使用了 `el-tree-v2`, `el-input`, `el-button` 等 Element Plus 组件？
- [x] **主题支持**: 计划是否同时考虑了深色 (Dark) 和浅色 (Light) 模式？

## 3. 现有代码分析

### 3.1 相关文件
| 文件路径 | 说明 |
|---------|------|
| `src/components/IconBar.vue` | 导航栏，已添加 `spaces` 按钮 |
| `src/components/AssetPanel.vue` | 资产面板（参考实现） |
| `src/components/LeftPanel.vue` | 连接页面（空间平铺列表） |
| `src/AppViewer.vue` | 主应用，处理视图切换和数据传递 |
| `src/components/MainView.vue` | 3D 视图，处理模型隔离 |
| `src/components/RightPanel.vue` | 右栏属性面板 |
| `src/services/postgres.js` | 前端 API 服务（已有 `deleteSpaces`） |
| `server/services/space-service.js` | 后端空间服务（已有楼层查询 `getFloors`） |
| `src/i18n/index.js` | 国际化配置（已有 `spaces` 翻译） |

### 3.2 数据库表结构 (spaces)
```sql
spaces (
  id SERIAL PRIMARY KEY,
  space_code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  floor VARCHAR(50),           -- 楼层，用于分组
  area NUMERIC(10,2),
  perimeter NUMERIC(10,2),
  db_id INTEGER,               -- 模型中的 dbId
  file_id INTEGER,             -- 关联的模型文件
  classification_code VARCHAR(50),
  classification_desc VARCHAR(255),
  category VARCHAR(100)
)
```

### 3.3 现有 API
- `GET /api/v1/spaces` - 获取所有空间
- `GET /api/files/:fileId/spaces` - 获取指定文件的空间
- `POST /api/v1/spaces/batch-delete` - 批量删除空间
- `PATCH /api/spaces/:code` - 更新空间

## 4. 变更计划 (Proposed Changes)

### 4.1 新建组件 `src/components/SpacePanel.vue`

创建新的空间面板组件，参考 `AssetPanel.vue` 的实现：

- [x] **树形结构**：使用 `el-tree-v2` 实现虚拟滚动的树形列表
- [x] **楼层分组**：第一层为楼层（floor），第二层为空间
- [x] **复选框选择**：支持单选和多选
- [x] **搜索过滤**：顶部搜索框支持按名称/编码搜索
- [x] **删除功能**：选中后显示删除按钮和选中计数
- [x] **事件发射**：
  - `@open-properties` - 打开右栏
  - `@spaces-selected` - 空间选择变化
  - `@spaces-deleted` - 空间删除后触发刷新

**具体实现要点：**

```vue
<!-- 树形数据结构 -->
const treeData = computed(() => {
  const floorMap = {};
  
  props.spaces.forEach(space => {
    const floor = space.floor || '未分配楼层';
    
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
      label: space.name,
      code: space.code,
      dbId: space.dbId,
      isSpace: true
    });
  });
  
  return Object.values(floorMap)
    .sort((a, b) => a.label.localeCompare(b.label));
});
```

### 4.2 修改 `src/AppViewer.vue`

在 `AppViewer.vue` 中添加对 `spaces` 视图的支持：

- [x] **引入组件**：`import SpacePanel from './components/SpacePanel.vue'`
- [x] **条件渲染**：在 `panel-content` 中添加 `v-else-if="currentView === 'spaces'"`
- [x] **选择状态**：添加 `savedSpaceSelections` 保存空间选择
- [x] **事件处理**：
  - `onSpacesSelected(dbIds)` - 空间选择变化
  - `reloadCurrentFileSpaces()` - 已存在，用于删除后刷新

**代码变更位置（约第 29-52 行）：**

```vue
<LeftPanel ... v-if="currentView === 'connect'" />
<AssetPanel ... v-else-if="currentView === 'assets'" />
<SpacePanel
  v-else-if="currentView === 'spaces'"
  ref="spacePanelRef"
  :spaces="roomList"
  :selected-db-ids="savedSpaceSelections"
  @open-properties="openRightPanel"
  @spaces-selected="onSpacesSelected"
  @spaces-deleted="reloadCurrentFileSpaces"
/>
<FilePanel ... v-else-if="currentView === 'models'" />
```

### 4.3 修改 `src/components/MainView.vue`

添加对 `spaces` 视图的模型隔离支持：

- [x] **隔离逻辑**：当 `currentView === 'spaces'` 时，根据选中的 dbIds 调用 `viewer.isolate()`
- [x] **多选支持**：传入 dbId 数组进行隔离

**代码变更位置（约第 1360 行附近）：**

```javascript
// 处理空间视图的隔离
if (props.currentView === 'spaces') {
  const spaceDbIds = // 获取选中的空间 dbIds
  if (spaceDbIds.length > 0) {
    viewer.isolate(spaceDbIds);
  } else {
    viewer.isolate([]); // 显示全部
  }
}
```

### 4.4 修改 `src/components/RightPanel.vue`

确保右栏面板正确处理 `spaces` 视图模式：

- [x] **view-mode 判断**：已有 `viewMode` prop，确认 `'spaces'` 模式下正确显示空间属性
- [x] **属性编辑**：空间属性编辑应复用现有的 `propertyChanged` 事件

### 4.5 国际化配置 `src/i18n/index.js`

确认已有翻译（之前已添加）：

```javascript
leftPanel: {
  // ...
  spaces: '空间',  // 中文
  // ...
}
// 英文
leftPanel: {
  // ...
  spaces: 'Spaces',
  // ...
}
```

可能需要添加的新翻译：

```javascript
spacePanel: {
  spaces: '空间列表',
  noFloor: '未分配楼层',
  loading: '加载中...'
}
```

## 5. 实现步骤

### 阶段1：创建 SpacePanel 组件
1. [x] 创建 `src/components/SpacePanel.vue`
2. [x] 实现树形结构（楼层 → 空间）
3. [x] 实现搜索过滤功能
4. [x] 实现多选和删除功能
5. [x] 添加国际化支持

### 阶段2：集成到 AppViewer
1. [x] 在 `AppViewer.vue` 中引入 `SpacePanel`
2. [x] 添加 `v-else-if="currentView === 'spaces'"` 条件渲染
3. [x] 添加 `savedSpaceSelections` 状态
4. [x] 实现 `onSpacesSelected` 事件处理

### 阶段3：模型隔离功能
1. [x] 在 `MainView.vue` 中添加 `spaces` 视图的隔离逻辑
2. [x] 测试单选隔离
3. [x] 测试多选隔离
4. [x] 测试楼层整体隔离

### 阶段4：右栏属性集成
1. [x] 确认 `RightPanel.vue` 支持 `spaces` 视图模式
2. [x] 测试属性显示和编辑
3. [x] 测试文档关联功能

## 6. 验证计划 (Verification Plan)

### 自动化测试
- 命令: `npm run dev` 启动开发服务器

### 手动验证
- [ ] 检查深色模式 (Dark Mode) 下的 UI
- [ ] 检查浅色模式 (Light Mode) 下的 UI
- [ ] 点击「空间」按钮，验证左栏显示空间列表
- [ ] 验证空间按楼层正确分组
- [ ] 验证搜索功能
- [ ] 验证单个空间选择后模型隔离显示
- [ ] 验证楼层选择后该楼层所有空间隔离显示
- [ ] 验证多选功能
- [ ] 验证删除功能
- [ ] 验证右栏属性显示和编辑
- [ ] 验证文档关联功能

## 7. 风险与注意事项

1. **性能考虑**：使用 `el-tree-v2` 虚拟滚动，避免大量空间时的性能问题
2. **数据一致性**：删除空间后需同步刷新模型视图
3. **状态保持**：视图切换时保持选择状态
4. **模型隔离**：确保 `viewer.isolate()` 接收正确的 dbId 数组

## 8. 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新建 | `src/components/SpacePanel.vue` | 空间面板组件 |
| 修改 | `src/AppViewer.vue` | 添加 SpacePanel 集成 |
| 修改 | `src/components/MainView.vue` | 添加 spaces 视图隔离逻辑 |
| 修改 | `src/i18n/index.js` | 添加 spacePanel 翻译（如需要） |
