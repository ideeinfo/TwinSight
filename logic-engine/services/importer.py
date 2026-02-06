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
    
    # 新增：电源图统计
    power_nodes_created = 0
    power_edges_created = 0
    
    try:
        with SessionLocal() as session:
            # 用于追踪电源编码和对象的映射（用于建立供电关系）
            power_code_to_object: Dict[str, int] = {}
            
            # 新增：收集电源方面和对象ID映射
            power_aspects: List[Dict] = []
            asset_code_to_object_id: Dict[str, str] = {}
            
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
                    
                    # 记录资产编码映射
                    asset_code = obj_data.get('asset_code', '')
                    if asset_code:
                        asset_code_to_object_id[asset_code] = object_id
                    
                    # 2. 创建 rds_aspects 记录
                    for aspect in obj_data.get('aspects', []):
                        _create_aspect(session, object_id, aspect)
                        result.aspects_created += 1
                        
                        # 记录电源编码映射 (用于旧的 rds_relations)
                        if aspect.get('aspect_type') == 'power':
                            power_code_to_object[aspect['full_code']] = object_id
                            
                            # 新增：收集电源方面用于图数据
                            power_aspects.append({
                                'full_code': aspect['full_code'],
                                'asset_code': asset_code,
                                'name': obj_data.get('name', '')
                            })
                    
                    savepoint.commit()
                    
                except Exception as e:
                    savepoint.rollback()
                    result.errors.append(
                        f"对象 '{obj_data.get('name', 'unknown')}': {str(e)}"
                    )
            
            # 3. 创建供电链路关系 (旧逻辑，保留兼容)
            if create_power_relations and power_code_to_object:
                relations_count = _create_power_relations(
                    session, 
                    power_code_to_object
                )
                result.relations_created = relations_count
            
            # 4. 新增：创建电源图数据 (新逻辑)
            if power_aspects:
                graph_result = _create_power_graph_data(
                    session,
                    file_id,
                    power_aspects,
                    asset_code_to_object_id
                )
                power_nodes_created = graph_result['nodes_created']
                power_edges_created = graph_result['edges_created']
            
            session.commit()
            
    except Exception as e:
        result.success = False
        result.errors.append(f"数据库事务失败: {str(e)}")
    
    # 添加电源图统计到结果（暂时放在 errors 中作为额外信息）
    if power_nodes_created > 0 or power_edges_created > 0:
        result.errors.append(f"[INFO] 电源图: {power_nodes_created} 节点, {power_edges_created} 边")
    
    return result


