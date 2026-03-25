# Tandem Manage 页面设计 - Walkthrough

## 完成内容

在 `twinsight.pen` 中新建 3 个 Manage 页面 + 3 个操作对话框（按 Tandem 原系统风格设计）。

> [!IMPORTANT]
> JSON 抓取数据中 `modals: []` 全为空（对话框需点击按钮才弹出，静态抓取无法获取）。对话框根据用户提供的 Tandem 实际截图重建。

## 最终设计

````carousel
![Facility Templates + ADD FACILITY TEMPLATE](/Users/diwei/.gemini/antigravity/brain/277c5996-cf39-43c3-b6f0-6dd61cffb8f0/MYew6.png)
<!-- slide -->
![Parameters + ADD PARAMETER](/Users/diwei/.gemini/antigravity/brain/277c5996-cf39-43c3-b6f0-6dd61cffb8f0/NiXSK.png)
<!-- slide -->
![Classifications + ADD CLASSIFICATION SYSTEM](/Users/diwei/.gemini/antigravity/brain/277c5996-cf39-43c3-b6f0-6dd61cffb8f0/erQUO.png)
````

## 对话框字段

| 对话框 | 字段 |
|--------|------|
| ADD FACILITY TEMPLATE | Name* + Classification System ↓ + Description |
| ADD PARAMETER | Name* + Category ↓ + Context ↓ + Description + Data Type ↓ + Restrict to specific values |
| ADD CLASSIFICATION SYSTEM | Name* + Format ↓ + Upload File 拖拽区 |

## 设计规格

- 标题：大写粗体 20px，间距 1px
- 活跃输入框：`#38ABDF` 2px 边框
- 按钮：Cancel(描边) + OK(#38ABDF 填充)
- 遮罩：`#071015CC`
