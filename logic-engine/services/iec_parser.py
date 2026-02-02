"""
IEC 81346-12 编码解析器

支持三种方面编码的解析：
- 功能 (=)：工艺功能视图
- 位置 (++)：空间位置视图
- 电源 (===)：电源供应视图
"""

import re
from dataclasses import dataclass
from typing import List, Optional


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
    
    # 前缀映射（按长度降序，确保 === 先于 = 匹配）
    PREFIX_MAP = {
        '===': 'power',      # 电源功能
        '++': 'location',    # 位置
        '=': 'function',     # 工艺功能
    }
    
    # 前缀正则（按长度降序匹配）
    PREFIX_PATTERN = re.compile(r'^(===|\+\+|=)')
    
    def parse_code(self, code: str) -> Optional[AspectCode]:
        """
        解析单个 IEC 编码
        
        Args:
            code: IEC 编码字符串，如 "=TA001.BJ01.PP01"
            
        Returns:
            AspectCode 对象，解析失败返回 None
        """
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
        
        # 处理末尾可能的点号
        if code_body.endswith('.'):
            code_body = code_body[:-1]
        
        segments = code_body.split('.') if code_body else []
        
        # 过滤空段
        segments = [s for s in segments if s]
        
        if not segments:
            return None
        
        # 构建层级
        hierarchy_level = len(segments)
        parent_code = None
        if hierarchy_level > 1:
            parent_segments = segments[:-1]
            parent_code = prefix + '.'.join(parent_segments)
        
        return AspectCode(
            full_code=prefix + '.'.join(segments),
            prefix=prefix,
            aspect_type=aspect_type,
            hierarchy_level=hierarchy_level,
            parent_code=parent_code,
            segments=segments
        )
    
    def expand_hierarchy(self, code: str) -> List[AspectCode]:
        """
        展开编码的完整层级链
        
        Args:
            code: IEC 编码字符串
            
        Returns:
            从根节点到当前节点的完整层级列表
            
        Example:
            输入: "=TA001.BJ01.PP01"
            输出: [
                AspectCode("=TA001", level=1),
                AspectCode("=TA001.BJ01", level=2),
                AspectCode("=TA001.BJ01.PP01", level=3)
            ]
        """
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
    
    def get_aspect_type_label(self, aspect_type: str) -> str:
        """获取方面类型的中文标签"""
        labels = {
            'function': '工艺功能',
            'location': '位置',
            'power': '电源'
        }
        return labels.get(aspect_type, aspect_type)
    
    def get_prefix_for_type(self, aspect_type: str) -> str:
        """获取方面类型对应的前缀符号"""
        prefixes = {
            'function': '=',
            'location': '++',
            'power': '==='
        }
        return prefixes.get(aspect_type, '=')
