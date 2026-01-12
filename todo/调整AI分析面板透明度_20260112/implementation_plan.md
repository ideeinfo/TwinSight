# 修复 AI 分析面板透明度过高问题

AI 分析面板 (`AIAnalysisModal.vue`) 当前看起来透明度过高，因为其 CSS 显式将对话框背景设置为 `transparent`，而包含预设渐变背景样式的 `ai-analysis-modal` 类虽然在 `<style>` 中定义了，但在模板中并未使用。

## 用户审查 (User Review Required)
> [!IMPORTANT]
> 此更改将显式地将 AI 分析模态框的背景设置为深色渐变 (`linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`)，以符合未使用的 CSS 类中的设计意图。

## 拟议更改 (Proposed Changes)

### [components/viewer]

#### [MODIFY] [AIAnalysisModal.vue](file:///d:/TwinSIght/antigravity/twinsight/src/components/viewer/AIAnalysisModal.vue)
- 更新 `:global(.ai-analysis-dialog)` CSS 规则，使用渐变背景代替 `transparent`。
- 确保边框圆角和阴影正确应用到对话框，以匹配设计。
- 移除未使用的 `.ai-analysis-modal` 类定义（将其样式合并到 dialog 类中）。

## 验证计划 (Verification Plan)

### 手动验证 (Manual Verification)
1.  **打开 AI 分析面板**：
    - 在 UI 中触发 AI 分析模态框。
2.  **检查视觉效果**：
    - 验证模态框背景不再是透明的。
    - 确认已应用深蓝色渐变背景。
    - 确保文字清晰可读，布局正常。
