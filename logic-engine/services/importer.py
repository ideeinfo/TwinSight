"""
Excel 数据导入服务

将解析后的 IEC 81346-12 编码数据导入到 PostgreSQL 数据库：
- rds_objects: 核心对象（设备/资产）
- rds_aspects: 多维度方面编码
- rds_relations: 供电链路关系
"""

import os
from typing import List, Dict, Optional, Tuple
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dataclasses import dataclass
import re


# 数据库连接
DATABASE_URL = os.getenv(
    'DATABASE_URL', 
    'postgresql://postgres:password@localhost:5432/twinsight'
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@dataclass
class ImportResult:
    """导入结果"""
    success: bool
    objects_created: int
    aspects_created: int
    relations_created: int
    errors: List[str]


def import_excel_data(
    file_id: int,
    parsed_objects: List[Dict],
    create_power_relations: bool = True
) -> ImportResult:
    """
    将解析后的 Excel 数据导入数据库
    
    Args:
        file_id: 关联的模型文件 ID
        parsed_objects: 由 parse.py 解析后的对象列表
        create_power_relations: 是否自动创建供电链路关系
        
    Returns:
        导入结果统计
    """
    result = ImportResult(
        success=True,
        objects_created=0,
        aspects_created=0,
        relations_created=0,
        errors=[]
    )
    
    try:
        with SessionLocal() as session:
            # 用于追踪电源编码和对象的映射（用于建立供电关系）
            power_code_to_object: Dict[str, int] = {}
            
            for obj_data in parsed_objects:
                # 使用 savepoint 让单个对象失败不影响其他对象
                savepoint = session.begin_nested()
                try:
                    # 1. 创建 rds_objects 记录
                    object_id = _create_object(
                        session, 
                        file_id, 
                        obj_data
                    )
                    result.objects_created += 1
                    
                    # 2. 创建 rds_aspects 记录
                    for aspect in obj_data.get('aspects', []):
                        _create_aspect(session, object_id, aspect)
                        result.aspects_created += 1
                        
                        # 记录电源编码映射
                        if aspect.get('aspect_type') == 'power':
                            power_code_to_object[aspect['full_code']] = object_id
                    
                    savepoint.commit()
                    
                except Exception as e:
                    savepoint.rollback()
                    result.errors.append(
                        f"对象 '{obj_data.get('name', 'unknown')}': {str(e)}"
                    )
            
            # 3. 创建供电链路关系
            if create_power_relations and power_code_to_object:
                relations_count = _create_power_relations(
                    session, 
                    power_code_to_object
                )
                result.relations_created = relations_count
            
            session.commit()
            
    except Exception as e:
        result.success = False
        result.errors.append(f"数据库事务失败: {str(e)}")
    
    return result


def _create_object(session, file_id: int, obj_data: Dict) -> int:
    """
    创建 rds_objects 记录
    
    Returns:
        新创建的对象 ID
    """
    # 确定对象类型
    object_type = _determine_object_type(obj_data)
    
    # 生成参考编码（优先使用设备编码，否则用名称）
    ref_code = obj_data.get('asset_code', '') or obj_data.get('name', '')
    
    insert_query = text("""
        INSERT INTO rds_objects (file_id, object_type, ref_code, name, metadata)
        VALUES (:file_id, :object_type, :ref_code, :name, CAST(:metadata AS jsonb))
        RETURNING id
    """)
    
    import json
    metadata = json.dumps({
        'sheet': obj_data.get('sheet', ''),
        'row_index': obj_data.get('row_index', 0),
        'source': 'excel_import'
    })
    
    result = session.execute(insert_query, {
        'file_id': file_id,
        'object_type': object_type,
        'ref_code': ref_code,
        'name': obj_data.get('name', ''),
        'metadata': metadata
    })
    
    return result.fetchone()[0]


def _determine_object_type(obj_data: Dict) -> str:
    """根据编码和名称判断对象类型"""
    name = obj_data.get('name', '').lower()
    
    # 根据名称关键词判断
    type_keywords = {
        'equipment': ['电机', '泵', '风机', '空调', '设备'],
        'panel': ['柜', '屏', '箱', '配电'],
        'transformer': ['变压器', 'tr'],
        'cable': ['电缆', '桥架', '线路'],
        'sensor': ['传感器', '探测器', 'sensor'],
        'controller': ['控制器', 'plc', 'ddc'],
    }
    
    for obj_type, keywords in type_keywords.items():
        if any(kw in name for kw in keywords):
            return obj_type
    
    return 'equipment'  # 默认类型


def _create_aspect(session, object_id: int, aspect: Dict) -> None:
    """创建 rds_aspects 记录"""
    insert_query = text("""
        INSERT INTO rds_aspects (
            object_id, aspect_type, full_code, prefix, 
            parent_code, hierarchy_level
        )
        VALUES (
            :object_id, :aspect_type, :full_code, :prefix,
            :parent_code, :hierarchy_level
        )
        ON CONFLICT (object_id, full_code) DO NOTHING
    """)
    
    session.execute(insert_query, {
        'object_id': object_id,
        'aspect_type': aspect.get('aspect_type', 'function'),
        'full_code': aspect.get('full_code', ''),
        'prefix': aspect.get('prefix', ''),
        'parent_code': aspect.get('parent_code', ''),
        'hierarchy_level': aspect.get('hierarchy_level', 1)
    })


def _create_power_relations(
    session, 
    power_code_to_object: Dict[str, int]
) -> int:
    """
    根据电源编码的层级关系创建供电链路
    
    电源编码结构示例：
    ===DY1.AH1.H01.ZB1 (变压器)
    └── ===DY1.AH1.H01.ZB1.C1DP1 (配电柜进线)
        └── ===DY1.AH1.H01.ZB1.C1DP1.3 (配电柜出线回路)
            └── ===DY1.AH1.H01.ZB1.C1DP1.3.DP4O (馈线开关)
                └── ===DY1.AH1.H01.ZB1.C1DP1.3.DP4O.1 (终端设备)
    
    上级节点 FEEDS_POWER_TO 下级节点
    """
    relations_created = 0
    
    for code, object_id in power_code_to_object.items():
        # 找父级编码对应的对象
        parent_code = _get_parent_power_code(code)
        if parent_code and parent_code in power_code_to_object:
            parent_object_id = power_code_to_object[parent_code]
            
            # 创建供电关系：父级 -> 当前
            insert_query = text("""
                INSERT INTO rds_relations (
                    source_obj_id, target_obj_id, relation_type
                )
                VALUES (
                    :source_id, :target_id, 'FEEDS_POWER_TO'
                )
                ON CONFLICT ON CONSTRAINT unique_relation DO NOTHING
            """)
            
            session.execute(insert_query, {
                'source_id': parent_object_id,
                'target_id': object_id
            })
            relations_created += 1
    
    return relations_created


def _get_parent_power_code(code: str) -> Optional[str]:
    """
    获取电源编码的父级编码
    
    ===DY1.AH1.H01.ZB1.C1DP1.3 -> ===DY1.AH1.H01.ZB1.C1DP1
    """
    if not code or '===' not in code:
        return None
    
    # 移除前缀
    prefix = '==='
    body = code[len(prefix):]
    
    # 按点号分割
    parts = body.split('.')
    if len(parts) <= 1:
        return None
    
    # 返回父级
    return prefix + '.'.join(parts[:-1])


def clear_file_rds_data(file_id: int) -> Dict:
    """
    清除指定文件的所有 RDS 数据（用于重新导入）
    
    Args:
        file_id: 模型文件 ID
        
    Returns:
        删除统计
    """
    try:
        with SessionLocal() as session:
            # 先删除关系
            relations_deleted = session.execute(text("""
                DELETE FROM rds_relations 
                WHERE source_obj_id IN (SELECT id FROM rds_objects WHERE file_id = :file_id)
                   OR target_obj_id IN (SELECT id FROM rds_objects WHERE file_id = :file_id)
            """), {'file_id': file_id}).rowcount
            
            # 删除方面
            aspects_deleted = session.execute(text("""
                DELETE FROM rds_aspects 
                WHERE object_id IN (SELECT id FROM rds_objects WHERE file_id = :file_id)
            """), {'file_id': file_id}).rowcount
            
            # 删除对象
            objects_deleted = session.execute(text("""
                DELETE FROM rds_objects WHERE file_id = :file_id
            """), {'file_id': file_id}).rowcount
            
            session.commit()
            
            return {
                'success': True,
                'objects_deleted': objects_deleted,
                'aspects_deleted': aspects_deleted,
                'relations_deleted': relations_deleted
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
