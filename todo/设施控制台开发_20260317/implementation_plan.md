# 设施控制台开发实施计划

## 1. 目标与背景

当前设计稿已经基本稳定，接下来应从数据库和后端基础层开始，逐步落到前端控制台页面，而不是直接改造现有 viewer。核心目标如下：

- 建立 `facility` 这一层业务实体，并与现有 `model_files` 建立稳定关联
- 兼容当前服务启动前自动执行 `server/migrations` 目录下 `.sql` 迁移脚本的机制
- 让当前数据库中的所有历史 `model_files` 在升级后立即映射为可用的 `facilities`
- 先落地 `Facilities` 页面闭环，再扩展 `Home` 和 `Manage`
- 保持现有 `/viewer` 作为设施内主视图入口，避免一次性改造过大

当前已确认的约束：

- 自动迁移入口为 [server/scripts/migrate.js](/Volumes/DATA/antigravity/TwinSight/server/scripts/migrate.js:1)
- 迁移器只会执行 `server/migrations` 目录下按文件名字典序排列的 `.sql` 文件
- 当前数据库里已有 `model_files` 表，且存在历史数据
- 当前前端和后端代码已经预留了 `facilityId` 概念，但数据库尚未正式落表

## 2. 设计与架构原则

- 设施与模型采用第一期最小闭环：`一条 facility 对多条 model_files`
- 历史数据初始化采用：`一条已有 model_file 自动生成一条同名 facility`
- 第一阶段不建立 `facility_model_relations` 中间表，直接在 `model_files` 表增加 `facility_id`
- 第一阶段不落 `dashboard` 数据表，仅在接口和页面中保留占位
- 第一阶段不改造现有 `views` 表结构，继续以 `file_id` 为核心，按 facility 聚合展示
- 文档/档案归属采用两阶段方案：
  - 阶段一：先为 `documents` 增加 `facility_id` 并完成历史数据回填
  - 阶段二：待 `Facilities` 页面落地后，再接 facility 维度的文档筛选、展示与联动
- 删除 facility 时，不级联删除 model files，改为 `model_files.facility_id = NULL`

## 3. 分阶段实施计划

---

### 3.1 阶段一：数据库迁移与历史数据初始化

#### 目标

建立 `facilities` 表，并将当前所有历史 `model_files` 自动映射为独立设施。

#### [NEW] [011_facilities.sql](/Volumes/DATA/antigravity/TwinSight/server/migrations/011_facilities.sql)

迁移脚本必须完成以下内容：

- 创建 `facilities` 表
- 给 `model_files` 增加 `facility_id` 字段
- 给 `model_files` 增加 `display_order` 字段
- 创建索引和 `updated_at` 触发器
- 为所有当前存在且尚未绑定 facility 的 `model_files` 各创建一条 facility
- 用生成的 facility 回填 `model_files.facility_id`

#### `facilities` 表建议字段

