# 视图管理功能实现计划

## 功能概述
在多语言选择左侧添加"视图"按钮，打开侧边面板管理模型视图状态。

## 需求分析

### 1. 视图数据内容
- 摄像机位置和视角 (camera state)
- 构件隐藏/显示状态 (isolation state)
- 构件选中状态 (selection)
- 构件材质颜色 (theming colors)
- Forge Viewer环境主题 (environment)
- 其他显示设置 (cutplanes, explode, etc.)

### 2. 功能点
- **保存**: 使用当前文件标题作为视图名称
- **另存为**: 弹窗输入自定义名称
- **恢复视图**: 点击缩略图/名称恢复状态
- **过渡动画**: 视图切换时平滑过渡
- **显示模式**: 列表/缩略图两种
- **搜索排序**: 按名称搜索和排序

## 技术方案

### 1. 数据库表设计
```sql
CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES model_files(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  thumbnail TEXT,  -- Base64编码的缩略图
  camera_state JSONB,  -- 摄像机状态
  isolation_state JSONB,  -- 隐藏/显示状态
  selection_state JSONB,  -- 选中状态
  theming_state JSONB,  -- 材质颜色
  environment VARCHAR(100),  -- 环境主题
  other_settings JSONB,  -- 其他设置
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, name)
);
```

### 2. 后端API
- GET /api/views?fileId=xxx - 获取视图列表
- GET /api/views/:id - 获取单个视图
- POST /api/views - 创建视图
- PUT /api/views/:id - 更新视图
- DELETE /api/views/:id - 删除视图

### 3. 前端组件
- ViewsPanel.vue - 主面板组件
- 集成到App.vue顶部栏

### 4. Forge Viewer API
- viewer.getState() - 获取当前状态
- viewer.restoreState(state) - 恢复状态
- viewer.impl.invalidate(true) - 刷新视图
- 截图: viewer.getScreenShot()

## 实现步骤

1. 创建数据库表
2. 创建后端模型和路由
3. 创建ViewsPanel组件
4. 集成到App.vue
5. 实现视图保存/恢复逻辑
6. 添加国际化文本
7. 测试和优化
