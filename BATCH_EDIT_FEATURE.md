# 多选批量编辑功能

## 功能概述
支持同时选中多个资产或空间，并批量编辑它们的属性。编辑后的新值将应用到所有选中的对象。

## 实现细节

### 1. 数据流

```
用户选择多个对象 
  → App.vue 更新 selectedObjectIds
  → 传递给 RightPanel
  → 用户编辑字段
  → RightPanel.handleFieldChange 循环调用 API
  → 批量更新数据库
  → 发射 property-changed 事件
  → App.vue 批量更新 assetList/roomList
```

### 2. 关键变更

#### App.vue
- **新增状态**: `selectedObjectIds` - 跟踪当前选中的对象ID列表
- **更新**: `onAssetsSelected` - 提取所有选中对象的 mcCode
- **更新**: `onPropertyChanged` - 批量更新所有选中对象的数据
- **传递**: 将 `selectedObjectIds` 传递给 RightPanel

#### RightPanel.vue
- **新增 prop**: `selectedIds` - 接收选中的对象ID列表
- **移除限制**: 允许多选状态下编辑（之前禁用）
- **批量更新**: `handleFieldChange` 循环更新所有 selectedIds
- **成功反馈**: 显示 "成功 X, 失败 Y" 的统计信息

### 3. UI 行为

**单选状态**:
- 显示该对象的实际属性值
- 编辑时只更新该对象

**多选状态**:
- 相同值显示该值
- 不同值显示 "多个" (`__VARIES__`)
- 编辑时更新所有选中对象为相同值
- "__VARIES__" 字段也可以编辑，编辑后所有对象统一为新值

### 4. API 调用

批量编辑时按顺序调用 API：
```javascript
for (const id of selectedIds) {
  await fetch(`/api/assets/${id}`, {
    method: 'PATCH',
    body: { [field]: newValue }
  })
}
```

### 5. 错误处理

- 单个对象更新失败不影响其他对象
- 统计成功和失败数量
- 全部失败时显示错误
- 部分失败时弹出警告

## 使用示例

### 批量修改资产楼层

1. 在资产面板选中多个资产（Ctrl + 点击）
2. 右侧属性面板显示：
   - 名称: 多个
   - 楼层: 多个 (如果不同) 或 "F1" (如果相同)
3. 点击 "楼层" 字段
4. 输入 "F2"
5. 按 Enter
6. 控制台显示：
   ```
   🔢 批量编辑模式: 将更新 3 个对象
   🔄 正在更新资产: MC001
   ✅ 资产 MC001 更新成功
   🔄 正在更新资产: MC002
   ✅ 资产 MC002 更新成功
   🔄 正在更新资product: MC003
   ✅ 资产 MC003 更新成功
   ✅ 批量更新完成: 成功 3, 失败 0
   ```

### 批量修改空间分类

1. 在房间列表选中多个房间
2. 编辑"分类编码"字段
3. 所有选中的房间分类编码更新为相同值

## 性能考虑

- 按顺序而非并行调用 API（避免服务器过载）
- 每次API调用都有单独的错误处理
- 本地状态立即更新，无需等待所有API完成

## 后续优化建议

1. **批量 API 端点**: 添加 `PATCH /api/assets/batch` 接受对象数组
2. **进度指示**: 显示 "正在更新 3/10" 的进度条
3. **撤销功能**: 支持批量编辑的撤销
4. **选择性编辑**: 允许用户勾选要更新的字段
