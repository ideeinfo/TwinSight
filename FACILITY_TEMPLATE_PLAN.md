这是一份针对**模块2：属性、分类体系和设施模板**的详细开发计划。该计划基于PDF文档的文字描述及截图中的UI细节进行了深度解析，专为编码Agent设计，强调数据结构、业务逻辑与UI实现的精确对应。

---

# 模块开发任务书：属性、分类体系与设施模板

## 1. 总体概述
本模块旨在构建系统的核心元数据层。虽然目前系统仅支持单设施，但架构必须预留“设施层”扩展能力。核心逻辑是通过“设施模板”将“标准属性库”映射到“分类体系”的树状节点上，并实现属性的继承机制。构建一套可扩展的元数据管理系统。支持定义统一的属性库、树状分类体系，并通过“设施模板”将两者绑定。设计必须兼容未来的“多设施层（Facility Layer）”扩展需求。

**全局约束：**
*   **UI风格**：深色模式（Dark Mode），主色调为蓝色（参考截图中的按钮颜色），弹窗背景为深灰。
*   **数据ID**：所有数据库表主键强制使用UUID。
*   **国际化**：所有静态文本需抽离至多语言配置文件。

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
    *   `name` (String, unique)
    *   `category` (String, 可新建/下拉选择)
    *   `context` (Enum: 'Element/Instance', 'Type/Specification') - 对应文档中的“所属类型”
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