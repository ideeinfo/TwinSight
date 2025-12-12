# 右侧属性面板编辑功能实现

## 概述
为右侧属性面板（RightPanel）添加了内联编辑功能，允许用户直接编辑资产和空间的属性值，并实时保存到数据库。

## 主要功能

### 1. 内联编辑
- **单击进入编辑**：点击属性值即可进入编辑模式
- **回车确认**：按 Enter 键保存更改
- **ESC取消**：按 Esc 键取消编辑
- **失焦自动保存**：点击其他区域时自动保存

### 2. 字段类型支持
- **文本字段**：普通文本输入（如：名称、制造商、地址等）
- **数字字段**：数值输入（如：面积、周长）
- **只读字段**：主键字段不可编辑（如：资产编码、空间编码）

### 3. 编辑权限
- **单选模式**：可以编辑所有非主键字段
- **多选模式**：禁用编辑功能（防止批量错误更新）
- **视觉反馈**：编辑状态有蓝色边框高亮

## 技术实现

### 前端组件

#### 1. EditableField.vue（新建）
可复用的编辑字段组件，特性：
- 支持 v-model 双向绑定
- 支持不同字段类型（text, number, date）
- 禁用状态支持
- 自动聚焦和文本选择
- 键盘快捷键（Enter/Esc）

#### 2. RightPanel.vue（更新）
集成编辑功能：
- 引入 EditableField 组件
- 定义字段类型映射（assetFieldTypes, spaceFieldTypes）
- 实现 handleField Change 方法调用 API
- 字段到数据库列名的映射

### 后端 API

#### 1. 新增路由（server/routes/api.js）
- `PATCH /api/assets/:code`：更新资产属性
- `PATCH /api/spaces/:code`：更新空间属性

#### 2. Model 层方法
- `asset.js`：添加 `updateAsset(assetCode, updates)` 方法
- `space.js`：添加 `updateSpace(spaceCode, updates)` 方法

### 数据库更新
使用动态 SQL 构建 UPDATE 语句：
```sql
UPDATE assets
SET field1 = $1, field2 = $2, updated_at = CURRENT_TIMESTAMP
WHERE asset_code = $3
```

## 可编辑字段列表

### 资产（Assets）
| 字段 | 类型 | 说明 |
|------|------|------|
| mcCode | readonly | 资产编码（主键，不可编辑） |
| typeComments | text | 规格编码 |
| specName | text | 规格名称 |
| name | text | 名称 |
| level | text | 楼层 |
| room | text | 房间 |
| omniClass21Number | text | 分类编码 |
| omniClass21Description | text | 分类描述 |
| category | text | 类别 |
| family | text | 族 |
| type | text | 类型 |
| manufacturer | text | 制造商 |
| address | text | 地址 |
| phone | text | 电话 |

### 空间（Spaces）
| 字段 | 类型 | 说明 |
|------|------|------|
| code | readonly | 空间编码（主键，不可编辑） |
| name | text | 名称 |
| area | number | 面积 |
| perimeter | number | 周长 |
| level | text | 楼层 |
| spaceNumber | text | 分类编码 |
| spaceDescription | text | 分类描述 |

## 用户体验

### 视觉反馈
1. **编辑状态**：
   - 蓝色边框 (#0078d4)
   - 外发光效果 (box-shadow)
   - 背景色保持一致

2.**悬停提示**：
   - 悬停时背景变浅
   - 边框颜色变亮
   - 鼠标变为文本输入光标

3. **禁用状态**：
   - 灰色文本
   - 普通光标
   - 无交互效果

### 错误处理
- API 调用失败时显示错误提示
- 国际化错误消息（中英文）
- 更新失败不影响其他操作

## 国际化支持
添加了新的翻译键：
- `common.saveFailed`：保存失败
- `common.saveSuccess`：保存成功

## 安全性
- **字段白名单**：只允许更新预定义的字段
- **主键保护**：不允许更新主键字段
- **多选保护**：多选状态下禁用编辑

## 未来扩展
- [ ] 支持日期选择器（date 类型）
- [ ] 支持下拉选择（枚举值）
- [ ] 批量编辑功能
- [ ] 撤销/重做功能
- [ ] 编辑历史记录
