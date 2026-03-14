这是一份针对**模块2：属性、分类体系和设施模板**的详细开发计划。该计划基于PDF文档的文字描述及截图中的UI细节进行了深度解析，专为编码Agent设计，强调数据结构、业务逻辑与UI实现的精确对应。

---

# 模块开发任务书：属性、分类体系与设施模板

## 1. 总体概述
本模块旨在构建系统的核心元数据层。虽然目前系统仅支持单设施，但架构必须预留“设施层”扩展能力。核心逻辑是通过“设施模板”将“标准属性库”映射到“分类体系”的树状节点上，并实现属性的继承机制。构建一套可扩展的元数据管理系统。支持定义统一的属性库、树状分类体系，并通过“设施模板”将两者绑定。设计必须兼容未来的“多设施层（Facility Layer）”扩展需求。

**全局约束：**
*   **UI风格**：深色模式（Dark Mode），主色调为蓝色（参考截图中的按钮颜色），弹窗背景为深灰。
*   **数据ID**：所有数据库表主键强制使用UUID。
*   **国际化**：所有静态文本需抽离至多语言配置文件。

### 1.1 新增全局导航与页面入口要求
参考补充截图，系统在页面标题栏需要新增三个一级入口：
*   `Home`：系统首页
*   `Facilities`：设施页
*   `Manage`：管理页

新增导航与页面职责要求如下：
*   **登录后默认落点**：用户登录成功后，系统首先进入 `Home`，而不是直接进入某个设施或管理页。
*   **首页职责**：首页用于展示系统入口与设施选择，用户可以从首页选择进入某个设施。
*   **设施页职责**：`Facilities` 页用于创建、查看、编辑和管理设施，是设施列表与设施创建流程的统一入口。
*   **管理页职责**：`Manage` 页用于集中管理属性、分类体系、设施模板，不与设施运行页混合。
*   **导航一致性**：上述三个入口应作为全局顶栏导航，在登录后所有主页面保持一致显示。
*   **信息架构约束**：属性、分类体系、设施模板虽然属于基础数据，但其入口应挂在 `Manage` 下，而不是直接暴露在首页或设施页侧边栏中。

---

## 2. 数据库设计 (Schema Specification)
*   **全局主键**：所有新表（属性、分类、模板、关联表）必须使用 `UUID`。
*   **属性库表**：存储属性元数据（名称、数据类型、单位、精度、预设值列表）。
*   **分类体系表**：存储树状编码结构（Code, Description, Level, ParentID）。
*   **设施模板表**：存储模板基本信息及其与分类体系的映射关系。
*   **属性分配表**：存储“分类节点 <-> 属性”的关联，需支持**继承逻辑**。

### 2.1 属性库 (Properties)
*   **Table**: `sys_properties`
*   **Fields**:
    *   `id` (UUID, PK)
    *   `property_key` (String, unique) - 系统唯一业务键，供接口、映射和同步使用
    *   `name` (String) - 显示名称，**允许重名**
    *   `category_id` (UUID, FK, nullable) - 引用属性类别；创建属性时允许同时创建类别
    *   `context` (Enum: 'Element', 'Specification') - 对应文档中的“所属类型：构件/规格”
    *   `description` (Text)
    *   `data_type` (Enum: Text, Integer, Number, Boolean, DateTime, Link, Tag)
    *   `unit_code` (String, nullable) - 对应国标单位编码 (e.g., '20.10')
    *   `precision` (Integer, nullable) - 仅针对数值类型 (e.g., 2代表0.00)
    *   `constraints` (JSON) - 用于存储“限制为特定值”的列表或“链接”类型的URL配置。
    *   `is_system` (Boolean) - 标记是否为系统预置属性。

### 2.2 分类体系 (Classifications)
*   **Table**: `sys_classification_schemas` (体系元数据)
*   **Table**: `sys_classification_nodes` (树状节点)
    *   `id` (UUID, PK)
    *   `schema_id` (UUID, FK)
    *   `code` (String) - 分类编码 (e.g., '30-01')
    *   `description` (String)
    *   `level` (Integer)
    *   `parent_id` (UUID, self-reference) - 用于构建树
    *   `path` (String) - 辅助字段，用于快速查询子树 (e.g., '/root_id/parent_id/')

### 2.3 设施模板与映射 (Facility Templates & Mapping)
*   **Table**: `sys_facility_templates`
    *   `id` (UUID, PK)
    *   `name` (String)
    *   `classification_schema_id` (UUID, FK) - 一个模板绑定一套分类体系
*   **Table**: `rel_template_node_properties` (核心关联表)
    *   `template_id` (UUID, FK)
    *   `node_id` (UUID, FK) - 关联到具体分类节点
    *   `property_id` (UUID, FK)
    *   **Logic Constraint**: 联合主键 (`template_id`, `node_id`, `property_id`) 防止重复。

---

## 3. 核心子任务分解

