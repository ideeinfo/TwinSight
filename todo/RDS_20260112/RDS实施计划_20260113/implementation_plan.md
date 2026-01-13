# IEC 81346-12 工程数据管理系统 - 第一阶段详细实施计划

## 1. 目标与背景

基于 IEC 81346-12 标准在现有 TwinSight 系统上构建**多维度方面编码（RDS）管理系统**，实现：
- 三种维度（功能 `=`、位置 `++`、电源 `===`）的层级树导航
- 树节点与 BIM 模型的双向联动
- 上下游拓扑追溯（供电链路分析）

采用 **Sidecar 混合微服务架构**：
- Node.js 主系统处理 Web 交互与 BIM Viewer
- Python FastAPI 逻辑引擎处理 IEC 编码的递归算法与拓扑分析

---

## 2. 用户审查事项

> [!NOTE]
> **数据关联方式**
> - **设备对象**（有工艺功能或电源编码）：Excel「设备编码」→ `assets.asset_code` → 模型「MC编码」属性
> - **空间对象**（仅有位置编码 `++`）：Excel「设备编码」→ `spaces.space_code` → 模型房间「编号」属性
> - 通过不同字段建立 RDS 编码与 BIM 模型构件的关联
> - **支持格式**：仅支持 Excel 文件（.xlsx, .xls），支持读取所有 Sheet

> [!IMPORTANT]
> **表名规范**
> - 所有 RDS 模块新建表使用 `rds_` 前缀，与主系统表区分
> - 表名：`rds_objects`、`rds_aspects`、`rds_relations`

---

## 3. 变更计划

### 阶段一：基础设施搭建

---

#### [NEW] logic-engine 服务目录

创建 Python FastAPI 服务，负责 IEC 编码解析与拓扑分析。

```text
/logic-engine
├── main.py                 # FastAPI 应用入口
├── routers/
│   ├── __init__.py
│   ├── parse.py            # 编码解析 API
│   └── topology.py         # 拓扑追溯 API
├── services/
│   ├── __init__.py
│   ├── iec_parser.py       # IEC 编码解析器
│   └── excel_importer.py   # Excel 数据导入（支持多 Sheet）
├── models/
│   ├── __init__.py
│   └── schemas.py          # Pydantic 模型
├── requirements.txt        # Python 依赖
└── Dockerfile              # 容器构建
```

---

#### [NEW] [logic-engine/Dockerfile](file:///d:/TwinSIght/antigravity/twinsight/logic-engine/Dockerfile)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

#### [NEW] [logic-engine/requirements.txt](file:///d:/TwinSIght/antigravity/twinsight/logic-engine/requirements.txt)

```text
fastapi==0.109.0
uvicorn==0.25.0
pandas==2.1.4
openpyxl==3.1.2          # Excel 文件读取支持
psycopg2-binary==2.9.9
sqlalchemy==2.0.25
pydantic==2.5.3
python-multipart==0.0.6
```

---

#### [NEW] [logic-engine/main.py](file:///d:/TwinSIght/antigravity/twinsight/logic-engine/main.py)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import parse, topology

