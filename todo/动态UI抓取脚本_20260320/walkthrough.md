# 基于新抓取数据修正设计 - Walkthrough

## 修正内容

### 1. FT 列表页对话框修正 (节点 `Xxopi`)

动态抓取成功捕获了 **Add Facility Template** 弹窗的真实字段，发现 6 处差异并修正：

| 项目 | 修正前 | 修正后 (匹配实际系统) |
|------|--------|----------------------|
| 确认按钮 | OK | **Add** |
| 分类标签 | Classification System | **Classification** |
| 分类 placeholder | Select system | **Tandem Categories (built-in)** |
| 分类文本色 | #808080 (灰色) | **#C4C7C5** (有默认值) |
| Name placeholder | Template Name | **Name** |
| Description placeholder | Template Description | **Description** |

### 2. 新建 FT 详情页 (`vdF67`)

全新页面，基于 `facilityTemplates/X5h_6fovSKSa6u13CSGamQ` 抓取数据设计：

- **左侧面板**: 分类树（Search classifications + Clear selection + 树节点）
- **右上操作栏**: Cancel + Update 按钮
- **参数表格**: 6 列 × 5 行（含实际中文参数名）

## 最终效果

````carousel
![FT 列表页 + 修正后的 Add 对话框](/Users/diwei/.gemini/antigravity/brain/277c5996-cf39-43c3-b6f0-6dd61cffb8f0/MYew6.png)
<!-- slide -->
![FT 详情页 (新建)](/Users/diwei/.gemini/antigravity/brain/277c5996-cf39-43c3-b6f0-6dd61cffb8f0/vdF67.png)
````

## 验证

- ✅ 对话框字段文本与动态抓取数据完全匹配
- ✅ FT 详情页布局与实际系统一致（分类树 + 参数表）
- ✅ 数据行内容取自实际抓取 JSON