### 子任务 A：统一属性库 (Property Library)
**目标**：实现资产、规格和空间通用的属性定义工具。
1.  **字段实现**：包含属性名称、类别、所属类型（元素面板/类型面板）、描述、数据类型。
2.  **复杂数据类型逻辑**：
    *   **数值/整数**：集成文档中的“国标单位表”（如：20.10 压力-mmHg）。
    *   **精度控制**：数值型需支持设置小数点位数（0.0, 0.00 等）。
    *   **限制特定值**：实现“标签式”输入界面，将属性值限制在预设列表中（类似下拉菜单）。
    *   **链接型**：支持配置指向系统内部条目或外部 URL。
3.  **安全约束**：已关联到分类体系的属性禁止编辑和删除。

### 子任务 B：分类体系管理 (Classification Systems)
**目标**：管理基于树状编码的资产分类（如 OmniClass 风格）。
1.  **文件处理**：开发 CSV/XLSX 解析器，按文档中的三列格式（Code, Description, Level）导入分类编码表。
2.  **校验逻辑**：上传时实时检查格式错误，不符合要求则报错。
3.  **UI 展现**：实现树形列表视图，支持按编码或描述搜索，支持导出为 Excel。
4.  **引用约束**：已被设施模板引用的分类体系禁止删除。

### 子任务 C：设施模板与属性分配 (Facility Templates)
**目标**：将分类节点与属性进行多对多绑定。
1.  **模板创建**：创建一个模板需指定一个唯一的分类体系。
2.  **属性分配界面（核心逻辑）**：
    *   **左侧树图**：展示分类编码树。
    *   **右侧列表**：展示当前节点已分配的属性。
    *   **继承机制**：**父节点分配的属性必须自动继承到所有子节点**。
    *   **高亮逻辑**：已分配属性的节点需高亮显示，并显示“已分配数/总属性数”。
3.  **快捷功能**：
    *   **复制到**：支持将当前节点的属性配置一键复制到其他节点。
    *   **属性视角分配**：支持从属性角度出发，勾选将其分配给哪些分类节点。
4.  **模板复制**：支持基于现有模板“另存为”新模板。

---

## 4. UI/UX 详细实现要求 (基于截图分析)
*   **PropertySelector**：带搜索和分组功能的属性选择框。
*   **ClassificationTree**：支持大数据量加载的树形组件，需带高亮状态标签。
*   **UnitPicker**：根据选择的数据类型动态加载对应的国标单位。
*   **符合全局 UI 风格**：尽量使用Element Plus的组件，支持深色/浅色系主题，保持按钮和对话框风格一致。

### 4.1 属性创建/编辑弹窗 (参考 Page 4, 9)
*   **组件类型**：Modal Dialog (深色背景)。
*   **布局**：
    *   **Header**：标题 "ADD PARAMETER" (左对齐)，关闭按钮 "X" (右对齐)。
    *   **Body**：
        *   Name: 输入框。
        *   Category & Context: 并排的两个下拉框。
        *   Description: 多行文本域。
        *   Data Type: 下拉框。
        *   **动态交互区域**：
            *   当选择 `Integer/Number` 时：显示 "Unit" 选择器（参考 Page 4 截图）。**Unit选择器**需支持搜索，且按类别分组（如 "Air Flow", "Pressure"），选中后显示 "20.10 压力-mmHg"。
            *   当选择 `Precision` 时：显示下拉列表 (Default, 0.0, 0.00...)。
            *   **“限制特定值”交互 (Page 9)**：显示为 Tag Input 组件。输入文本按回车生成一个胶囊状标签（Pill），支持点击 'x' 删除。UI需显示 "Restrict to specific values" 以及 toggle 开关。
    *   **Footer**：右下角 "Cancel" (灰色边框) 和 "OK" (实心蓝底) 按钮。

### 4.2 分类体系导入 (参考 Page 10, 11)
*   **导入交互**：
    *   支持 Drag & Drop 区域，提示文案 "Drag and drop a file here, or click to select a file"。
    *   支持 `.csv`, `.xlsx` 格式。
*   **预览与校验**：
    *   前端解析文件，展示为表格 (Code, Description, Level)。
    *   **校验逻辑**：上传即时检查 Level 逻辑是否正确（如 Level 2 的父级必须存在 Level 1），错误行需红框高亮提示。
*   **列表页**：
    *   Card 列表或表格，每行显示分类体系名称，点击展开/进入详情。

