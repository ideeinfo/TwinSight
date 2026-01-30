# 系统配置中心 实施计划 (Implementation Plan)

## 1. 目标与背景 (Goal & Context)

### 目标
创建一个统一的"系统配置中心"，将现有分散在多处的配置项（时序数据库、LLM、AI 服务）集中管理，提供用户友好的 UI 界面进行配置。

### 背景
- 当前 InfluxDB 配置是 **per-model**（每个模型文件单独配置），实际使用中发现全局配置更合理
- 现有的 `InfluxConfigPanel.vue` 存在难以解决的 CSS 样式冲突问题
- LLM 配置目前是独立面板，应与其他系统配置一起管理
- 部分配置项散落在 `.env.local` 中，用户难以修改
- **已有 `system_config` 表**存储 AI 配置数据，需要扩展而非新建

### 预期收益
1. 统一的配置入口，提升用户体验
2. 解决样式冲突问题（重新开发，使用 Element Plus 原生样式）
3. InfluxDB 改为全局配置 + Tag 区分模型，简化运维
4. 代码结构更清晰

---

## 2. 实施状态

### ✅ 阶段 1: 数据库扩展 - 已完成

- [x] 创建迁移脚本 `server/migrations/007_extend_system_config.sql`
- [x] 扩展 `system_config` 表：添加 `config_type`, `category`, `label`, `sort_order` 字段
- [x] 更新现有 AI 配置数据的分类和标签
- [x] 插入 InfluxDB 配置项：URL、Port、Org、Bucket、Token、Enabled
- [x] 创建分类索引

### ✅ 阶段 2: 后端 API 开发 - 已完成

- [x] 扩展 `server/services/config-service.js`：
  - [x] `getAllConfigs(category)` - 支持按分类筛选
  - [x] `getConfigRaw(key)` - 获取原始值（内部使用）
  - [x] `batchSetConfigs(configs)` - 批量更新配置
- [x] 扩展 `server/routes/v1/system-config.js`：
  - [x] `GET /api/v1/system-config` - 获取所有配置（按分类分组）
  - [x] `GET /api/v1/system-config/:category` - 按分类获取
  - [x] `POST /api/v1/system-config` - 批量更新配置
  - [x] `POST /api/v1/system-config/test-influx` - 测试 InfluxDB 连接

### ✅ 阶段 3: 前端组件开发 - 已完成

- [x] 创建 `src/components/SystemConfigPanel.vue`：
  - [x] 使用 `el-dialog` + `el-tabs` 布局
  - [x] Tab 1: 时序数据库 (InfluxDB) 配置
  - [x] Tab 2: AI 服务配置
  - [x] 动态渲染表单项（根据 `config_type`）
  - [x] 测试连接功能（InfluxDB、LLM）
  - [x] 批量保存配置
  - [x] **只使用 Element Plus 变量**，避免自定义颜色

### ✅ 阶段 4: 入口修改 - 已完成

- [x] 修改 `src/components/UserDropdown.vue`：
  - [x] 将"AI 设置"按钮改为"系统配置"
  - [x] 引用 `SystemConfigPanel.vue` 替代 `LLMConfigPanel.vue`
- [x] 修改 `src/components/FilePanel.vue`：
  - [x] 移除"时序数据库配置"菜单项
  - [x] 移除 `InfluxConfigPanel` 引用和相关状态
- [x] 修改 `server/routes/v1/timeseries.js`：
  - [x] 改为从 `system_config` 表读取 InfluxDB 配置
  - [x] 添加配置缓存（60秒）
  - [x] 回退到环境变量配置（兼容性）

### ✅ 阶段 5: 清理废弃代码 - 已完成

- [x] 标记 `src/components/InfluxConfigPanel.vue` 为 deprecated
- [x] 标记 `src/components/LLMConfigPanel.vue` 为 deprecated
- [ ] `server/models/influx-config.js` - 文件保留但不再使用
- [ ] `influx_configs` 表 - 数据库表保留但不再使用

---

## 3. 验证结果

### 构建验证
- [x] 前端 `npm run build` 成功
- [x] 后端启动无错误
- [x] 数据库迁移执行成功

### 待手动验证
- [ ] 从右上角下拉菜单打开"系统配置"面板
- [ ] 检查所有配置项是否正确显示（包括现有 AI 配置）
- [ ] 修改 InfluxDB 配置并保存，验证数据库已更新
- [ ] 点击"测试连接"，验证 InfluxDB 连接测试正常
- [ ] 修改 AI 服务配置并保存
- [ ] 点击"测试连接"，验证 LLM 连接测试正常
- [ ] 检查深色/浅色模式下的 UI 样式

---

## 4. 文件变更清单

| 文件路径 | 操作 | 状态 |
|---------|------|------|
| `server/migrations/007_extend_system_config.sql` | 新建 | ✅ |
| `server/scripts/run-migration-007.mjs` | 新建 | ✅ |
| `server/services/config-service.js` | 修改 | ✅ |
| `server/routes/v1/system-config.js` | 修改 | ✅ |
| `server/routes/v1/timeseries.js` | 修改 | ✅ |
| `src/components/SystemConfigPanel.vue` | 新建 | ✅ |
| `src/components/UserDropdown.vue` | 修改 | ✅ |
| `src/components/FilePanel.vue` | 修改 | ✅ |
| `src/components/InfluxConfigPanel.vue` | 标记废弃 | ✅ |
| `src/components/LLMConfigPanel.vue` | 标记废弃 | ✅ |

---

## 5. 审批与执行记录

- [x] **计划审批**：2026-01-30
- [x] **开始执行**：2026-01-30
- [x] **执行完成**：2026-01-30
