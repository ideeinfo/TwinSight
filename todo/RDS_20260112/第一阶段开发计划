以下是为您编写的基于 **IEC 81346-12** 标准的第一阶段（MVP）详细开发部署计划。该计划采用 **Sidecar 混合微服务架构**（Node.js 主系统 + Python FastAPI 逻辑引擎），旨在构建一个既能兼容关系型数据库、又具备图数据库迁移能力的工程数据底座。

---

# IEC 81346-12 工程数据管理系统：第一阶段开发部署计划

## 0. 本地 Docker 开发环境部署 (Sidecar 模式)

通过 `docker-compose` 在本地模拟混合架构。Node.js 负责 Web 交互与 BIM Viewer，FastAPI 负责 IEC 编码的递归算法与拓扑分析。

### 目录结构
```text
/project-root
├── docker-compose.yml
├── /main-app           # Node.js 现有系统 (业务编排层)
└── /logic-engine       # Python FastAPI (逻辑算法层)
    ├── main.py         # 核心解析算法
    └── Dockerfile
```

### docker-compose.yml 配置
```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: iec_db
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

  logic-engine:
    build: ./logic-engine
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/iec_db
    ports:
      - "8000:8000"

  main-app:
    build: ./main-app
    environment:
      LOGIC_ENGINE_URL: http://logic-engine:8000
      DATABASE_URL: postgresql://postgres:password@db:5432/iec_db
    ports:
      - "3000:3000"
    depends_on:
      - db
      - logic-engine
```

---

## 1. 数据库表创建 (PostgreSQL 准图模型)

为了将来能平滑迁移到 **Neo4j** 等图数据库，采用“对象-方面-关系”物理模型。

```sql
-- 核心对象表 (图节点原型)
CREATE TABLE iec_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code VARCHAR(255) UNIQUE NOT NULL, -- 资产表中的资产编码/CSV设备编码
    bim_guid VARCHAR(255),                  -- 关联 BIM 模型的 GUID
    metadata JSONB,                         -- 存储 PLC 信号映射等扩展属性
    created_at TIMESTAMP DEFAULT NOW()
);

-- 多维度方面编码表 (RDS 81346 核心)
CREATE TABLE object_aspects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES iec_objects(id) ON DELETE CASCADE,
    aspect_type VARCHAR(20), -- 'function'(=), 'location'(++), 'power'(===)
    full_code VARCHAR(512) NOT NULL, -- 完整代号，如 =TA001.BJ01.GP02
    prefix VARCHAR(5) NOT NULL,
    parent_code VARCHAR(512),        -- 父级编码，用于递归构建树
    hierarchy_level INTEGER           -- 层级深度 (通常 5-10 层)
);

-- 拓扑关系表 (图边原型)
CREATE TABLE object_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_obj_id UUID REFERENCES iec_objects(id),
    target_obj_id UUID REFERENCES iec_objects(id),
    relation_type VARCHAR(50) -- 如 'FEEDS_POWER_TO'(供电), 'PART_OF'(构成)
);
```

---

## 2. 现有 CSV 文件数据导入逻辑

使用 Python 的 `pandas` 和正则引擎解析 `MC数据20230620_完整.csv`。

*   **资产映射**：直接将 CSV 的“设备编码”列存入 `iec_objects.asset_code`。
*   **层级拆解**：通过 Python 正则识别前缀符号（如 `===`, `=`, `++`），并根据“点分隔符”拆解代号。
    *   *示例*：编码 `=TA001.BJ01.GP02` 被解析为：
        *   层级 1：`=TA001` (Parent: null)
        *   层级 2：`=TA001.BJ01` (Parent: `=TA001`)
        *   层级 3：`=TA001.BJ01.GP02` (Parent: `=TA001.BJ01`)
*   **拓扑自动构建**：解析“电源功能”列（如 `===DY1.AH1...`），利用字符串包含关系自动生成 `object_relations` 中的供电链路。

---

## 3. 功能模块清单 (MVP)

### 3.1 左侧多维度方面树 (Aspect Trees)
*   **功能树 (Function, `=`)**：基于工艺流程（如排水系统 -> 泵组）导航。
*   **位置树 (Location, `++`)**：基于建筑空间（如 1号楼 -> 房间）导航。
*   **电源树 (Power, `===`)**：展示从变压器到配电柜、再到末端负载的电气拓扑。

### 3.2 树与 BIM 模型交互
*   **点击联动**：在前端点击树节点，Node.js 调用逻辑引擎获取关联的所有 `bim_guid`，Viewer API 执行高亮和视觉定位。
*   **反向查寻**：在模型中选中构件（获取 GUID），系统反查该构件在不同维度（功能、位置、电源）中的所有代号。

### 3.3 上下游节点逻辑追溯
*   **上游追溯 (Upstream)**：选中设备（如水泵），一键高亮整个供电路径（直到变压器）。
*   **下游影响分析 (Downstream)**：选中配电柜，分析若停电受影响的所有终端设备。
*   **技术实现**：利用 PostgreSQL 的 **Recursive CTE** (递归查询) 模拟图遍历。

---

## 4. Railway 部署步骤

Railway 已支持多服务（Multiple Services）部署在同一项目中。

1.  **代码准备**：将 Node.js 系统和 Python FastAPI 放在同一 Repo 的不同文件夹。
2.  **创建服务**：
    *   在 Railway 中创建一个新的 **Python Service** 部署 `logic-engine`。
    *   现有的 **Node.js Service** 保持不变。
3.  **配置私有网络 (Private Networking)**：
    *   为 Python 服务设置环境变量 `PORT=8000`。
    *   Node.js 侧通过 `http://logic-engine.railway.internal:8000` 内部访问逻辑引擎，无需公网流量。
4.  **共享数据库**：
    *   将两个服务的 `DATABASE_URL` 均指向 Railway 中的同一个 PostgreSQL 实例。

---

**总结与类比：**
第一阶段的架构就像是为一座图书馆（建筑工程）建立了一个**“三维智能索引”**。Node.js 负责管理**图书阅览室的界面和 3D 地图**；Python Sidecar 则是后台的**专业目录分析师**，它把原本杂乱的 CSV 书单，通过一套代号规则（IEC 81346）转化为互相连接的索引网。无论你想按“题材”（功能）、“架位”（位置）还是“供货来源”（电源）找书，系统都能在 3D 地图上瞬间指明位置。