### 4.3 设施模板管理 - 分屏视图 (核心界面，参考 Page 12, 14)
*   **整体布局**：左右分栏（Split Pane）。
    *   **左侧：分类树 (Classification Tree)**
        *   带搜索框 "Search classifications"。
        *   **节点样式**：
            *   缩进显示层级。
            *   **计数器 Badge** (Page 14)：每个节点右侧显示 `[分配数]/[总属性数]` (e.g., `0/7`)。
            *   **高亮状态**：若节点已分配属性，字体或背景需高亮（蓝色）。
            *   **操作菜单**：Hover 节点时显示 "Copy to" 和 "Edit" 按钮（参考 Page 14 底部截图）。
    *   **右侧：属性列表 / 分配面板**
        *   **空状态** (Page 12)：显示图标及 "No assigned parameters"，居中显示蓝色按钮 "Assign Parameters"。
        *   **有数据状态** (Page 14)：表格显示已分配的属性。
            *   **继承标识**：如果是从父节点继承下来的属性，需以灰色或特殊图标标记（不可在当前节点删除）。
            *   **直接分配标识**：当前节点分配的属性，支持移除。

### 4.4 属性分配选择器 (参考 Page 13)
*   **组件**：大型 Modal。
*   **功能**：
    *   左侧/顶部：搜索栏、过滤条件（Library开关）。
    *   **列表项**：Card 或 List Item 布局。
        *   显示属性名、Category、DataType。
        *   **复选框**：左侧带 Checkbox，支持多选。
    *   **排序/分组**：支持按 Name, Category 分组查看。

### 4.5 属性反向视图 (参考 Page 16)
*   **入口**：在模板页面切换 Tab 或 View Mode。
*   **布局**：以“属性”为主键的列表。
*   **多重分配展示**：
    *   如果一个属性被分配给了多个分类节点，在列表右侧显示具体节点名称。
    *   **Tooltip交互**：如果节点过多（如 Page 16 截图），显示 `30-17.25.20.27 + 2 more`。鼠标 Hover 时弹出 Popover 显示完整列表。

---

## 5. 业务逻辑与后端接口 (API Requirements)

### 5.1 属性继承逻辑 (关键算法)
*   **规则**：当查询节点 `30-01-10` 的属性时，系统必须返回：
    *   `30` (Root) 的属性
    *   `30-01` (Parent) 的属性
    *   `30-01-10` (Self) 的属性
*   **API设计**：
    *   `GET /api/v1/templates/{id}/nodes/{node_id}/properties`
    *   **Response**: 包含一个 `is_inherited` 字段，用于前端区分渲染。

### 5.2 约束校验
*   **删除保护**：若分类体系已被某个设施模板引用，`DELETE /api/v1/classifications/{id}` 必须返回 409 Conflict。
*   **层级分配限制** (Page 17)：
    *   若属性 `Prop_A` 已分配给父节点 `Node_P`，则禁止再将 `Prop_A` 分配给 `Node_P` 的任何子节点（因为已自动继承，避免冗余）。

### 5.3 静态数据准备
*   **单位字典**：根据 Page 4-8 的表格，构建 `units.json` 常量文件。包含 `code` (e.g., "10.10"), `label` ("经度"), `unit` ("度")。


### 5.4 其他

*   **递归查询**：编写高效的 SQL 或逻辑处理分类树及其属性继承。
*   **API 接口示例**：
    *   `POST /api/v1/properties` (带验证逻辑)
    *   `POST /api/v1/classification/import` (处理文件上传)
    *   `GET /api/v1/template/{id}/node/{code}/properties` (获取节点属性，含继承)
    *   `POST /api/v1/template/copy`

---

## 6. 开发步骤规划 (Step-by-Step for Agent)

1.  **Phase 1: 基础设施与字典**
    *   创建 `units.json` 并在后端加载。
    *   实现 `sys_properties` 表的 CRUD API。
    *   前端开发 "Add Parameter" 弹窗，重点实现 Unit 级联选择器和 Tag Input。

2.  **Phase 2: 分类体系导入**
    *   实现 CSV 解析服务 (Backend)。
    *   前端实现文件上传组件及表格预览。
    *   开发树状结构查询 API (Recursive CTE or Path Enumeration).

3.  **Phase 3: 设施模板与分配 (核心)**
    *   搭建左右分栏 UI 框架。
    *   实现“节点点击”触发右侧数据加载的逻辑。
    *   开发“分配属性”接口：`POST /api/v1/templates/{id}/assign` (Payload: node_id, property_ids[])。
    *   **实现继承查询逻辑** (SQL/Service层)。

4.  **Phase 4: 高级交互与视图**
    *   实现“复制模板”功能 (Deep Copy of mappings)。
    *   实现“属性反向视图”及 `+ 2 more` 的 Tooltip 交互。
    *   完善 Badge 计数器逻辑 (Frontend 计算或 Backend 返回 count)。

5.  **Phase 5: 验证与测试**
    *   测试继承：给父节点加属性，确认子节点可见。
    *   测试冲突：尝试删除已引用的分类体系，确认报错。
    *   UI走查：确认深色模式下的对比度和间距符合截图。

## 7. 开发注意事项 (给编码Agent)
*   **数据一致性**：在处理属性继承时，确保删除父节点属性时能正确更新所有子节点的有效属性列表。
*   **性能优化**：分类树可能非常庞大（数百个节点），分配属性时需注意前端渲染性能。
*   **兼容性检查**：当前系统虽仅支持单设施，但 API 设计必须预留 `facility_id` 参数。

