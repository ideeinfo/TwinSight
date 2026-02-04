"""
编码解析 API 路由

提供 IEC 81346-12 编码解析相关接口：
- 单个编码解析
- 层级展开
- Excel 文件导入解析
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
import pandas as pd
import io

from services.iec_parser import IECParser
from models.schemas import (
    ParseRequest, 
    ParseResponse, 
    ExcelImportResponse,
    AspectInfo,
    ParsedObject
)

router = APIRouter()
parser = IECParser()


@router.post("/code", response_model=ParseResponse)
async def parse_single_code(request: ParseRequest):
    """
    解析单个 IEC 编码
    
    Args:
        request: 包含编码字符串的请求体
        
    Returns:
        解析后的编码信息
        
    Raises:
        HTTPException: 无法解析编码时返回 400 错误
    """
    result = parser.parse_code(request.code)
    if not result:
        raise HTTPException(status_code=400, detail=f"无法解析编码: {request.code}")
    
    return ParseResponse(
        full_code=result.full_code,
        prefix=result.prefix,
        aspect_type=result.aspect_type,
        hierarchy_level=result.hierarchy_level,
        parent_code=result.parent_code,
        segments=result.segments
    )


@router.post("/hierarchy", response_model=List[ParseResponse])
async def expand_hierarchy(request: ParseRequest):
    """
    展开编码的完整层级链
    
    从根节点展开到目标节点的完整路径。
    例如: =TA001.BJ01.PP01 -> [=TA001, =TA001.BJ01, =TA001.BJ01.PP01]
    
    Args:
        request: 包含编码字符串的请求体
        
    Returns:
        层级链中所有节点的解析结果列表
    """
    results = parser.expand_hierarchy(request.code)
    if not results:
        raise HTTPException(status_code=400, detail=f"无法解析编码: {request.code}")
    
    return [
        ParseResponse(
            full_code=r.full_code,
            prefix=r.prefix,
            aspect_type=r.aspect_type,
            hierarchy_level=r.hierarchy_level,
            parent_code=r.parent_code,
            segments=r.segments
        )
        for r in results
    ]


@router.post("/excel", response_model=ExcelImportResponse)
async def import_excel(file: UploadFile = File(...)):
    """
    导入 Excel 文件并解析所有编码
    
    支持 .xlsx 和 .xls 格式，自动读取所有工作表。
    解析每行数据中的三种方面编码（工艺功能、位置、电源功能）。
    
    Args:
        file: 上传的 Excel 文件
        
    Returns:
        解析结果，包含所有对象及其方面编码
    """
    # 验证文件格式
    valid_extensions = ('.xlsx', '.xls')
    if not file.filename.lower().endswith(valid_extensions):
        raise HTTPException(
            status_code=400, 
            detail="仅支持 Excel 文件 (.xlsx, .xls)"
        )
    
    # 读取文件内容
    content = await file.read()
    
    try:
        # sheet_name=None 读取所有工作表，返回字典 {sheet_name: df}
        dfs = pd.read_excel(io.BytesIO(content), sheet_name=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"读取 Excel 文件失败: {str(e)}")
    
    results = ExcelImportResponse(
        total_rows=0,
        parsed_objects=[],
        errors=[]
    )
    
    # 列名映射（支持中英文列名）
    column_mapping = {
        '工艺功能': 'function',
        '位置': 'location', 
        '电源功能': 'power',
        'ProcessFunction': 'function',
        'Location': 'location',
        'PowerFunction': 'power'
    }
    
    for sheet_name, df in dfs.items():
        results.total_rows += len(df)
        
        for idx, row in df.iterrows():
            try:
                obj = ParsedObject(
                    sheet=sheet_name,
                    row_index=int(idx),
                    name=str(row.get('名称', row.get('Name', ''))),
                    asset_code=str(row.get('设备编码', row.get('DeviceCode', ''))),
                    aspects=[]
                )
                
                # 解析三种方面编码
                for col_name, aspect_type in column_mapping.items():
                    code = row.get(col_name, '')
                    if pd.notna(code) and str(code).strip():
                        # Fix: Use parse_code instead of expand_hierarchy to avoid creating duplicate
                        # aspect entries for parent levels when they are not explicitly defined as objects.
                        # Each object should only claim the specific code defined in its row.
                        parsed = parser.parse_code(str(code))
                        if parsed:
                            obj.aspects.append(AspectInfo(
                                full_code=parsed.full_code,
                                prefix=parsed.prefix,
                                aspect_type=parsed.aspect_type,
                                hierarchy_level=parsed.hierarchy_level,
                                parent_code=parsed.parent_code
                            ))
                
                results.parsed_objects.append(obj)
                
            except Exception as e:
                results.errors.append(f"Sheet '{sheet_name}' 行 {idx}: {str(e)}")
    
    return results


@router.post("/batch")
async def parse_batch(codes: List[str]):
    """
    批量解析多个编码
    
    Args:
        codes: 编码字符串列表
        
    Returns:
        解析结果列表，无法解析的编码返回 null
    """
    results = []
    for code in codes:
        parsed = parser.parse_code(code)
        if parsed:
            results.append({
                "code": code,
                "parsed": ParseResponse(
                    full_code=parsed.full_code,
                    prefix=parsed.prefix,
                    aspect_type=parsed.aspect_type,
                    hierarchy_level=parsed.hierarchy_level,
                    parent_code=parsed.parent_code,
                    segments=parsed.segments
                )
            })
        else:
            results.append({
                "code": code,
                "parsed": None,
                "error": "无法解析"
            })
    
    return {"results": results, "total": len(codes), "success": sum(1 for r in results if r.get("parsed"))}
