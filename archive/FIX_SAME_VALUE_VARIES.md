# 修复：相同值显示"多个"的问题

## 问题描述
当选择多个对象时，即使某个属性的值在所有选中对象中都相同，也会错误地显示为 "多个"（VARIES）。

例如：选择2个名称都是 "Keller" 的资产，但属性面板显示名称为 "多个" 而不是 "Keller"。

## 根本原因
属性值比较使用了严格不等于 `!==`，但没有正确处理以下情况：
- `null` vs `undefined`
- `null` vs `""`
- `undefined` vs `""`
- 数字 vs 字符串（如 `123` vs `"123"`）

## 解决方案
添加 `isSameValue` 辅助函数，标准化值比较：

```javascript
const isSameValue = (v1, v2) => {
  const normalize = (v) => (v == null || v === '') ? '' : String(v);
  return normalize(v1) === normalize(v2);
};
```

### 标准化规则
1. **空值统一**: `null`, `undefined`, `""` 都被视为空字符串 `""`
2. **字符串化**: 所有非空值转换为字符串进行比较
3. **严格相等**: 标准化后使用 `===` 比较

## 修复的函数

### 1. onAssetsSelected (多选资产)
```javascript
// 修复前
if (mergedProps.name !== props.name) mergedProps.name = VARIES_VALUE;

// 修复后
if (!isSameValue(mergedProps.name, props.name)) mergedProps.name = VARIES_VALUE;
```

### 2. loadAssetProperties (反向定位资产)
```javascript
Object.keys(mergedProps).forEach(key => {
  // 修复前
  if (key !== 'isMultiple' && mergedProps[key] !== props[key]) {
    mergedProps[key] = VARIES_VALUE;
  }
  
  // 修复后
  if (key !== 'isMultiple' && !isSameValue(mergedProps[key], props[key])) {
    mergedProps[key] = VARIES_VALUE;
  }
});
```

### 3. loadRoomProperties (反向定位空间)
```javascript
// 修复前
if (merged.name !== p.name) merged.name = VARIES_VALUE;

// 修复后
if (!isSameValue(merged.name, p.name)) merged.name = VARIES_VALUE;
```

## 测试场景

### 场景1: 相同字符串值
选择对象：
- 对象A: name = "Keller"
- 对象B: name = "Keller"

**期望**: 显示 "Keller"  
**修复前**: 显示 "多个" ❌  
**修复后**: 显示 "Keller" ✅

### 场景2: 空值统一
选择对象：
- 对象A: phone = null
- 对象B: phone = ""
- 对象C: phone = undefined

**期望**: 显示空白（因为都是空）  
**修复前**: 显示 "多个" ❌  
**修复后**: 显示 "--" ✅

### 场景3: 数字 vs 字符串
选择对象：
- 对象A: area = 100 (数字)
- 对象B: area = "100" (字符串)

**期望**: 显示 "100"  
**修复前**: 显示 "多个" ❌  
**修复后**: 显示 "100" ✅

### 场景4: 真正不同的值
选择对象：
- 对象A: name = "Keller"
- 对象B: name = "Meeting"

**期望**: 显示 "多个"  
**修复前**: 显示 "多个" ✅  
**修复后**: 显示 "多个" ✅

## 代码位置

所有修复都在 `src/App.vue` 中：
- Line ~724: `onAssetsSelected` 的多选逻辑
- Line ~904: `loadAssetProperties` 的多选逻辑  
- Line ~947: `loadRoomProperties` 的多选逻辑

## 验证方法

1. 选择多个名称相同的对象
2. 查看右侧属性面板
3. 相同属性应显示实际值，不应显示 "多个"
4. 只有真正不同的属性才显示 "多个"