**Agent 执行提示**：请先从“国标单位表”的常量定义开始，随后建立属性库的 CRUD 逻辑。在处理分类树导入时，务必编写详细的格式校验 Unit Test。

---

## 8. 基于当前项目现状的深化补充

### 8.1 当前项目现状判断（基于仓库）
*   **前端栈**：当前为 `Vue 3 + Vite + Element Plus + Pinia + vue-i18n`，已有深色/浅色主题能力，适合直接承接本模块 UI。
*   **后端栈**：当前为 `Express + pg`，数据库为 PostgreSQL，路由同时存在 `/api` 与 `/api/v1` 两套路由风格。
*   **现有数据模型**：已落地的核心表是 `classifications`、`asset_specs`、`assets`、`spaces`，其中 `classifications` 仍是**扁平分类表**，不具备“分类体系 / 树节点 / 模板映射 / 属性继承”能力。
*   **ID现状**：现有核心表主键多数仍为 `SERIAL`，`asset_specs/assets/spaces` 仅带 `uuid` 辅助列，因此本模块应采用“**新增表全部 UUID 主键**，旧表先兼容”的增量策略，而不是第一阶段直接重构所有存量表主键。
*   **facility 现状**：仓库中仅有 `facilityId` 类型和过滤预留，没有真实 `facilities` 表、模板应用关系和权限边界，因此本模块第一阶段不应强依赖真实 facility 管理能力。
*   **测试现状**：仓库已有 Playwright E2E，但没有成熟的后端单测体系；本模块需要至少补齐“解析/继承/约束校验”的服务层自动化验证。
*   **页面入口现状**：当前仓库没有明确的“首页 / 设施页 / 管理页”三段式信息架构，因此本模块落地时需要同时补齐全局导航和页面路由。

### 8.2 实施边界与落地原则
*   **增量落地，不替换旧链路**：属性库、分类体系、设施模板作为新的“元数据子系统”新增，不直接覆盖现有 `classifications/assets/spaces` 导入流程。
*   **统一新接口入口**：本模块新增接口建议统一放到 `/api/v1` 下，避免继续扩大 `/api` 与 `/api/v1` 混用范围。
*   **作用域策略**：若挂到 Atomic/新接口体系，沿用当前 `X-Project-Id` 必填、`X-Facility-Id` 预留的规则；在 facility 真正落地前，模板域不要把 `facility_id` 作为强约束主键。
*   **版本优先于覆盖**：分类体系重传、模板更新都不应直接“原地覆盖已被引用的数据”，否则会破坏已保存的分配关系、资产映射和设施应用状态。
*   **下游先约束再开发**：本模块必须从一开始就考虑 `3.2.9 资产映射`、`3.2.12.3 属性面板即时编辑模板`、`3.2.17 IoT 设备分类参数` 三条后续链路。
*   **入口先行**：由于新增了 `Home / Facilities / Manage` 顶栏导航，前端实施时应先把页面入口和路由架起来，再挂接具体业务模块，避免管理模块做完后没有稳定入口。

## 9. 三大任务的深化拆解

### 9.1 属性库：从“字段定义”深化到“可映射、可复用、可锁定”

#### 9.1.1 需求修正与补充
*   **属性名称允许重名**：PDF 明确“属性名称允许重名”，因此现计划中的 `name unique` 设定不成立。系统必须额外引入唯一的 `property_key` / `code` 作为内部稳定标识。
*   **属性类别不应只是自由文本**：因需求要求“创建属性时可同时创建属性类别”，建议补充 `sys_property_categories` 表，而不是仅把 `category` 存成字符串。
*   **链接类型需区分内部/外部**：`Link` 类型至少支持两种目标：
    *   内部目标：链接到系统中的列表/库条目；
    *   外部目标：标准 URL。
*   **限制特定值仅适用于 Text / Integer / Number**：布尔、日期时间、链接、标签不应开放该配置。
*   **上下文语义必须与 PDF 对齐**：前端展示为“构件 / 规格”，后端枚举固定为 `Element` / `Specification`，不要再混入 `Instance / Type` 的额外命名。

#### 9.1.2 建议补充的数据结构
*   **Table**: `sys_property_categories`
    *   `id` (UUID, PK)
    *   `name` (String, unique)
    *   `sort_order` (Integer)
*   **Table**: `sys_property_value_options`
    *   `id` (UUID, PK)
    *   `property_id` (UUID, FK)
    *   `value` (String)
    *   `sort_order` (Integer)
*   **建议**：`constraints` JSON 可继续保留，但“限定值列表”优先落子表，便于排序、复用、差异比较和引用统计。