app = FastAPI(
    title="IEC 81346 Logic Engine",
    description="IEC 编码解析与拓扑分析服务",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(parse.router, prefix="/api/parse", tags=["解析"])
app.include_router(topology.router, prefix="/api/topology", tags=["拓扑"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "logic-engine"}
```

---

#### [MODIFY] [docker-compose.yml](file:///d:/TwinSIght/antigravity/twinsight/docker-compose.yml)

在现有配置中添加 `logic-engine` 服务：

```yaml
  logic-engine:
    build: ./logic-engine
    container_name: twinsight-logic-engine
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/twinsight
    ports:
      - "8000:8000"
    depends_on:
      - postgres
    networks:
      - twinsight-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

同时在 `api` 服务中添加环境变量：

```yaml
  api:
    environment:
      # ... 现有配置
      LOGIC_ENGINE_URL: http://logic-engine:8000
```

---

#### [NEW] [server/db/migrations/iec_81346_tables.sql](file:///d:/TwinSIght/antigravity/twinsight/server/db/migrations/iec_81346_tables.sql)

创建 IEC 81346-12 相关数据库表：

```sql
-- ========================================
-- IEC 81346-12 工程数据管理系统表结构
-- ========================================

-- 1. 核心对象表 (图节点原型)
CREATE TABLE IF NOT EXISTS rds_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    object_type VARCHAR(20) NOT NULL DEFAULT 'asset', -- 'asset' 或 'space'
    ref_code VARCHAR(255) NOT NULL,           -- 设备:asset_code, 空间:space_code
    bim_guid VARCHAR(255),                    -- 关联 BIM 模型的 GUID
    name VARCHAR(500),                        -- 对象名称
    metadata JSONB,                           -- 存储 PLC 信号映射等扩展属性
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(file_id, object_type, ref_code)
);

-- 2. 多维度方面编码表 (RDS 81346 核心)
CREATE TABLE IF NOT EXISTS rds_aspects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES rds_objects(id) ON DELETE CASCADE,
    aspect_type VARCHAR(20) NOT NULL,         -- 'function'(=), 'location'(++), 'power'(===)
    full_code VARCHAR(512) NOT NULL,          -- 完整代号，如 =TA001.BJ01.GP02
    prefix VARCHAR(5) NOT NULL,               -- 前缀符号 (=, ++, ===)
    parent_code VARCHAR(512),                 -- 父级编码，用于递归构建树
    hierarchy_level INTEGER NOT NULL,         -- 层级深度 (通常 5-10 层)
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(object_id, aspect_type, full_code)
);

-- 3. 拓扑关系表 (图边原型)
CREATE TABLE IF NOT EXISTS rds_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_obj_id UUID REFERENCES rds_objects(id) ON DELETE CASCADE,
    target_obj_id UUID REFERENCES rds_objects(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,       -- 如 'FEEDS_POWER_TO'(供电), 'PART_OF'(构成)
    metadata JSONB,                           -- 关系附加属性
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_obj_id, target_obj_id, relation_type)
);

-- ========================================
-- 创建索引
-- ========================================
CREATE INDEX IF NOT EXISTS idx_rds_objects_file_id ON rds_objects(file_id);
CREATE INDEX IF NOT EXISTS idx_rds_objects_ref_code ON rds_objects(ref_code);
CREATE INDEX IF NOT EXISTS idx_rds_objects_object_type ON rds_objects(object_type);
CREATE INDEX IF NOT EXISTS idx_rds_objects_bim_guid ON rds_objects(bim_guid);

CREATE INDEX IF NOT EXISTS idx_rds_aspects_object_id ON rds_aspects(object_id);
CREATE INDEX IF NOT EXISTS idx_rds_aspects_type ON rds_aspects(aspect_type);
CREATE INDEX IF NOT EXISTS idx_rds_aspects_full_code ON rds_aspects(full_code);
CREATE INDEX IF NOT EXISTS idx_rds_aspects_parent_code ON rds_aspects(parent_code);
CREATE INDEX IF NOT EXISTS idx_rds_aspects_level ON rds_aspects(hierarchy_level);

CREATE INDEX IF NOT EXISTS idx_rds_relations_source ON rds_relations(source_obj_id);
CREATE INDEX IF NOT EXISTS idx_rds_relations_target ON rds_relations(target_obj_id);
CREATE INDEX IF NOT EXISTS idx_rds_relations_type ON rds_relations(relation_type);

-- ========================================
-- 触发器：自动更新 updated_at
-- ========================================
DROP TRIGGER IF EXISTS update_rds_objects_updated_at ON rds_objects;
CREATE TRIGGER update_rds_objects_updated_at
    BEFORE UPDATE ON rds_objects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

### 阶段二：Python 逻辑引擎开发

---

#### [NEW] [logic-engine/services/iec_parser.py](file:///d:/TwinSIght/antigravity/twinsight/logic-engine/services/iec_parser.py)

IEC 编码解析器核心算法：

```python
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

@dataclass
class AspectCode:
    """方面编码解析结果"""
    full_code: str          # 完整代号
    prefix: str             # 前缀符号
    aspect_type: str        # 方面类型
    hierarchy_level: int    # 层级深度
    parent_code: Optional[str]  # 父级编码
    segments: List[str]     # 层级段落

class IECParser:
    """IEC 81346-12 编码解析器"""
    
    # 前缀映射
    PREFIX_MAP = {
        '===': 'power',      # 电源功能
        '++': 'location',    # 位置
        '=': 'function',     # 工艺功能
    }
    
    # 前缀正则（按长度降序匹配）
    PREFIX_PATTERN = re.compile(r'^(===|\+\+|=)')
    
    def parse_code(self, code: str) -> Optional[AspectCode]:
        """解析单个 IEC 编码"""
        if not code or not code.strip():
            return None
        
        code = code.strip()
        
        # 提取前缀
        match = self.PREFIX_PATTERN.match(code)
        if not match:
            return None
        
        prefix = match.group(1)
        aspect_type = self.PREFIX_MAP.get(prefix)
        
        # 移除前缀，解析层级
        code_body = code[len(prefix):]
        segments = code_body.split('.')
        
        # 构建层级
        hierarchy_level = len(segments)
        parent_code = None
        if hierarchy_level > 1:
            parent_segments = segments[:-1]
            parent_code = prefix + '.'.join(parent_segments)
        
        return AspectCode(
            full_code=code,
            prefix=prefix,
            aspect_type=aspect_type,
            hierarchy_level=hierarchy_level,
            parent_code=parent_code,
            segments=segments
        )
    
    def expand_hierarchy(self, code: str) -> List[AspectCode]:
        """展开编码的完整层级链"""
        parsed = self.parse_code(code)
        if not parsed:
            return []
        
        results = []
        current_segments = []
        
        for i, segment in enumerate(parsed.segments, 1):
            current_segments.append(segment)
            full_code = parsed.prefix + '.'.join(current_segments)
            parent_code = None
            if i > 1:
                parent_code = parsed.prefix + '.'.join(current_segments[:-1])
            
            results.append(AspectCode(
                full_code=full_code,
                prefix=parsed.prefix,
                aspect_type=parsed.aspect_type,
                hierarchy_level=i,
                parent_code=parent_code,
                segments=current_segments.copy()
            ))
        
        return results
```

---

#### [NEW] [logic-engine/routers/parse.py](file:///d:/TwinSIght/antigravity/twinsight/logic-engine/routers/parse.py)

编码解析 API 路由：

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import io

from services.iec_parser import IECParser

router = APIRouter()
parser = IECParser()

class ParseRequest(BaseModel):
    code: str

class ParseResponse(BaseModel):
    full_code: str
    prefix: str
    aspect_type: str
    hierarchy_level: int
    parent_code: Optional[str]
    segments: List[str]

@router.post("/code", response_model=ParseResponse)
async def parse_single_code(request: ParseRequest):
    """解析单个 IEC 编码"""
    result = parser.parse_code(request.code)
    if not result:
        raise HTTPException(status_code=400, detail="无法解析编码")
    return result

@router.post("/hierarchy", response_model=List[ParseResponse])
async def expand_hierarchy(request: ParseRequest):
    """展开编码的完整层级链"""
    results = parser.expand_hierarchy(request.code)
    if not results:
        raise HTTPException(status_code=400, detail="无法解析编码")
    return results

@router.post("/excel")
async def import_excel(file: UploadFile = File(...)):
    """导入 Excel 文件并解析所有编码"""
    valid_extensions = ('.xlsx', '.xls')
    if not file.filename.lower().endswith(valid_extensions):
        raise HTTPException(status_code=400, detail="仅支持 Excel 文件 (.xlsx, .xls)")
    
    content = await file.read()
    # sheet_name=None 读取所有工作表，返回字典 {sheet_name: df}
    dfs = pd.read_excel(io.BytesIO(content), sheet_name=None)
    
    results = {
        'total_rows': 0,
        'parsed_objects': [],
        'errors': []
    }
    
    for sheet_name, df in dfs.items():
        results['total_rows'] += len(df)
        
        for idx, row in df.iterrows():
            obj = {
                'sheet': sheet_name,
                'row_index': idx,
                'name': row.get('名称', ''),
                'asset_code': row.get('设备编码', ''),
                'aspects': []
            }
            
            # 解析三种方面编码
            for col, aspect_type in [('工艺功能', 'function'), 
                                      ('位置', 'location'), 
                                      ('电源功能', 'power')]:
                code = row.get(col, '')
                if pd.notna(code) and str(code).strip():
                    hierarchy = parser.expand_hierarchy(str(code))
                    obj['aspects'].extend([{
                        'full_code': h.full_code,
                        'prefix': h.prefix,
                        'aspect_type': h.aspect_type,
                        'hierarchy_level': h.hierarchy_level,
                        'parent_code': h.parent_code
                    } for h in hierarchy])
            
            results['parsed_objects'].append(obj)
    
    return results

```

---

#### [NEW] [logic-engine/routers/topology.py](file:///d:/TwinSIght/antigravity/twinsight/logic-engine/routers/topology.py)

拓扑追溯 API 路由：

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

router = APIRouter()

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/twinsight')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class TraceRequest(BaseModel):
    object_id: str
    direction: str = 'upstream'  # 'upstream' 或 'downstream'
    relation_type: str = 'FEEDS_POWER_TO'

class TraceNode(BaseModel):
    id: str
    ref_code: str
    name: str
    level: int

@router.post("/trace", response_model=List[TraceNode])
async def trace_topology(request: TraceRequest):
    """递归追溯上下游关系"""
    
    with SessionLocal() as session:
        if request.direction == 'upstream':
            query = text("""
                WITH RECURSIVE upstream AS (
                    SELECT o.id, o.ref_code, o.name, 0 as level
                    FROM rds_objects o WHERE o.id = :object_id
                    UNION ALL
                    SELECT o.id, o.ref_code, o.name, u.level + 1
                    FROM rds_objects o
                    JOIN rds_relations r ON r.source_obj_id = o.id
                    JOIN upstream u ON r.target_obj_id = u.id
                    WHERE r.relation_type = :relation_type AND u.level < 20
                )
                SELECT * FROM upstream ORDER BY level DESC
            """)
        else:
            query = text("""
                WITH RECURSIVE downstream AS (
                    SELECT o.id, o.ref_code, o.name, 0 as level
                    FROM rds_objects o WHERE o.id = :object_id
                    UNION ALL
                    SELECT o.id, o.ref_code, o.name, d.level + 1
                    FROM rds_objects o
                    JOIN rds_relations r ON r.target_obj_id = o.id
                    JOIN downstream d ON r.source_obj_id = d.id
                    WHERE r.relation_type = :relation_type AND d.level < 20
                )
                SELECT * FROM downstream ORDER BY level
            """)
        
        result = session.execute(query, {
            'object_id': request.object_id,
            'relation_type': request.relation_type
        })
        
        return [TraceNode(
            id=str(row.id), ref_code=row.ref_code,
            name=row.name or '', level=row.level
        ) for row in result]
```

---

### 阶段三：Node.js 后端集成

---

#### [NEW] [server/routes/rds.js](file:///d:/TwinSIght/antigravity/twinsight/server/routes/rds.js)

RDS 相关 API 路由：

```javascript
const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db');

const LOGIC_ENGINE_URL = process.env.LOGIC_ENGINE_URL || 'http://localhost:8000';

// 获取方面树数据
router.get('/tree/:aspectType', async (req, res) => {
  try {
    const { aspectType } = req.params;
    const { fileId, parentCode } = req.query;
    
    const query = parentCode
      ? `SELECT oa.full_code, oa.hierarchy_level, oa.parent_code, io.name, io.bim_guid,
                   (SELECT COUNT(*) FROM rds_aspects WHERE parent_code = oa.full_code) as child_count
         FROM rds_aspects oa JOIN rds_objects io ON oa.object_id = io.id
         WHERE oa.aspect_type = $1 AND oa.parent_code = $2
           AND ($3::INTEGER IS NULL OR io.file_id = $3) ORDER BY oa.full_code`
      : `SELECT oa.full_code, oa.hierarchy_level, oa.parent_code, io.name, io.bim_guid,
                   (SELECT COUNT(*) FROM rds_aspects WHERE parent_code = oa.full_code) as child_count
         FROM rds_aspects oa JOIN rds_objects io ON oa.object_id = io.id
         WHERE oa.aspect_type = $1 AND oa.hierarchy_level = 1
           AND ($2::INTEGER IS NULL OR io.file_id = $2) ORDER BY oa.full_code`;
    
    const params = parentCode ? [aspectType, parentCode, fileId] : [aspectType, fileId];
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows.map(row => ({
      code: row.full_code, name: row.name, level: row.hierarchy_level,
      parentCode: row.parent_code, bimGuid: row.bim_guid, hasChildren: row.child_count > 0
    })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 反向查询
router.get('/lookup/:bimGuid', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT io.id, io.asset_code, io.name, oa.full_code, oa.aspect_type, oa.hierarchy_level
      FROM rds_objects io JOIN rds_aspects oa ON oa.object_id = io.id
      WHERE io.bim_guid = $1 ORDER BY oa.aspect_type, oa.hierarchy_level
    `, [req.params.bimGuid]);
    
    const grouped = result.rows.reduce((acc, row) => {
      if (!acc[row.aspect_type]) acc[row.aspect_type] = [];
      acc[row.aspect_type].push({ code: row.full_code, level: row.hierarchy_level });
      return acc;
    }, {});
    
    res.json({ success: true, data: {
      objectId: result.rows[0]?.id, assetCode: result.rows[0]?.asset_code,
      name: result.rows[0]?.name, aspects: grouped
    }});
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 上下游追溯
router.post('/trace', async (req, res) => {
  try {
    const response = await axios.post(`${LOGIC_ENGINE_URL}/api/topology/trace`, req.body);
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

---

### 阶段四：前端组件开发

---

#### [NEW] [src/components/panels/AspectTreePanel.vue](file:///d:/TwinSIght/antigravity/twinsight/src/components/panels/AspectTreePanel.vue)

多维度方面树面板组件（完整代码见详细设计文档）。

---

#### [NEW] [src/api/rds.js](file:///d:/TwinSIght/antigravity/twinsight/src/api/rds.js)

RDS API 封装模块。

---

### 阶段五：Railway 部署配置

在 Railway 项目中添加 **Python Service**：

1. **创建服务**："New" → "GitHub Repo" → `/logic-engine`
2. **Start Command**：`uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **环境变量**：`DATABASE_URL=${{Postgres.DATABASE_URL}}`
4. **私有网络**：`LOGIC_ENGINE_URL=http://logic-engine.railway.internal:8000`

---

## 4. 验证计划

### 自动化测试

```bash
# Python 逻辑引擎测试
cd logic-engine
pip install pytest pytest-asyncio httpx
pytest tests/ -v

# Node.js API 测试
cd server
npm test -- --grep "RDS"
```

### 手动验证

```bash
# 启动完整服务栈
docker-compose up -d

# 验证 logic-engine 健康检查
curl http://localhost:8000/health

# 验证编码解析 API
curl -X POST http://localhost:8000/api/parse/code \
  -H "Content-Type: application/json" \
  -d '{"code": "=TA001.BJ01.GP02"}'
```

#### 功能验证清单

- [ ] **Excel 导入**：上传 `RDS数据_完整.xlsx`，验证数据入库
- [ ] **方面树展示**：验证三种维度树结构正确
- [ ] **树与模型联动**：点击节点→模型高亮→视图定位
- [ ] **反向查询**：选中 BIM 构件→展示所有方面编码
- [ ] **电源追溯**：选中设备→上游追溯→整个供电路径高亮

---

## 5. 时间估算

| 阶段 | 任务 | 预估工时 |
|------|------|----------|
| 1 | 基础设施搭建 | 4 小时 |
| 2 | Python 逻辑引擎开发 | 8 小时 |
| 3 | Node.js 后端集成 | 4 小时 |
| 4 | 前端组件开发 | 8 小时 |
| 5 | 部署与测试 | 4 小时 |
| **总计** | | **28 小时** |
