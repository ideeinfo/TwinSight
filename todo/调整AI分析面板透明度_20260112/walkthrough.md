# 调整 AI 分析面板透明度 - 演示

我已修复 AI 分析面板 (`AIAnalysisModal.vue`) 透明度过高的问题。现在面板将使用深色渐变背景，不再受到底部内容干扰。

## 更改内容

### 样式修复
`src/components/viewer/AIAnalysisModal.vue`

已更新 CSS 以强制使用深色渐变背景，并移除了未使用的重复样式代码。

```css
:global(.ai-analysis-dialog) {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5) !important;
  /* ... */
}
```

## 验证结果

### 代码检查
- 确认 `:global(.ai-analysis-dialog)` 现在的 `background` 属性已设置为 `linear-gradient(...)` 而非 `transparent`。
- 确认未使用的 `.ai-analysis-modal` 类已移除，代码更加整洁。