#### 9.1.3 后端任务细化
*   实现属性 CRUD 时加入**引用计数查询**：若属性已被任何模板节点直接分配，则禁止编辑和删除，返回 `409 Conflict`。
*   `POST/PUT` 校验规则需覆盖：
    *   `property_key` 唯一；
    *   `name` 可重复；
    *   `precision` 仅 `Number` 可设置；
    *   `unit_code` 仅 `Integer/Number` 可设置；
    *   `allowed_values` 仅 `Text/Integer/Number` 可设置；
    *   `Link` 类型必须声明 `target_mode=internal|external`。
*   提供“属性使用情况”查询接口，供 UI 在删除前展示“已被 N 个模板节点引用”。
*   单位字典不要只做前端常量，后端也需校验 `unit_code` 合法性，防止绕过前端提交非法值。

#### 9.1.4 前端任务细化
*   属性创建/编辑弹窗要实现**动态表单联动**：切换数据类型后清理无效字段，避免残留脏数据。
*   类别下拉框支持“选择已有 + 即时新增”，新增成功后自动回填当前表单。
*   “限制为特定值”使用 Tag Input 时，需即时去重、去空格、限制最大数量。
*   编辑态若属性已被引用，界面直接进入只读或仅允许修改“描述”类非结构字段，避免用户提交后才报错。

#### 9.1.5 验收标准
*   两个不同属性允许同名，但 `property_key` 不可重复。
*   数值型单位/精度、限定值、链接目标三类动态规则在前后端均能拦截非法组合。
*   已分配到模板节点的属性无法编辑结构性字段，无法删除。

### 9.2 分类体系：从“导入树”深化到“版本化、可校验、可搜索”

#### 9.2.1 核心缺口
*   当前计划覆盖了“导入 + 树显示”，但**没有处理重新上传后的版本影响**。根据 PDF，分类体系支持“编辑名称并重新上传分类编码表”，这会直接影响现有模板映射，必须补版本策略。
*   当前仓库已有 `classifications` 扁平表，且主要服务于模型提取后的资产/空间分类，并不等于“分类体系定义表”，两者不能混用。

#### 9.2.2 建议补充的数据结构
*   `sys_classification_schemas` 增加：
    *   `version_no` (Integer)
    *   `status` (Enum: Draft, Published, Archived)
    *   `source_file_name` (String)
    *   `source_file_path` / `source_file_blob_id` (String)
*   `sys_classification_nodes` 增加：
    *   `name` 或继续沿用 `description`
    *   `sort_order` (Integer)
    *   `source_row_no` (Integer) - 用于导入错误定位
    *   `is_leaf` (Boolean)
*   **建议**：保留 `path` 字段，并对 `schema_id + path`、`schema_id + code` 建索引，以支持子树查询和编码搜索。

#### 9.2.3 导入与校验任务细化
*   采用**两步式导入**：
    *   Step 1：上传并解析，返回预览和错误列表；
    *   Step 2：用户确认后才正式写库。
*   校验规则至少包括：
    *   必须存在 `Code / Description / Level` 三列；
    *   `Level` 为正整数，且不能跳级；
    *   任一非根节点的父级必须在前序行中存在；
    *   同一体系内编码不可重复；
    *   空行、尾部空格、全角空格、BOM 需自动清洗；
    *   同一文件混合多棵树时，根节点必须可被清晰识别。
*   导入错误需返回到“行级别”，包括 `row_no`、`column_name`、`message`，供前端高亮。

#### 9.2.4 版本与编辑策略
*   **不建议直接覆盖已发布体系**。推荐策略：
    *   未被模板引用：允许原地替换；
    *   已被模板引用：重新上传时创建新版本，由模板显式切换到新版本，旧版本保留只读。
*   分类体系重命名可直接更新；分类编码结构变更必须触发“影响分析”，列出受影响模板数量与节点映射丢失风险。

#### 9.2.5 前端任务细化
*   列表页除名称外，增加版本号、节点数、引用模板数、更新时间。
*   树视图支持编码搜索、描述搜索、仅显示命中路径展开。
*   导出 Excel 时保留原始三列格式，确保“导出后可回传导入”。

#### 9.2.6 验收标准
*   非法层级、缺失父级、重复编码、列名不匹配都能在上传预览阶段被拦截。
*   已被模板引用的体系不能删除；结构重传不会悄悄破坏线上模板。

### 9.3 设施模板：从“节点分配”深化到“发布、应用、反向视图、差异更新”

#### 9.3.1 核心补充点
*   PDF 中“设施模板更新后，设施页面要提示更新资产数据”，说明模板不能只是静态配置，还需要**版本号、发布状态、应用记录、待同步标记**。
*   当前计划已有“节点属性分配”和“复制模板”，但还缺：
    *   模板版本化；
    *   直接分配 vs 继承分配的清晰数据边界；
    *   模板应用到设施后的删除/更新约束；
    *   从设施页进入模板即时编辑后的回写流程。

