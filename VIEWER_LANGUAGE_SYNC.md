# Forge Viewer 语言同步功能

## 功能说明
Forge Viewer 的语言设置现在会自动与系统语言设置同步。

## 实现细节

### 1. 初始化时同步
在 Viewer 初始化时（`initViewer` 函数），根据当前的 `locale` 值设置 Viewer 语言：

```javascript
const viewerLanguage = locale.value === 'zh' ? 'zh-cn' : 'en';
const options = { env: 'Local', document: null, language: viewerLanguage };
```

### 2. 语言映射
- **中文** (`zh`) → Forge Viewer 使用 `zh-cn`
- **英文** (`en`) → Forge Viewer 使用 `en`

### 3. 运行时切换
添加了 `watch` 监听器来检测语言切换：

```javascript
watch(locale, (newLocale, oldLocale) => {
  if (oldLocale && newLocale !== oldLocale && viewer) {
    console.log(`🌐 语言已切换: ${oldLocale} → ${newLocale}`);
    console.log('💡 建议刷新页面以应用 3D 查看器的语言设置');
  }
});
```

## 使用说明

### 初次加载
1. 系统启动时会根据当前语言设置初始化 Viewer
2. Viewer 的 UI（工具栏、菜单等）会显示对应语言

### 切换语言
1. 用户通过顶部栏切换语言（中文 ↔ 英文）
2. 系统 UI 立即切换到新语言
3. **Viewer UI 需要刷新页面才能完全切换**
   - 控制台会显示提示信息
   - 这是 Forge Viewer 的限制

### 自动刷新（可选）
如果希望切换语言后自动刷新页面，可以取消注释这行代码：

```javascript
// watch 函数中
window.location.reload();
```

## 测试步骤

1. **测试初始化**
   - 设置系统语言为中文，刷新页面
   - Viewer 工具栏应显示中文
   
2. **测试切换到英文**
   - 点击顶部语言切换按钮
   - 查看控制台输出
   - 刷新页面
   - Viewer 工具栏应显示英文

3. **测试切换回中文**
   - 重复上述步骤
   - 验证 Viewer 显示中文

## 支持的语言

Forge Viewer 支持的语言代码：
- `zh-cn` - 简体中文
- `zh-tw` - 繁体中文  
- `en` - 英语
- `ja` - 日语
- `de` - 德语
- `fr` - 法语
- `es` - 西班牙语
- `pt-br` - 葡萄牙语（巴西）
- `ko` - 韩语
- `it` - 意大利语
- `ru` - 俄语
- `pl` - 波兰语
- `tr` - 土耳其语
- `cs` - 捷克语

## 注意事项

1. **Viewer 语言切换需要重新初始化**
   - 这是 Autodesk Forge Viewer 的设计限制
   - 无法在运行时动态切换，必须刷新页面

2. **系统 UI vs Viewer UI**
   - 系统 UI（面板、按钮等）由 vue-i18n 管理，可以即时切换
   - Viewer UI（工具栏、菜单等）需要重新初始化

3. **用户体验建议**
   - 可以在语言切换后显示提示："语言切换后请刷新页面以完全应用"
   - 或者直接自动刷新页面（取消注释 reload 代码）

## 文件位置
- **主要修改**: `src/components/MainView.vue`
  - 第 461-466 行：初始化语言设置
  - 第 2423-2435 行：语言切换监听器