```sql
id SERIAL PRIMARY KEY
facility_code VARCHAR(64) NOT NULL UNIQUE
name VARCHAR(255) NOT NULL
description TEXT
address VARCHAR(500)
cover_image_path VARCHAR(1000)
status VARCHAR(20) NOT NULL DEFAULT 'active'
metadata JSONB NOT NULL DEFAULT '{}'::jsonb
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

#### `model_files` 表新增字段

- `facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL`
- `display_order INTEGER NOT NULL DEFAULT 0`

#### 历史数据初始化规则

- 为每条 `model_files` 创建一条对应的 `facility`
- `facility.name = model_files.title`
- `facility_code = 'FAC-MF-' || model_files.id`
- `description = '初始化自模型文件: ' || COALESCE(original_name, title)`
- `metadata.seededFromModelFileId = model_files.id`
- 回填时仅处理 `facility_id IS NULL` 的记录

#### 幂等性要求

- 必须使用 `CREATE TABLE IF NOT EXISTS`
- 必须使用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- 插入初始化 facility 时必须基于 `facility_code` 去重
- 回填 `model_files.facility_id` 时不能覆盖已有人工数据

#### 验收标准

- 任意环境执行迁移时，和 `model_files` 数量无关
- 若 `model_files` 为 0 条，只建结构，不报错
- 若 `model_files` 为 N 条，则补齐 N 条 facility
- 重复执行迁移不会重复插入设施数据

---

### 3.2 阶段二：模型文件数据层补齐

#### 目标

让后端真正支持按 `facilityId` 过滤和更新模型元数据，补上当前代码中的缺失实现。

#### [MODIFY] [model-file.js](/Volumes/DATA/antigravity/TwinSight/server/models/model-file.js:1)

需要补齐和调整：

- `getAllModelFiles(options)` 支持 `facilityId` 过滤
- `createModelFile(data)` 支持写入 `facility_id`
- 新增 `updateModelFile(id, updates)` 方法
- 返回字段中统一带出 `facility_id` 和 `display_order`

#### 当前已知缺口

[routes/v1/models.js](/Volumes/DATA/antigravity/TwinSight/server/routes/v1/models.js:1) 已调用 `modelFileModel.updateModelFile(...)`，但 [model-file.js](/Volumes/DATA/antigravity/TwinSight/server/models/model-file.js:1) 里并没有这个实现，属于先天不完整。

#### 具体调整建议

- `GET /api/v1/models?facilityId=...` 不再先查全表再内存过滤
- SQL 层直接支持：
  - 无 `facilityId` 时查全部
  - 有 `facilityId` 时按 `facility_id` 过滤
- 排序建议统一为：
  - `display_order ASC`
  - `created_at DESC`
  - `id DESC`

#### 验收标准

- `GET /api/v1/models` 正常返回
- `GET /api/v1/models?facilityId=<id>` 正常过滤
- `PUT /api/v1/models/:id` 可更新 `facilityId` 与 `displayOrder`

---

### 3.3 阶段三：设施后端 API

#### 目标

建立 `facility` 的最小后端闭环，支撑 `Facilities` 页面。

#### [NEW] `server/models/facility.js`

建议实现以下数据层方法：

- `getAllFacilities()`
- `getFacilityById(id)`
- `getFacilityWithModels(id)`
- `createFacility(data)`
- `updateFacility(id, data)`
- `deleteFacility(id)`

#### [NEW] `server/routes/v1/facilities.js`

建议实现以下接口：

- `GET /api/v1/facilities`
- `POST /api/v1/facilities`
- `GET /api/v1/facilities/:id`
- `PATCH /api/v1/facilities/:id`
- `DELETE /api/v1/facilities/:id`
- `GET /api/v1/facilities/:id/models`
- `GET /api/v1/facilities/:id/detail`

#### [MODIFY] [routes/v1/index.js](/Volumes/DATA/antigravity/TwinSight/server/routes/v1/index.js:1)

- 取消 `facilitiesRouter` 的预留状态
- 正式挂载 `/facilities`

#### `GET /api/v1/facilities` 返回建议

列表页建议直接返回可渲染数据，减少前端二次拼接：

- `id`
- `facilityCode`
- `name`
- `description`
- `address`
- `coverImagePath`
- `status`
- `modelCount`
- `viewCount`
- `defaultModelId`
- `createdAt`
- `updatedAt`

#### `GET /api/v1/facilities/:id/detail` 返回建议

- facility 基本信息
- 该 facility 下的 model files
- 每个 model file 对应的 views 列表
- `dashboardCount` 先返回 `0`

#### 验收标准

- 新环境能创建 facility
- 历史环境能看到迁移生成的设施列表
- 能按 facility 查看 models
- 能删除空 facility，删除后不会删除 model_files

---

### 3.4 阶段四：上传链路兼容

#### 目标

在不破坏当前模型上传流程的前提下，支持将新上传模型归属到某个 facility。

#### [MODIFY] [routes/files.js](/Volumes/DATA/antigravity/TwinSight/server/routes/files.js:1)

第一期只做兼容增强：

- 上传接口支持可选 `facilityId`
- 若前端传入 `facilityId`，则新模型写入该 facility
- 若未传入，则允许 `facility_id = NULL`
- 不在上传接口中隐式创建 facility

#### 说明

由于阶段一已经为历史模型各自创建 facility，因此“历史数据承接”不需要在上传链路兜底处理。

#### 验收标准

- 原有上传流程可继续使用
- 新上传模型可绑定 facility
- 未绑定 facility 的新模型不会导致接口报错

---

### 3.5 阶段五：文档按 Facility 归属（阶段一，只做数据层）

#### 目标

先把文档归属从“隐式推导”升级为“显式 facility 外键”，但暂不在前端页面暴露复杂交互。

#### [NEW] [012_document_facility_scope.sql](/Volumes/DATA/antigravity/TwinSight/server/migrations/012_document_facility_scope.sql)

迁移脚本建议完成以下内容：

- 给 `documents` 表增加 `facility_id`
- 创建 `idx_documents_facility_id`
- 按既定优先级回填历史文档的 `facility_id`

建议字段：

- `facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL`

#### 历史数据回填规则

按以下优先级推导文档归属：

1. 若文档关联 `asset_code`，则通过 `assets.file_id -> model_files.facility_id` 回填
2. 若未命中且文档关联 `space_code`，则通过 `spaces.file_id -> model_files.facility_id` 回填
3. 若未命中且文档关联 `spec_code`，则通过 `asset_specs.file_id -> model_files.facility_id` 回填
4. 若文档表未来存在直接 `file_id` 字段，则再按 `file_id -> model_files.facility_id` 回填
5. 仍无法推导的文档保持 `facility_id = NULL`

#### 幂等性要求

- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- 回填只处理 `documents.facility_id IS NULL`
- 不覆盖人工修正过的 facility 归属

#### 说明

这一阶段只做数据库结构和历史回填，不改前端页面，不做文档管理 UI 的 facility 交互。

#### 验收标准

- `documents` 表具备 `facility_id`
- 可从数据库中按 facility 统计文档数量
- 历史文档完成最大可能的自动归属

---

### 3.6 阶段六：控制台路由与共享布局

#### 目标

先搭建控制台壳子，再逐页接入设计稿，避免在多个页面中重复实现相同布局。

#### [MODIFY] [src/router/index.js](/Volumes/DATA/antigravity/TwinSight/src/router/index.js:1)

增加控制台路由：

- `/dashboard/home`
- `/dashboard/facilities`
- `/dashboard/manage`

也可根据最终产品选择直接使用：

- `/`
- `/facilities`
- `/manage`

但不建议一开始直接替换现有 viewer 路由。

#### [NEW] `src/layouts/DashboardLayout.vue`

共享内容：

- 顶部系统栏
- 统一页面容器
- 控制台导航
- 主题切换入口位置规范
- 页面标题区与内容区骨架

#### [MODIFY] [TopBar.vue](/Volumes/DATA/antigravity/TwinSight/src/components/TopBar.vue:1)

按设计稿收敛为控制台顶部栏：

- 使用现有 logo
- 工作区文案
- 顶部导航项
- 右侧操作区
- 不在一级界面暴露主题切换按钮

#### 验收标准

- Home / Facilities / Manage 三页可共享同一控制台壳子
- 顶栏、间距、导航状态一致
- 不影响现有 `/viewer`

---

### 3.7 阶段七：Facilities 页面开发

#### 目标

优先完成业务最完整、最接近真实使用场景的页面。

#### [NEW] `src/views/dashboard/FacilitiesView.vue`

实现顺序建议：

1. 静态布局
2. 对接 `GET /api/v1/facilities`
3. 左侧设施列表
4. 列表/缩略图切换
5. 右侧 facility 详情面板
6. views 列表与 view 操作菜单
7. dashboard 占位区
8. “打开设施”动作接到现有 `/viewer`

#### 关键交互

- 单击 facility：右侧显示该 facility 的 model/views 信息
- 双击 facility：进入设施页 mainview
- 右侧“打开设施”按钮：进入 mainview
- 列表项上下文菜单：
  - 打开设施
  - 编辑设施
  - 删除设施
- view 项上下文菜单：
  - 设为默认
  - 重命名
  - 删除

#### 依赖接口

- `GET /api/v1/facilities`
- `GET /api/v1/facilities/:id/detail`
- `PATCH /api/v1/models/:id`
- 现有 `views` API

#### 验收标准

- 能看到历史迁移生成的 facilities
- 点击设施能看到右侧详情
- 可打开 viewer
- view 列表能正确显示

---

### 3.8 阶段八：文档按 Facility 归属（阶段二，页面与业务联动）

#### 目标

在 `Facilities` 页面完成后，再把 facility 维度的档案归属体现在页面、筛选和业务流中。

#### [MODIFY] 文档后端接口

需要扩展的能力：

- 文档查询支持 `facilityId`
- 文档上传/更新支持显式传入 `facilityId`
- 若前端未传入，则按关联的 `assetCode / spaceCode / specCode / fileId` 自动推导

建议涉及文件：

- `server/models/document.js`
- `server/routes/documents.js`
- 若文档管理入口实际走 v2 路由，则同步修改 `server/routes/v2/*`

#### [MODIFY] 前端文档管理与 Facility 页联动

建议内容：

- `DocumentManager` 支持按 `facility` 过滤文档
- 在 `Facilities` 页面右侧详情区增加 `Documents` / `Archives` 概览
- 在 facility 上下文中打开文档管理时，默认带入当前 `facilityId`

#### 说明

这一阶段依赖 `Facilities` 页面已经可用，否则文档按 facility 归属缺少稳定入口和上下文。

#### 验收标准

- 在 facility 详情中可看到该设施下的文档数量或文档入口
- 文档管理页支持按 facility 过滤
- 文档上传后可正确落到目标 facility

---

### 3.9 阶段九：Home 页面开发

#### 目标

复用已沉淀的布局和卡片组件，实现新的控制台首页。

#### [NEW] `src/views/dashboard/HomeDashboardView.vue`

内容范围：

- 顶部欢迎区
- 统计卡
- Recent Facilities
- Workspace Status

#### 实施原则

- 优先复用 `Facilities` 页面中已经实现的卡片、状态块、图像卡、主题 token
- 不再沿用旧版营销首页 [HomeView.vue](/Volumes/DATA/antigravity/TwinSight/src/views/HomeView.vue:1) 的信息架构

#### 验收标准

- 与设计稿整体风格一致
- 支持深浅主题
- Recent Facilities 可跳转到具体 facility

---

### 3.10 阶段十：Manage 页面开发

#### 目标

在控制台主流程稳定后，再接入配置和模板管理页。

#### [NEW] `src/views/dashboard/ManageView.vue`

第一期只实现：

- 左侧二级导航
- Facility Templates 页面
- 说明 banner
- 主操作按钮
- Library 开关
- 搜索框
- 表格骨架

#### 说明

`Manage` 视觉上简单，但数据结构和表单/模板定义复杂度更高，不适合抢在 `Facilities` 前面做。

#### 验收标准

- 页面结构与设计稿对齐
- 二级导航、表格和工具区排版稳定
- 保留后续接真实模板数据的扩展位

---

### 3.11 阶段十一：设施页与现有 Viewer 接入

#### 目标

将 `Facilities` 页面与现有 `/viewer` 工作流打通。

#### [MODIFY] [src/AppViewer.vue](/Volumes/DATA/antigravity/TwinSight/src/AppViewer.vue:1)

第一期接入方式建议最保守：

- 通过路由参数或 query 传入 `facilityId` / `fileId`
- 优先解析目标 `fileId`
- viewer 仍以 `model_files` 为主加载对象

#### 说明

这一阶段不强行把 viewer 彻底改造成“facility-first”，只做入口打通。

#### 验收标准

- 从 `Facilities` 页面点击“打开设施”能进入目标 viewer
- 进入后能加载正确模型
- 不影响原有 viewer 打开方式

## 4. 验证计划

### 4.1 数据库验证

```bash
cd /Volumes/DATA/antigravity/TwinSight/server
node scripts/migrate.js
```

验证项：

- [ ] `011_facilities.sql` 被自动执行
- [ ] `facilities` 表已创建
- [ ] 当前所有 `model_files` 都拥有对应 `facility_id`
- [ ] `facility.name` 与对应 `model_files.title` 一致
- [ ] 重复执行迁移不会重复插入

### 4.2 后端验证

```bash
cd /Volumes/DATA/antigravity/TwinSight/server
node --watch index.js
```

接口验证：

- [ ] `GET /api/v1/facilities`
- [ ] `GET /api/v1/facilities/:id/detail`
- [ ] `GET /api/v1/models?facilityId=<id>`
- [ ] `PATCH /api/v1/models/:id`

### 4.3 前端验证

```bash
cd /Volumes/DATA/antigravity/TwinSight
npm run lint
npm run dev
```

页面验证：

- [ ] 控制台壳子正常加载
- [ ] `Facilities` 页面列表与详情交互正常
- [ ] `Home` 页面卡片和主题正常
- [ ] `Manage` 页面结构稳定
- [ ] 从 `Facilities` 打开 viewer 成功

## 5. 推荐执行顺序

按以下批次推进最稳：

1. 数据库迁移 + `model-file.js` 修复
2. `facility` 后端 model + route + v1 挂载
3. 文档 `facility_id` 落库与历史回填（只做数据层）
4. 控制台共享布局 + 路由
5. `Facilities` 页面
6. facility 维度文档联动
7. `Home` 页面
8. `Manage` 页面
9. 与 `/viewer` 的入口打通

## 6. 当前阶段结论

从开发效率和风险控制看，应该先完成“数据库迁移 + 设施 API + 文档 facility 落库 + Facilities 页面”这一条主线。文档的 facility 数据层应先做，页面联动应延后到 `Facilities` 页面稳定之后。
