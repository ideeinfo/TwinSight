"""
Pydantic 数据模型

定义 API 请求/响应的数据结构
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ==================== 解析相关模型 ====================

class ParseRequest(BaseModel):
    """编码解析请求"""
    code: str = Field(..., description="IEC 编码字符串", example="=TA001.BJ01.PP01")


class ParseResponse(BaseModel):
    """编码解析响应"""
    full_code: str = Field(..., description="完整代号")
    prefix: str = Field(..., description="前缀符号")
    aspect_type: str = Field(..., description="方面类型: function/location/power")
    hierarchy_level: int = Field(..., description="层级深度")
    parent_code: Optional[str] = Field(None, description="父级编码")
    segments: List[str] = Field(..., description="层级段落列表")


class AspectInfo(BaseModel):
    """方面编码信息"""
    full_code: str
    prefix: str
    aspect_type: str
    hierarchy_level: int
    parent_code: Optional[str]


class ParsedObject(BaseModel):
    """解析后的对象"""
    sheet: str = Field(..., description="来源工作表名")
    row_index: int = Field(..., description="行索引")
    name: str = Field(..., description="对象名称")
    asset_code: str = Field(..., description="设备编码")
    aspects: List[AspectInfo] = Field(..., description="方面编码列表")


class ExcelImportResponse(BaseModel):
    """Excel 导入响应"""
    total_rows: int = Field(..., description="总行数")
    parsed_objects: List[ParsedObject] = Field(..., description="解析后的对象列表")
    errors: List[str] = Field(..., description="错误信息列表")


# ==================== 拓扑追溯相关模型 ====================

class TraceRequest(BaseModel):
    """拓扑追溯请求"""
    object_id: str = Field(..., description="起始对象 ID")
    direction: str = Field("upstream", description="追溯方向: upstream(上游) 或 downstream(下游)")
    relation_type: str = Field("FEEDS_POWER_TO", description="关系类型，如 FEEDS_POWER_TO(供电)")


class TraceNode(BaseModel):
    """追溯节点"""
    id: str = Field(..., description="对象 ID")
    ref_code: str = Field(..., description="引用编码")
    name: str = Field(..., description="对象名称")
    level: int = Field(..., description="距离起始节点的层级")


class TraceResponse(BaseModel):
    """拓扑追溯响应"""
    nodes: List[TraceNode] = Field(..., description="追溯路径上的节点列表")
    total: int = Field(..., description="节点总数")


# ==================== 树节点相关模型 ====================

class TreeNode(BaseModel):
    """树节点"""
    code: str = Field(..., description="节点编码")
    name: str = Field(..., description="节点名称")
    level: int = Field(..., description="层级深度")
    parent_code: Optional[str] = Field(None, description="父节点编码")
    bim_guid: Optional[str] = Field(None, description="BIM 模型 GUID")
    has_children: bool = Field(..., description="是否有子节点")


class TreeResponse(BaseModel):
    """树数据响应"""
    success: bool = True
    data: List[TreeNode] = Field(..., description="树节点列表")


# ==================== 反向查询相关模型 ====================

class LookupResult(BaseModel):
    """反向查询结果"""
    object_id: Optional[str] = Field(None, description="对象 ID")
    asset_code: Optional[str] = Field(None, description="资产编码")
    name: Optional[str] = Field(None, description="对象名称")
    aspects: Dict[str, List[AspectInfo]] = Field(..., description="按方面类型分组的编码列表")
