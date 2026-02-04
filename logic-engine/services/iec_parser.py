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
        
        # 分割段落
        # 注意：不保留空段，纯粹提取语义段落
        segments = [s for s in code_body.split('.') if s]
        
        if not segments:
            return None
        
        # 计算层级
        # 规则：每个段落代表两层（实体层+容器层）
        # A -> 1 (实体)
        # A. -> 2 (容器)
        # A.B -> 3 (实体)
        # 
        # 公式：dot_count * 2 + 1
        # 如果以点号结尾，level -= 1 (因为最后一段贡献了dot但还没有下一段实体... 不对)
        # 
        # 修正逻辑：
        # Base Level = segments_count * 2 
        # 如果不以点号结尾，说明是实体，level - 1
        # Example:
        # A (1 seg, no dot): 2 - 1 = 1. Correct.
        # A. (1 seg, has dot): 2. Correct.
        # A.B (2 segs, no dot): 4 - 1 = 3. Correct.
        # A.B. (2 segs, has dot): 4. Correct.
        
        has_trailing_dot = code.endswith('.')
        hierarchy_level = len(segments) * 2
        if not has_trailing_dot:
            hierarchy_level -= 1
            
        # 计算父级编码
        parent_code = None
        if has_trailing_dot:
            # 容器节点的父级是同名的实体节点 (去掉末尾点号)
            # A. -> A
            parent_code = code[:-1]
        else:
            # 实体节点的父级是上一段的容器节点 (当前段之前的所有内容 + 点号)
            # A.B -> A.
            # A -> None (or Prefix?) -> None
            
            # 使用 rfind 找最后一个点号
            last_dot_idx = code.rfind('.')
            if last_dot_idx > len(prefix): # 确保点号不在前缀里(虽然前缀通常不含点，除LOCATION ++)
                parent_code = code[:last_dot_idx + 1]
            else:
                # 没有点号，或者点号属于前缀的一部分(理论上body里才有分隔点)
                # 根节点 (如 =A)，无父级
                parent_code = None
        
        return AspectCode(
            full_code=code,
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
        
        for i, segment in enumerate(parsed.segments):
            current_segments.append(segment)
            
            # --- 1. Entity Node (e.g., ...A) ---
            entity_code = parsed.prefix + '.'.join(current_segments)
            
            # Calculate entity parent
            entity_parent = None
            if i > 0:
                # Parent is the container of previous segment (...prev.)
                entity_parent = parsed.prefix + '.'.join(current_segments[:-1]) + '.'
            
            entity_level = (i + 1) * 2 - 1
            
            results.append(AspectCode(
                full_code=entity_code,
                prefix=parsed.prefix,
                aspect_type=parsed.aspect_type,
                hierarchy_level=entity_level,
                parent_code=entity_parent,
                segments=current_segments.copy()
            ))
            
            # --- 2. Container Node (e.g., ...A.) ---
            # We add a container node if:
            # - It's NOT the last segment (intermediate container always exists)
            # - OR it IS the last segment AND the original code had a trailing dot
            if i < len(parsed.segments) - 1 or code.endswith('.'):
                container_code = entity_code + '.'
                container_level = (i + 1) * 2
                
                results.append(AspectCode(
                    full_code=container_code,
                    prefix=parsed.prefix,
                    aspect_type=parsed.aspect_type,
                    hierarchy_level=container_level,
                    parent_code=entity_code,
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
