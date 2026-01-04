# BIM数字孪生平台首页重新设计

## 设计理念

### "工业精密" (Industrial Precision) 美学方向

- **专业可靠**: 采用深色主题,符合工程软件的视觉习惯
- **数据驱动**: 清晰的信息层级和可视化展示
- **现代科技**: 结合渐变、动画等现代设计元素
- **国际化**: 完整的中英文支持

## 设计特点

### 1. 视觉设计
- **字体系统**:
  - 展示字体: Space Grotesk (几何、现代)
  - 正文字体: IBM Plex Sans (专业、技术感)
- **配色方案**: 深色背景 (#0a0a0f) + 青色/紫色渐变强调
- **动画效果**: 页面加载时的交错淡入动画,增强视觉吸引力

### 2. 核心功能区
- **Hero Section**: 动态背景网格 + 浮动数据点,展示核心价值主张
- **功能特性卡片**: 6大核心功能的网格布局,悬停交互效果
- **实时监控预览**: 可视化建筑模型和数据指标展示
- **CTA行动召唤**: 清晰的用户引导

### 3. 响应式设计
- 桌面端优先,完整体验
- 平板/移动端自适应布局
- 断点: 1024px, 768px

## 文件结构

```
src/
├── views/
│   └── HomeView.vue           # 新首页组件
├── components/
│   └── icons/
│       ├── Icon3D.vue        # 3D模型图标
│       ├── IconAssets.vue    # 资产图标
│       ├── IconIoT.vue       # IoT图标
│       ├── IconAI.vue        # AI图标
│       ├── IconDocs.vue      # 文档图标
│       └── IconExport.vue    # 导出图标
├── router/
│   └── index.js              # 路由配置
├── App.vue                   # 路由容器(新)
├── AppViewer.vue             # 原应用主界面
└── i18n/
    └── index.js              # 国际化配置(已更新)
```

## 路由配置

- `/` - 首页 (HomeView.vue)
- `/viewer` - 3D查看器 (AppViewer.vue)
- `/assets` - 资产管理 (AppViewer.vue)

## 使用方法

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问 `http://localhost:5173` 即可查看新首页

### 语言切换
应用支持中英文切换,默认为中文。可在应用内切换语言。

## 技术栈

- Vue 3 (Composition API)
- Vue Router 4
- Vue I18n
- Vite
- Element Plus

## 后续优化建议

1. **性能优化**:
   - 图片懒加载
   - 组件代码分割
   - CSS动画优化

2. **交互增强**:
   - 添加滚动触发动画
   - 鼠标跟随效果
   - 加载骨架屏

3. **数据集成**:
   - 连接实际API数据
   - 实时数据更新
   - 用户个性化内容

4. **可访问性**:
   - ARIA标签
   - 键盘导航
   - 屏幕阅读器支持

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

设计完成日期: 2025-12-29
版本: 1.0.0
