# 模型视图嵌入式分享功能

## 需求概述

实现一个模型视图分享功能，允许用户生成一个可嵌入的URL，外部系统可以在iframe中调用该URL来展示3D模型查看器。

**核心功能**:
- 无需主系统登录，通过分享token实现长期有效的访问授权
- 精简的嵌入式界面，只显示模型区域和时间轴
- 支持温度标签显示、热力图叠加
- 支持时间轴播放功能

## 用户审核项目

> [!IMPORTANT]
> **Token有效期配置**
> 默认设置分享token有效期为 **90天**，可在创建分享链接时自定义（支持30天、90天、365天、永久）。请确认这个设置是否符合您的安全需求。

> [!WARNING]
> **跨域嵌入安全**
> 嵌入式页面将使用 `X-Frame-Options` 和 CSP 策略控制允许的嵌入域名。默认允许所有域名嵌入（`*`），如需限制，请说明允许嵌入的域名列表。

> [!IMPORTANT]
> **数据访问范围**
> 分享链接将只允许访问该模型文件对应的数据（时间序列数据、房间信息等）。是否需要在分享时可选择限制：
> 1. 时间范围（如仅显示最近7天数据）
> 2. 功能限制（如禁用AI分析按钮）


## 技术设计

### 分享Token机制

```
生成流程:
┌──────────┐    ┌──────────────┐    ┌────────────────┐
│ 用户点击 │───▶│ 后端生成token │───▶│ 存储到数据库    │
│ 分享按钮 │    │ (UUID+签名)  │    │ (model_shares) │
└──────────┘    └──────────────┘    └────────────────┘

访问流程:
┌────────────────┐    ┌─────────────────┐    ┌──────────────┐
│ 外部系统iframe │───▶│ 验证token有效性  │───▶│ 渲染嵌入视图 │
│ /embed/:token  │    │ (检查过期/权限)  │    │ EmbedViewer │
└────────────────┘    └─────────────────┘    └──────────────┘
```

---

## 数据库变更

### [NEW] 分享链接表

```sql
-- 模型分享链接表
CREATE TABLE model_shares (
    id SERIAL PRIMARY KEY,
    share_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id),
    
    -- 视图配置（JSON存储初始视图状态）
    view_config JSONB,
    
    -- 功能开关
    enable_heatmap BOOLEAN DEFAULT true,
    enable_tags BOOLEAN DEFAULT true,
    enable_timeline BOOLEAN DEFAULT true,
    enable_playback BOOLEAN DEFAULT true,
    
    -- 时间范围限制（可选）
    time_range_start TIMESTAMP WITH TIME ZONE,
    time_range_end TIMESTAMP WITH TIME ZONE,
    
    -- 访问控制
    expires_at TIMESTAMP WITH TIME ZONE,  -- NULL表示永久有效
    access_count INTEGER DEFAULT 0,
    max_access_count INTEGER,  -- NULL表示无限制
    
    -- 元数据
    name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- 索引
CREATE INDEX idx_model_shares_token ON model_shares(share_token);
CREATE INDEX idx_model_shares_file_id ON model_shares(file_id);
CREATE INDEX idx_model_shares_expires ON model_shares(expires_at) WHERE is_active = true;
```

---

## 后端变更

### [NEW] [model-shares.js](file:///d:/TwinSIght/antigravity/twinsight/server/routes/v1/model-shares.js)

