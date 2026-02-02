"""
IEC 81346 Logic Engine
IEC 编码解析与拓扑分析服务

该服务提供：
- IEC 81346-12 编码解析
- 多维度方面树构建
- 上下游拓扑追溯
- Excel 数据导入
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import parse, topology, import_data

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
app.include_router(import_data.router, prefix="/api/import", tags=["导入"])


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "service": "logic-engine"}


@app.get("/")
async def root():
    """根路径 - 服务信息"""
    return {
        "service": "IEC 81346 Logic Engine",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "parse_code": "POST /api/parse/code",
            "parse_hierarchy": "POST /api/parse/hierarchy",
            "parse_excel": "POST /api/parse/excel",
            "trace_topology": "POST /api/topology/trace",
            "import_excel": "POST /api/import/excel/{file_id}",
            "clear_data": "DELETE /api/import/{file_id}",
            "get_stats": "GET /api/import/{file_id}/stats"
        }
    }