def _create_object(session, file_id: int, obj_data: Dict) -> int:
    """
    创建 rds_objects 记录
    
    Returns:
        新创建的对象 ID
    """
    # 确定对象类型
    object_type = _determine_object_type(obj_data)
    
    # 生成参考编码（优先使用传入的 ref_code，否则尝试 asset_code 或 name）
    ref_code = obj_data.get('ref_code') or obj_data.get('asset_code', '') or obj_data.get('name', '')
    
    # 使用 upsert 语法处理重复记录
    insert_query = text("""
        INSERT INTO rds_objects (file_id, object_type, ref_code, name, mc_code, metadata)
        VALUES (:file_id, :object_type, :ref_code, :name, :mc_code, CAST(:metadata AS jsonb))
        ON CONFLICT (file_id, object_type, ref_code) DO UPDATE SET
            name = EXCLUDED.name,
            mc_code = EXCLUDED.mc_code,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        RETURNING id
    """)
    
    import json
    metadata = json.dumps({
        'sheet': obj_data.get('sheet', ''),
        'row_index': obj_data.get('row_index', 0),
        'original_asset_code': obj_data.get('asset_code', ''),
        'source': 'excel_import'
    })
    
    result = session.execute(insert_query, {
        'file_id': file_id,
        'object_type': object_type,
        'ref_code': ref_code,
        'name': obj_data.get('name', ''),
        'mc_code': obj_data.get('asset_code', ''),
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
        ON CONFLICT (object_id, aspect_type, full_code) DO NOTHING
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
            
            # 避免自引用关系
            if parent_object_id == object_id:
                continue
            
            # 创建供电关系：父级 -> 当前
            insert_query = text("""
                INSERT INTO rds_relations (
                    source_obj_id, target_obj_id, relation_type
                )
                VALUES (
                    :source_id, :target_id, 'FEEDS_POWER_TO'
                )
                ON CONFLICT (source_obj_id, target_obj_id, relation_type) DO NOTHING
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
    
    # 返回父级
    if code.endswith('.'):
        # A. 的父级是 A
        return code[:-1]
    else:
        # A.B 的父级是 A.
        # 使用 rfind 查找最后一个点号
        last_dot_idx = code.rfind('.')
        # 确保点号不在前缀中（===\+\+等）
        if last_dot_idx > len(prefix):
            return code[:last_dot_idx + 1]
            
    return None


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
            
            # 新增：删除电源图边（先删边，因为有外键约束）
            power_edges_deleted = session.execute(text("""
                DELETE FROM rds_power_edges WHERE file_id = :file_id
            """), {'file_id': file_id}).rowcount
            
            # 新增：删除电源图节点
            power_nodes_deleted = session.execute(text("""
                DELETE FROM rds_power_nodes WHERE file_id = :file_id
            """), {'file_id': file_id}).rowcount
            
            session.commit()
            
            return {
                'success': True,
                'objects_deleted': objects_deleted,
                'aspects_deleted': aspects_deleted,
                'relations_deleted': relations_deleted,
                'power_nodes_deleted': power_nodes_deleted,
                'power_edges_deleted': power_edges_deleted
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def _create_power_graph_data(
    session,
    file_id: int,
    power_aspects: List[Dict],
    object_id_map: Dict[str, str]  # asset_code -> object_id
) -> Dict[str, int]:
    """
    将电源编码数据导入到 rds_power_nodes 和 rds_power_edges 表
    
    支持双电源设备：同一 asset_code 的设备只创建一个节点，
    但会从多个不同的电源路径创建边指向它。
    
    Args:
        session: 数据库会话
        file_id: 模型文件 ID
        power_aspects: 电源方面列表 [{'full_code': '===DY1.AH1', 'asset_code': 'HSC001', 'name': 'AH5柜出线'}, ...]
        object_id_map: 资产编码到 rds_objects.id 的映射
        
    Returns:
        统计 {'nodes_created': N, 'edges_created': M}
    """
    import uuid
    
    nodes_created = 0
    edges_created = 0
    
    # 用于追踪已创建的节点 (full_code -> node_id) - 用于层级节点
    created_nodes: Dict[str, str] = {}
    
    # 用于追踪设备节点 (asset_code -> node_id) - 用于末端设备节点去重
    device_nodes: Dict[str, str] = {}
    
    # 收集所有需要创建的设备边 (parent_node_id, device_node_id, relation_type)
    device_edges_to_create: List[tuple] = []
    
    # ========== 预处理：对电源编码排序 ==========
    # 
    # 同一个 asset_code 可能有多个电源编码（如逻辑节点和实体引用）。
    # 确保逻辑节点（无末尾点）在实体引用（有末尾点）之前处理，
    # 这样当处理实体引用时，它的父逻辑节点已经存在。
    #
    # 排序规则：
    # 1. 按编码长度升序（层级浅的优先）
    # 2. 无末尾点的优先于有末尾点的（逻辑节点优先于实体引用）
    #
    def sort_key(aspect):
        code = aspect.get('full_code', '')
        has_dot = code.endswith('.')
        return (len(code), has_dot)
    
    sorted_power_aspects = sorted(power_aspects, key=sort_key)
    
    for aspect in sorted_power_aspects:
        full_code = aspect.get('full_code', '')
        if not full_code or not full_code.startswith('==='):
            continue
        
        asset_code = aspect.get('asset_code', '')
        device_name = aspect.get('name', '')
        
        # 解析层级：===DY1.AH1.H01 -> ['DY1', 'AH1', 'H01']
        # 
        # 末尾点号的语义 (IEC 81346-12):
        # - 不带末尾点 (===DY2...DP9O.1.1) = 逻辑节点，仅存在于电源功能维度
        # - 带末尾点 (===DY2...DP9O.1.1.) = 实体对象，引用上述逻辑节点
        # 
        # 因此：===DY2...DP9O.1.1. 的父节点是 ===DY2...DP9O.1.1
        #
        prefix = '==='
        body = full_code[len(prefix):]
        
        # 检测是否有末尾点号 (表示实体引用)
        has_trailing_dot = body.endswith('.')
        if has_trailing_dot:
            body_without_dot = body[:-1]
        else:
            body_without_dot = body
        
        parts = [p for p in body_without_dot.split('.') if p]
        
        if not parts:
            continue
        
        # ========== 阶段 1: 创建层级路径上的所有逻辑节点 ==========
        # 
        # 首先创建整个层级路径上的逻辑节点 (不带末尾点)
        # 例如：===DY1, ===DY1.AH1, ===DY1.AH1.H01 ...
        #
        current_full_code = prefix
        parent_node_id = None
        last_hierarchy_node_id = None  # 最后一个层级节点 (设备的直接父节点)
        
        # 判断是否需要单独创建设备节点 (有 asset_code 的才创建独立设备节点)
        create_separate_device = bool(asset_code)
        
        for i, part in enumerate(parts):
            level = i + 1
            is_last_part = (i == len(parts) - 1)
            
            if i == 0:
                current_full_code = prefix + part
            else:
                current_full_code = current_full_code + '.' + part
            
            # 如果是最后一段且有 asset_code，这是一个设备节点，稍后单独处理
            # 但如果有末尾点号，需要先创建逻辑父节点
            if is_last_part and create_separate_device and not has_trailing_dot:
                last_hierarchy_node_id = parent_node_id
                break
            
            # 检查层级节点是否已存在
            if current_full_code in created_nodes:
                parent_node_id = created_nodes[current_full_code]
                # 更新 last_hierarchy_node_id（用于后续设备节点连接）
                if is_last_part:
                    last_hierarchy_node_id = parent_node_id
                # 如果是最后一段且有名称，尝试更新这个已存在节点的 label
                if is_last_part and device_name and not device_name.strip().startswith('='):
                    update_label = text("""
                        UPDATE rds_power_nodes 
                        SET label = :label 
                        WHERE file_id = :file_id AND full_code = :full_code 
                        AND (label = short_code OR label IS NULL OR label = '')
                    """)
                    session.execute(update_label, {
                        'label': device_name,
                        'file_id': file_id,
                        'full_code': current_full_code
                    })
                continue
            
            # 生成确定性 UUID (基于 full_code)
            node_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"POWER_NODE_{file_id}_{current_full_code}"))
            
            # 确定节点类型
            node_type = 'feeder'
            if level == 1:
                node_type = 'source'
            elif level == 2:
                node_type = 'bus'
            elif is_last_part:
                node_type = 'device'  # 末端且没有 asset_code，仍然是设备类型
            
            # 对于末端节点，使用名称作为 label；中间节点使用短码
            if is_last_part and device_name and not device_name.strip().startswith('='):
                label = device_name
            else:
                label = part
            
            # 父级编码
            parent_code = None
            if i > 0:
                parent_code = prefix + '.'.join(parts[:i])
            
            # 插入层级节点
            insert_node = text("""
                INSERT INTO rds_power_nodes (
                    id, file_id, object_id, full_code, short_code, parent_code, label, level, node_type
                )
                VALUES (
                    :id, :file_id, NULL, :full_code, :short_code, :parent_code, :label, :level, :node_type
                )
                ON CONFLICT (file_id, full_code) DO UPDATE SET
                    label = CASE 
                        WHEN EXCLUDED.label != EXCLUDED.short_code THEN EXCLUDED.label 
                        ELSE rds_power_nodes.label 
                    END
            """)
            
            session.execute(insert_node, {
                'id': node_id,
                'file_id': file_id,
                'full_code': current_full_code,
                'short_code': part,
                'parent_code': parent_code,
                'label': label,
                'level': level,
                'node_type': node_type
            })
            nodes_created += 1
            created_nodes[current_full_code] = node_id
            
            # 创建层级边
            if parent_node_id:
                edge_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"POWER_EDGE_{parent_node_id}_{node_id}_hierarchy"))
                insert_edge = text("""
                    INSERT INTO rds_power_edges (
                        id, file_id, source_node_id, target_node_id, relation_type
                    )
                    VALUES (
                        :id, :file_id, :source_id, :target_id, 'hierarchy'
                    )
                    ON CONFLICT (source_node_id, target_node_id, relation_type) DO NOTHING
                """)
                session.execute(insert_edge, {
                    'id': edge_id,
                    'file_id': file_id,
                    'source_id': parent_node_id,
                    'target_id': node_id
                })
                edges_created += 1
            
            parent_node_id = node_id
            last_hierarchy_node_id = node_id
        
        # ========== 特殊处理：末尾点号的实体引用 ==========
        # 
        # 如果编码有末尾点号 (如 ===DY2...DP9O.1.1.)，表示这是一个实体对象，
        # 它引用了逻辑节点 (===DY2...DP9O.1.1)。
        # 此时 last_hierarchy_node_id 应该是完整逻辑路径的最后一个节点。
        #
        if has_trailing_dot and last_hierarchy_node_id is None:
            # 如果循环结束后 last_hierarchy_node_id 仍为 None，
            # 说明所有层级节点都已创建，最后一个就是父节点
            last_hierarchy_node_id = parent_node_id
        
        # ========== 阶段 2: 创建设备节点（基于 asset_code 去重） ==========
        if asset_code:
            # 检查设备节点是否已存在
            if asset_code not in device_nodes:
                # 基于 asset_code 生成确定性 UUID
                device_node_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"POWER_DEVICE_{file_id}_{asset_code}"))
                
                # 设备标签优先使用名称
                device_label = device_name if device_name and not device_name.strip().startswith('=') else asset_code
                
                # 获取关联的 object_id
                object_id = object_id_map.get(asset_code)
                
                # 插入设备节点 (full_code 使用 asset_code 作为标识)
                insert_device = text("""
                    INSERT INTO rds_power_nodes (
                        id, file_id, object_id, full_code, short_code, parent_code, label, level, node_type
                    )
                    VALUES (
                        :id, :file_id, :object_id, :full_code, :short_code, NULL, :label, 99, 'device'
                    )
                    ON CONFLICT (file_id, full_code) DO UPDATE SET
                        label = CASE 
                            WHEN EXCLUDED.label != EXCLUDED.short_code THEN EXCLUDED.label 
                            ELSE rds_power_nodes.label 
                        END,
                        object_id = COALESCE(EXCLUDED.object_id, rds_power_nodes.object_id)
                """)
                
                session.execute(insert_device, {
                    'id': device_node_id,
                    'file_id': file_id,
                    'object_id': object_id,
                    'full_code': f"DEVICE:{asset_code}",  # 使用特殊前缀区分设备节点
                    'short_code': asset_code,
                    'label': device_label
                })
                nodes_created += 1
                device_nodes[asset_code] = device_node_id
            else:
                device_node_id = device_nodes[asset_code]
            
            # 记录需要创建的边 (从父馈线柜到设备)
            if last_hierarchy_node_id:
                device_edges_to_create.append((last_hierarchy_node_id, device_node_id, 'power_supply'))
    
    # ========== 阶段 3: 创建设备边（支持多电源） ==========
    for source_id, target_id, rel_type in device_edges_to_create:
        edge_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"POWER_EDGE_{source_id}_{target_id}_{rel_type}"))
        insert_edge = text("""
            INSERT INTO rds_power_edges (
                id, file_id, source_node_id, target_node_id, relation_type
            )
            VALUES (
                :id, :file_id, :source_id, :target_id, :rel_type
            )
            ON CONFLICT (source_node_id, target_node_id, relation_type) DO NOTHING
        """)
        session.execute(insert_edge, {
            'id': edge_id,
            'file_id': file_id,
            'source_id': source_id,
            'target_id': target_id,
            'rel_type': rel_type
        })
        edges_created += 1
    
    return {
        'nodes_created': nodes_created,
        'edges_created': edges_created
    }

