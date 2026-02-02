"""
数据导入 API 路由

提供 Excel 数据导入到数据库的接口：
- 上传并解析 Excel 文件
- 将解析结果导入数据库
- 清除已导入数据
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Optional
import pandas as pd
import io

from services.iec_parser import IECParser
from services.importer import import_excel_data, clear_file_rds_data, ImportResult

router = APIRouter()
parser = IECParser()


@router.post("/excel/{file_id}")
async def import_excel_to_db(
    file_id: int,
    file: UploadFile = File(...),
    clear_existing: bool = Query(False, description="导入前清除现有数据"),
    create_relations: bool = Query(True, description="自动创建供电关系")
):
    """
    上传 Excel 并导入到数据库
    
    完整流程：
    1. 解析 Excel 文件中的所有编码
    2. 创建 rds_objects 记录
    3. 创建 rds_aspects 记录（多维度方面编码）
    4. 自动建立供电链路关系
    
    Args:
        file_id: 关联的模型文件 ID
        file: Excel 文件 (.xlsx 或 .xls)
        clear_existing: 是否在导入前清除该文件的现有 RDS 数据
        create_relations: 是否自动创建供电关系
        
    Returns:
        导入统计结果
    """
    # 验证文件格式
    valid_extensions = ('.xlsx', '.xls')
    if not file.filename.lower().endswith(valid_extensions):
        raise HTTPException(
            status_code=400, 
            detail="仅支持 Excel 文件 (.xlsx, .xls)"
        )
    
    # 如果需要，先清除现有数据
    if clear_existing:
        clear_result = clear_file_rds_data(file_id)
        if not clear_result.get('success'):
            raise HTTPException(
                status_code=500,
                detail=f"清除现有数据失败: {clear_result.get('error')}"
            )
    
    # 读取文件内容
    content = await file.read()
    
    try:
        dfs = pd.read_excel(io.BytesIO(content), sheet_name=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"读取 Excel 文件失败: {str(e)}")
    
    # 列名映射（支持中英文列名）
    column_mapping = {
        '工艺功能': 'function',
        '位置': 'location', 
        '电源功能': 'power',
        'ProcessFunction': 'function',
        'Location': 'location',
        'PowerFunction': 'power'
    }
    
    # 解析 Excel 数据
    parsed_objects = []
    parse_errors = []
    total_rows = 0
    
    # 1. 收集所有 Excel 行定义的显式对象
    # ref_code -> obj_data
    explicit_objects_map = {} 
    # 记录所有已被显式对象占用的 full_code，避免为它们创建虚拟父节点
    known_codes = set() 
    
    for sheet_name, df in dfs.items():
        total_rows += len(df)
        
        for idx, row in df.iterrows():
            try:
                name = str(row.get('名称', row.get('Name', ''))).strip()
                asset_code = str(row.get('设备编码', row.get('DeviceCode', ''))).strip()
                
                # 生成唯一标识 ref_code (优先用设备编码，其次用名称+行号防止重名)
                if asset_code:
                    ref_code = asset_code
                elif name:
                    ref_code = f"{name}_{sheet_name}_{idx}"
                else:
                    continue # 跳过空行
                
                obj = {
                    'sheet': sheet_name,
                    'row_index': int(idx),
                    'name': name,
                    'asset_code': asset_code,
                    'aspects': []
                }
                
                # 解析三种方面编码（只取当前对象的直接编码）
                for col_name, aspect_type in column_mapping.items():
                    code = row.get(col_name, '')
                    if pd.notna(code) and str(code).strip():
                        # 清理编码
                        code_str = str(code).strip().rstrip('.')
                        if code_str:
                            # 仅解析当前编码结构，不展开层级
                            parsed = parser.parse_code(code_str)
                            if parsed:
                                known_codes.add(parsed.full_code)
                                obj['aspects'].append({
                                    'full_code': parsed.full_code,
                                    'prefix': parsed.prefix,
                                    'aspect_type': parsed.aspect_type,
                                    'hierarchy_level': parsed.hierarchy_level,
                                    'parent_code': parsed.parent_code
                                })
                
                if obj['aspects']:
                    explicit_objects_map[ref_code] = obj
                    
            except Exception as e:
                parse_errors.append(f"Sheet '{sheet_name}' 行 {idx}: {str(e)}")
    
    parsed_objects = list(explicit_objects_map.values())
    
    # 2. 补全缺失的父节点（虚拟对象）
    virtual_objects = []
    processed_virtual_codes = set()

    for obj in parsed_objects:
        for aspect in obj['aspects']:
            # 展开该 aspect 的所有父级
            hierarchy = parser.expand_hierarchy(aspect['full_code'])
            
            # 排除掉最后一个（即它自己）
            parents = hierarchy[:-1] if hierarchy else []
            
            for p in parents:
                if p.full_code in known_codes:
                    continue # 已经有显式对象了，跳过
                
                if p.full_code in processed_virtual_codes:
                    continue # 已经创建过虚拟对象了，跳过
                
                # 创建虚拟系统对象
                virtual_obj = {
                    'sheet': 'SYSTEM_GENERATED',
                    'row_index': -1,
                    'name': p.full_code,  # 虚拟对象默认用编码作为名称
                    'asset_code': p.full_code, # 用 full_code 作为 ref_code
                    'object_type': 'system',
                    'aspects': [{
                        'full_code': p.full_code,
                        'prefix': p.prefix,
                        'aspect_type': p.aspect_type,
                        'hierarchy_level': p.hierarchy_level,
                        'parent_code': p.parent_code
                    }]
                }
                virtual_objects.append(virtual_obj)
                processed_virtual_codes.add(p.full_code)
    
    # 合并显式对象和虚拟对象
    all_objects = parsed_objects + virtual_objects
    
    # 导入到数据库
    import_result = import_excel_data(
        file_id=file_id,
        parsed_objects=all_objects,
        create_power_relations=create_relations
    )
    
    return {
        'success': import_result.success,
        'statistics': {
            'total_rows': total_rows,
            'parsed_objects': len(parsed_objects), # 只统计显式解析的对象
            'virtual_objects_created': len(virtual_objects), # 额外统计虚拟对象
            'objects_created': import_result.objects_created,
            'aspects_created': import_result.aspects_created,
            'relations_created': import_result.relations_created
        },
        'errors': parse_errors + import_result.errors
    }


@router.delete("/{file_id}")
async def clear_rds_data(file_id: int):
    """
    清除指定文件的所有 RDS 数据
    
    删除该文件关联的所有 rds_objects、rds_aspects、rds_relations 记录。
    用于重新导入数据前的清理操作。
    
    Args:
        file_id: 模型文件 ID
        
    Returns:
        删除统计
    """
    result = clear_file_rds_data(file_id)
    
    if not result.get('success'):
        raise HTTPException(
            status_code=500,
            detail=f"清除数据失败: {result.get('error')}"
        )
    
    return {
        'success': True,
        'deleted': {
            'objects': result.get('objects_deleted', 0),
            'aspects': result.get('aspects_deleted', 0),
            'relations': result.get('relations_deleted', 0)
        }
    }


@router.get("/{file_id}/stats")
async def get_rds_stats(file_id: int):
    """
    获取指定文件的 RDS 数据统计
    
    Args:
        file_id: 模型文件 ID
        
    Returns:
        数据统计
    """
    from sqlalchemy import text
    from services.importer import SessionLocal
    
    try:
        with SessionLocal() as session:
            # 对象统计
            objects_result = session.execute(text("""
                SELECT object_type, COUNT(*) as count
                FROM rds_objects
                WHERE file_id = :file_id
                GROUP BY object_type
            """), {'file_id': file_id}).fetchall()
            
            # 方面统计
            aspects_result = session.execute(text("""
                SELECT a.aspect_type, COUNT(*) as count
                FROM rds_aspects a
                JOIN rds_objects o ON a.object_id = o.id
                WHERE o.file_id = :file_id
                GROUP BY a.aspect_type
            """), {'file_id': file_id}).fetchall()
            
            # 关系统计
            relations_result = session.execute(text("""
                SELECT r.relation_type, COUNT(*) as count
                FROM rds_relations r
                JOIN rds_objects o ON r.source_obj_id = o.id OR r.target_obj_id = o.id
                WHERE o.file_id = :file_id
                GROUP BY r.relation_type
            """), {'file_id': file_id}).fetchone()
            
            return {
                'file_id': file_id,
                'objects': {row.object_type: row.count for row in objects_result},
                'aspects': {row.aspect_type: row.count for row in aspects_result},
                'relations': dict(relations_result._mapping) if relations_result else {},
                'totals': {
                    'objects': sum(row.count for row in objects_result),
                    'aspects': sum(row.count for row in aspects_result)
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询统计失败: {str(e)}")
