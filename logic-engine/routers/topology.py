"""
拓扑追溯 API 路由

提供设备拓扑关系追溯接口：
- 上游追溯（如：追溯供电路径直到变压器）
- 下游追溯（如：分析停电影响范围）
"""

import os
from fastapi import APIRouter, HTTPException
from typing import List
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from models.schemas import TraceRequest, TraceNode, TraceResponse

router = APIRouter()

# 数据库连接
DATABASE_URL = os.getenv(
    'DATABASE_URL', 
    'postgresql://postgres:password@localhost:5432/twinsight'
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@router.post("/trace", response_model=TraceResponse)
async def trace_topology(request: TraceRequest):
    """
    递归追溯上下游关系
    
    使用 PostgreSQL Recursive CTE 实现图遍历，支持：
    - upstream: 向上游追溯（如：设备 -> 配电柜 -> 变压器）
    - downstream: 向下游追溯（如：变压器 -> 配电柜 -> 所有终端设备）
    
    Args:
        request: 追溯请求，包含起始对象ID、方向和关系类型
        
    Returns:
        追溯路径上的所有节点
    """
    
    try:
        with SessionLocal() as session:
            if request.direction == 'upstream':
                # 上游追溯：从目标向电源方向追溯
                query = text("""
                    WITH RECURSIVE upstream AS (
                        -- 起始节点
                        SELECT o.id, o.ref_code, o.name, 0 as level
                        FROM rds_objects o WHERE o.id::text = :object_id
                        
                        UNION ALL
                        
                        -- 递归向上游查找
                        SELECT o.id, o.ref_code, o.name, u.level + 1
                        FROM rds_objects o
                        JOIN rds_relations r ON r.source_obj_id = o.id
                        JOIN upstream u ON r.target_obj_id = u.id
                        WHERE r.relation_type = :relation_type 
                          AND u.level < 20  -- 防止无限递归
                    )
                    SELECT DISTINCT id, ref_code, name, level 
                    FROM upstream 
                    ORDER BY level DESC
                """)
            else:
                # 下游追溯：从电源向终端方向追溯
                query = text("""
                    WITH RECURSIVE downstream AS (
                        -- 起始节点
                        SELECT o.id, o.ref_code, o.name, 0 as level
                        FROM rds_objects o WHERE o.id::text = :object_id
                        
                        UNION ALL
                        
                        -- 递归向下游查找
                        SELECT o.id, o.ref_code, o.name, d.level + 1
                        FROM rds_objects o
                        JOIN rds_relations r ON r.target_obj_id = o.id
                        JOIN downstream d ON r.source_obj_id = d.id
                        WHERE r.relation_type = :relation_type 
                          AND d.level < 20  -- 防止无限递归
                    )
                    SELECT DISTINCT id, ref_code, name, level 
                    FROM downstream 
                    ORDER BY level
                """)
            
            result = session.execute(query, {
                'object_id': request.object_id,
                'relation_type': request.relation_type
            })
            
            nodes = [
                TraceNode(
                    id=str(row.id), 
                    ref_code=row.ref_code or '',
                    name=row.name or '', 
                    level=row.level
                ) 
                for row in result
            ]
            
            return TraceResponse(nodes=nodes, total=len(nodes))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"追溯查询失败: {str(e)}")


@router.get("/relation-types")
async def get_relation_types():
    """
    获取所有关系类型
    
    返回系统中定义的所有拓扑关系类型及其描述
    """
    return {
        "relation_types": [
            {
                "type": "FEEDS_POWER_TO",
                "label": "供电",
                "description": "电源供应关系，如：变压器 -> 配电柜 -> 设备"
            },
            {
                "type": "PART_OF",
                "label": "构成",
                "description": "组成关系，如：零件属于设备"
            },
            {
                "type": "LOCATED_IN",
                "label": "位于",
                "description": "空间位置关系，如：设备位于某房间"
            },
            {
                "type": "CONTROLS",
                "label": "控制",
                "description": "控制关系，如：PLC 控制某设备"
            }
        ]
    }


@router.post("/path")
async def find_path(source_id: str, target_id: str, relation_type: str = "FEEDS_POWER_TO"):
    """
    查找两个对象之间的路径
    
    Args:
        source_id: 起始对象 ID
        target_id: 目标对象 ID
        relation_type: 关系类型
        
    Returns:
        两点之间的路径（如果存在）
    """
    try:
        with SessionLocal() as session:
            query = text("""
                WITH RECURSIVE path_finder AS (
                    SELECT 
                        o.id, 
                        o.ref_code, 
                        o.name, 
                        0 as level,
                        ARRAY[o.id] as path
                    FROM rds_objects o 
                    WHERE o.id::text = :source_id
                    
                    UNION ALL
                    
                    SELECT 
                        o.id, 
                        o.ref_code, 
                        o.name, 
                        pf.level + 1,
                        pf.path || o.id
                    FROM rds_objects o
                    JOIN rds_relations r ON r.target_obj_id = o.id
                    JOIN path_finder pf ON r.source_obj_id = pf.id
                    WHERE r.relation_type = :relation_type 
                      AND o.id != ALL(pf.path)  -- 防止循环
                      AND pf.level < 20
                )
                SELECT id, ref_code, name, level, path
                FROM path_finder 
                WHERE id::text = :target_id
                ORDER BY level
                LIMIT 1
            """)
            
            result = session.execute(query, {
                'source_id': source_id,
                'target_id': target_id,
                'relation_type': relation_type
            }).fetchone()
            
            if result:
                # 获取路径上所有节点的详细信息
                path_ids = result.path
                nodes_query = text("""
                    SELECT id, ref_code, name 
                    FROM rds_objects 
                    WHERE id = ANY(:path_ids)
                """)
                path_nodes = session.execute(nodes_query, {'path_ids': path_ids}).fetchall()
                
                # 按路径顺序排列
                nodes_dict = {str(n.id): n for n in path_nodes}
                ordered_nodes = []
                for pid in path_ids:
                    node = nodes_dict.get(str(pid))
                    if node:
                        ordered_nodes.append({
                            "id": str(node.id),
                            "ref_code": node.ref_code or '',
                            "name": node.name or ''
                        })
                
                return {
                    "found": True,
                    "path_length": result.level,
                    "path": ordered_nodes
                }
            else:
                return {
                    "found": False,
                    "message": "未找到连接路径"
                }
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"路径查询失败: {str(e)}")