#### 9.3.2 建议补充的数据结构
*   `sys_facility_templates` 增加：
    *   `description` (Text)
    *   `version_no` (Integer)
    *   `status` (Enum: Draft, Published, Archived)
    *   `source_template_id` (UUID, nullable) - 用于复制来源追踪
    *   `applied_count` (Integer, cache)
*   `rel_template_node_properties` 只保存**直接分配**关系，不保存继承结果。
*   待设施模块落地后，增加模板应用关系表，例如：
    *   `rel_facility_template_applications`
    *   字段至少包含 `facility_id`、`template_id`、`applied_version_no`、`applied_at`、`sync_status`

#### 9.3.3 后端任务细化
*   节点属性查询接口必须返回三类信息：
    *   `assigned_directly`
    *   `inherited_from_node_id`
    *   `effective_source_path`
*   继承规则计算建议放在 Service 层统一实现，避免前端自行拼装祖先节点。
*   “复制到”接口需具备冲突处理：
    *   已存在直接分配则跳过；
    *   目标节点若已从祖先继承同一属性，则禁止重复复制；
    *   返回成功/跳过/冲突统计。
*   “属性视角分配”接口需支持批量勾选节点，并一次性返回被上级继承命中的冲突项。
*   模板复制必须是**深拷贝映射关系**，但不复制应用关系。
*   若模板已应用到设施，删除接口返回 `409 Conflict`。

#### 9.3.4 前端任务细化
*   默认进入模板页时，右侧应按 PDF 展示“所有属性的分配状态”，而不是只显示当前节点的已分配项；节点点击后切换局部明细。
*   节点计数器定义要明确：
    *   分子 = 直接分配到本节点的属性数；
    *   分母 = 当前节点最终生效属性总数（含继承）。
*   右侧列表排序规则：
    *   当前节点直接分配属性置顶；
    *   继承属性次之；
    *   其余可分配属性按名称或类别排序。
*   反向属性视图中，若同一属性分配到多个节点，需要支持 `+N more` 汇总与完整 Tooltip/Popover 展开。
*   从设施页属性面板进入模板编辑时，只能显示与当前标签页上下文一致的属性：
    *   构件页只操作 `Element`
    *   规格页只操作 `Specification`

#### 9.3.5 模板更新与发布策略
*   建议将模板编辑分为 `Draft` 与 `Published`：
    *   编辑 Draft；
    *   发布后生成新的 `version_no`；
    *   设施下次打开时对比 `applied_version_no` 与模板最新版本，决定是否提示“更新资产数据”。
*   资产更新提示至少要区分：
    *   仅新增属性映射；
    *   删除属性；
    *   分类节点变更导致的映射失效。

#### 9.3.6 验收标准
*   父节点分配属性后，子节点能看到继承结果，但不能重复直接分配同一属性。
*   复制到目标节点时，不会产生冗余或冲突脏数据。
*   模板复制后形成独立对象；已应用模板不可删除。
*   模板更新后，设施侧能正确识别“待同步”状态。

## 10. 与下游模块的衔接要求

### 10.0 与全局页面结构的衔接
*   本模块不再假设用户通过侧边栏直接进入属性或模板管理，而是统一从标题栏的 `Manage` 进入。
*   登录后默认进入 `Home`，因此管理模块应提供从 `Home` 跳转 `Manage` 的明确入口。
*   `Facilities` 页与 `Manage` 页分工必须清晰：
    *   `Facilities`：设施对象的创建、列表、编辑、进入设施详情
    *   `Manage`：属性、分类体系、设施模板的后台配置
*   当用户在 `Home` 选择某个设施后，进入的是设施详情或设施工作页，而不是管理页。

### 10.1 与 3.2.9 资产设置（资产映射）的衔接
*   设施模板不是孤立功能，它将直接驱动“资产页面”的分类编码字段映射与属性映射。
*   资产设置页需要支持：
    *   从模型全部属性字段中选择**多个分类编码字段**；
    *   按属性类别分组展示模板属性；
    *   为模板属性分别映射模型中的构件属性或类型属性。
*   因此本模块接口必须提供：
    *   模板下“按类别分组”的属性清单；
    *   按 `context` 区分的属性清单；
    *   模板版本号，用于资产数据更新提示。

### 10.2 与 3.2.12.3 属性面板即时编辑模板的衔接
*   设施页面中，用户可在属性面板直接打开模板属性编辑界面，这意味着模板编辑器不能只存在于后台管理页。
*   需要预留“局部上下文编辑模式”：
    *   传入当前 `template_id`
    *   传入当前 `classification node`
    *   传入 `context=Element|Specification`
*   更新模板后，设施页需要可选择立即触发“应用模板到资产数据”。

### 10.3 与 3.2.17 IoT 设备分类参数的衔接
*   PDF 明确要求 IoT 设备分类复用“属性 + 分类体系 + 模板”能力。例如给“温度传感器”分类分配温度/湿度属性。
*   因此本模块不能把“设施模板”写死成只服务 BIM 构件；建议在领域命名和接口设计上保留“设备分类模板”的兼容空间。
*   IoT 首阶段可约束为只使用 `Element` 上下文属性，但底层元数据结构应完全复用。