分享链接管理API路由：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/shares` | POST | 创建分享链接 |
| `/api/v1/shares` | GET | 获取当前用户的分享列表 |
| `/api/v1/shares/:token` | GET | 获取分享详情（公开访问） |
| `/api/v1/shares/:id` | PATCH | 更新分享设置 |
| `/api/v1/shares/:id` | DELETE | 撤销分享链接 |

---

### [NEW] [embed-auth.js](file:///d:/TwinSIght/antigravity/twinsight/server/middleware/embed-auth.js)

嵌入式访问认证中间件：

```javascript
// 验证分享token的中间件
export const validateShareToken = async (req, res, next) => {
    const { token } = req.params;
    
    // 1. 查询分享记录
    // 2. 验证未过期、未禁用
    // 3. 更新访问计数
    // 4. 注入文件ID和权限到req
};
```

---

### [MODIFY] [index.js](file:///d:/TwinSIght/antigravity/twinsight/server/routes/v1/index.js)

注册分享相关路由。

---

## 前端变更

### [NEW] [EmbedViewer.vue](file:///d:/TwinSIght/antigravity/twinsight/src/views/EmbedViewer.vue)

嵌入式查看器视图组件，核心结构：

```vue
<template>
  <div class="embed-container">
    <!-- 精简版3D查看器 -->
    <div class="viewer-area">
      <div id="forgeViewer" ref="viewerContainer"></div>
      
      <!-- IoT数据标签 -->
      <OverlayTags v-if="shareConfig.enableTags" :tags="roomTags" />
    </div>
    
    <!-- 底部时间轴 -->
    <TimelineControl
      v-if="shareConfig.enableTimeline"
      :is-playing="isPlaying"
      :playback-speed="playbackSpeed"
      ...
    />
  </div>
</template>
```

**关键特性**:
- 无顶部导航栏、无左右侧边栏
- 保留3D模型渲染（复用 `useViewer` composable）
- 保留时间轴控制（复用 `TimelineControl` 组件）
- 保留温度标签（复用 `OverlayTags` 组件）
- 保留热力图功能（复用 `heatmap` 相关逻辑）
- 添加 `postMessage` API供父页面控制

---

### [MODIFY] [index.js](file:///d:/TwinSIght/antigravity/twinsight/src/router/index.js)

添加嵌入式路由：

```javascript
{
  path: '/embed/:shareToken',
  name: 'Embed',
  component: () => import('../views/EmbedViewer.vue'),
  meta: { embedded: true, noAuth: true }
}
```

---

### [NEW] [ShareButton.vue](file:///d:/TwinSIght/antigravity/twinsight/src/components/ShareButton.vue)

分享按钮组件，用于在 `TopBar` 或 `ViewsPanel` 中触发分享对话框。

---

### [NEW] [ShareDialog.vue](file:///d:/TwinSIght/antigravity/twinsight/src/components/ShareDialog.vue)

分享配置对话框，允许用户：
- 设置分享有效期
- 选择开启/关闭的功能
- 生成并复制分享链接或iframe代码

---

## 验证计划

### 功能测试（人工测试）

1. **分享链接生成测试**
   - 打开模型查看器
   - 点击分享按钮
   - 配置分享选项并生成链接
   - 验证数据库中创建了分享记录

2. **嵌入式视图测试**
   - 在浏览器新标签页打开生成的分享链接
   - 验证3D模型正确加载
   - 验证时间轴显示并可播放
   - 验证温度标签显示
   - 验证热力图可开启/关闭

3. **iframe嵌入测试**
   - 创建测试HTML文件，使用iframe嵌入分享链接
   - 验证在不同域名下正常显示

4. **Token过期测试**
   - 手动修改数据库中的 `expires_at` 为过去时间
   - 访问分享链接，验证显示"链接已过期"提示

### 浏览器自动化测试

通过 `browser_subagent` 工具执行以下测试：
1. 导航到嵌入式视图URL
2. 验证页面元素（3D画布、时间轴、标签）存在
3. 模拟时间轴播放操作
4. 截图记录测试结果

---

## 实现步骤

| 步骤 | 内容 | 预计工具调用 |
|------|------|-------------|
| 1 | 创建数据库迁移脚本 | 1-2 |
| 2 | 实现后端分享API路由 | 3-5 |
| 3 | 创建 `EmbedViewer.vue` | 5-8 |
| 4 | 添加前端路由配置 | 1 |
| 5 | 创建分享按钮和对话框组件 | 3-5 |
| 6 | 集成到现有界面 | 2-3 |
| 7 | 测试和验证 | 3-5 |

**总计预估: 18-29 次工具调用**

---

## 生成的分享链接示例

```
完整链接:
https://your-domain.com/embed/550e8400-e29b-41d4-a716-446655440000

iframe 嵌入代码:
<iframe 
  src="https://your-domain.com/embed/550e8400-e29b-41d4-a716-446655440000" 
  width="100%" 
  height="600" 
  frameborder="0"
  allow="fullscreen"
></iframe>
```