## 11. 建议的实施顺序与里程碑

### 11.1 Milestone 0：页面入口与导航骨架
*   增加全局标题栏导航：`Home`、`Facilities`、`Manage`
*   调整登录后默认跳转到 `Home`
*   建立首页、设施页、管理页三个一级页面路由
*   约束管理模块统一挂到 `Manage` 页面下

### 11.2 Milestone 1：元数据基础层
*   新增属性类别、属性、属性值选项、单位字典。
*   完成属性 CRUD、引用保护、数据类型校验。
*   输出最小可用的“属性选择器 + 属性编辑弹窗”。

### 11.3 Milestone 2：分类体系导入与树服务
*   完成 CSV/XLSX 解析、预览校验、正式导入。
*   提供树查询、搜索、导出、版本管理接口。
*   建立“已引用禁止删除 / 结构变更需新版本”的约束。

### 11.4 Milestone 3：模板分配核心闭环
*   完成模板 CRUD、节点树 + 右侧分配面板、继承计算、复制到、属性反向视图。
*   打通模板版本发布和设施应用状态字段。

### 11.5 Milestone 4：下游联动
*   打通资产映射页对模板属性的读取。
*   支持从设施属性面板即时编辑模板。
*   增加模板更新提示与资产重建触发点。
*   验证 IoT 设备分类可复用同一元数据底座。

## 12. 补充测试矩阵
*   **属性校验**：重名属性、非法单位、非法精度、非法限定值类型、Link 目标类型缺失。
*   **分类导入**：缺列、编码重复、层级跳级、缺父级、空白行、BOM、XLSX/CSV 双格式。
*   **模板继承**：父分配、子继承、子重复分配冲突、复制到冲突、反向视图统计正确。
*   **版本约束**：已引用分类体系删除失败、已应用模板删除失败、模板发布后设施出现待同步提示。
*   **下游联动**：资产映射页按类别读取模板属性、属性面板按上下文过滤模板属性、IoT 分类可读取同一套模板属性。
*   **性能**：500+ 分类节点、1000+ 属性情况下，分类树展开、搜索、节点切换响应需可接受。

## 13. 基于 PDF 插图的二轮校正

### 13.1 属性创建/编辑界面校正（Page 8-9）
*   插图显示属性创建不是多页流程，而是**单弹窗内的动态表单**；因此属性类别、所属类型、数据类型、单位、精度、限定值应在同一弹窗中联动切换。
*   单位选择器在视觉上更接近“可搜索下拉 + 分组列表”，而不是级联树；实现时优先采用带搜索的 Select / Dialog Picker。
*   “限制为特定值”在插图中是**Tag/Pill 风格录入**，说明用户预期是快速录入多个候选值，不应做成表格编辑器。

### 13.2 分类体系导入界面校正（Page 10-11）
*   插图显示分类体系导入页包含**上传入口 + 表格格式示例/预览**，因此前端应采用“两步式导入”，先预览再确认，而不是直接上传入库。
*   分类体系详情页更接近“列表/书页式查看”，而不是仅有树视图；实现时建议保留“表格视图”和“树视图”双视角。

### 13.3 设施模板主界面校正（Page 11-15）
*   新建设施模板后的主界面是**完整页面级左右分栏**，不是小弹窗。左侧分类树、右侧属性面板是持续存在的工作区。
*   Page 12 明确展示了**空节点空态**：当左侧点到尚未分配属性的节点时，右侧是空白态 + 单个主按钮 `Assign Parameters`。这要求前端为空节点做专门空态，不应直接显示空表格。
*   Page 12-13 的属性分配器是**大尺寸 Modal**，且具备搜索、分组、排序、批量勾选，不是简单的下拉多选框。
*   Page 13 明确显示节点右侧状态计数是**同行 Badge**，且节点高亮与计数同时出现，因此节点组件需支持“名称 + 状态色 + 计数 + Hover 操作”的复合行布局。
*   Page 13-14 显示 `Copy to` 和 `Edit` 操作靠近节点/列表右上角出现，说明这是**就地操作**，不应隐藏到二级详情页。
*   Page 14-15 说明模板保存后再次打开时，右侧默认应展示**所有属性的分配状态**，即属性反向视图是默认工作模式之一，而不是附属页面。
*   Page 14 的多重分配提示是**Hover 显示分类编码清单**，实现上应优先使用 Popover，而不是点击跳转。
*   Page 15 的“点击右侧编辑按钮即时分配”说明属性反向视图中的每一行都需要有快速编辑入口，避免只能回到树节点逐个配置。

### 13.4 由插图反推的实现要求
*   模板页至少需要两种右侧视图模式：`节点视图` 与 `属性视图`。
*   分类树节点行需要支持长文本截断、Badge、Hover 操作和高亮背景，否则难以复现插图状态。
*   分配弹窗需要保留“分组 + 排序 + 搜索 + 已分配状态”四种信息密度，不能简化成纯搜索列表。

## 14. 分阶段实施计划文件
*   [PHASE_1_属性库与元数据基础.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PHASE_1_属性库与元数据基础.md)
*   [PHASE_2_分类体系导入与版本化.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PHASE_2_分类体系导入与版本化.md)
*   [PHASE_3_设施模板与属性分配.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PHASE_3_设施模板与属性分配.md)
*   [PHASE_4_资产联动与设施内即时编辑.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PHASE_4_资产联动与设施内即时编辑.md)
*   [PHASE_5_验证迁移与发布.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/PHASE_5_验证迁移与发布.md)

## 15. 当前仓库的推荐落点

### 15.1 后端
*   **路由层**：新增到 `server/routes/v1/`，建议拆分为：
    *   `properties.js`
    *   `classification-schemas.js`
    *   `facility-templates.js`
*   **数据访问层**：新增到 `server/models/`，保持与现有 `classification.js`、`asset.js` 一致的组织方式。
*   **服务层**：建议新增 `server/services/template-service.js`、`server/services/classification-schema-service.js`，承接继承计算、导入校验、版本切换等复杂逻辑。
*   **数据库初始化/迁移**：现仓库偏向 `server/db/schema.sql` + `server/scripts/migrate.js` 方式；本模块建议以“增量 SQL 文件 + 脚本调用”方式加入，不直接把复杂新表混入旧初始化脚本的单一大文件中。

### 15.2 前端
*   **页面级入口**：建议新增独立 View，例如 `src/views/MetadataManagementView.vue` 或拆成多个管理页。
*   **组件层**：建议新增到 `src/components/metadata/`：
    *   `PropertyEditorDialog.vue`
    *   `PropertySelector.vue`
    *   `ClassificationImportDialog.vue`
    *   `ClassificationTree.vue`
    *   `TemplateWorkbench.vue`
    *   `TemplatePropertyView.vue`
*   **API 调用层**：建议新增 `src/services/api/properties.ts`、`src/services/api/classificationSchemas.ts`、`src/services/api/facilityTemplates.ts`。
*   **类型定义**：建议新增 `src/types/property-template.ts` 或按领域拆分，避免把模板相关类型继续塞进已有 `facility.ts`。

### 15.3 测试
*   **前端 E2E**：延续当前 Playwright，新增针对模板工作台和导入流程的用例。
*   **后端服务测试**：若暂不引入完整测试框架，至少为解析器、继承算法、约束校验提供 Node 脚本级或最小测试执行器。

## 16. 跨阶段依赖关系
*   **Milestone 0 -> 全部后续阶段**：若没有统一的 `Home / Facilities / Manage` 导航和页面路由，后续属性库、分类体系、模板模块虽然能开发，但无法以正确的信息架构接入产品。
*   **Phase 1 -> Phase 3**：模板分配必须依赖属性库先稳定，否则无法做分配器、引用保护和上下文过滤。
*   **Phase 2 -> Phase 3**：模板必须绑定已发布的分类体系版本，因此分类体系版本化要先完成。
*   **Phase 3 -> Phase 4**：资产映射与设施内即时编辑均依赖模板版本、分组属性清单、节点有效属性查询接口。
*   **Phase 4 -> Phase 5**：只有在资产联动链路真实跑通后，验证、灰度、迁移方案才有意义。

## 17. 建议先确认的实现决策
*   **是否引入服务层**：若仍把复杂逻辑全部放到 route/model，会迅速失控；本模块建议强制引入 service 层。
*   **是否引入独立迁移目录**：若继续只维护一个大 `schema.sql`，后续版本化表和应用关系表会难以管理。
*   **模板管理入口位置**：建议作为独立“基础数据管理”入口，而不是散落到现有侧边栏多个面板里。

## 18. 本轮新增执行产物
*   [METADATA_MODULE_MIGRATION_DRAFT.sql](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/METADATA_MODULE_MIGRATION_DRAFT.sql)
*   [metadata-module.openapi.yaml](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/metadata-module.openapi.yaml)
*   [FRONTEND_PAGE_COMPONENT_MAP.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/FRONTEND_PAGE_COMPONENT_MAP.md)
*   [GLOBAL_NAV_AND_INFORMATION_ARCHITECTURE.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/GLOBAL_NAV_AND_INFORMATION_ARCHITECTURE.md)
*   [ROUTER_REFACTOR_DRAFT.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/ROUTER_REFACTOR_DRAFT.md)
*   [APP_SHELL_TOP_NAV_COMPONENT_SPEC.md](/Volumes/DATA/antigravity/TwinSight/todo/属性_分类体系_设施模板_20260101/APP_SHELL_TOP_NAV_COMPONENT_SPEC.md)
