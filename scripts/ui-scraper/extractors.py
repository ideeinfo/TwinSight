"""
extractors.py - UI 元素元数据提取模块

负责从 Playwright Page 对象中提取目标 UI 元素的元数据，
包括标签名、文本、坐标、尺寸和关键样式等。
"""

from __future__ import annotations

import logging
from typing import Any, Optional, Union, List, Dict

from playwright.async_api import Page, Frame, ElementHandle

logger = logging.getLogger(__name__)

# 目标元素的 CSS 选择器
SELECTORS = {
    "inputs": [
        "input",
        "textarea",
        '[role="textbox"]',
        '[contenteditable="true"]',
    ],
    "buttons": [
        "button",
        '[role="button"]',
        'a.btn',
        'a.button',
        '[type="submit"]',
        '[type="reset"]',
    ],
    "selects": [
        "select",
        '[role="listbox"]',
        '[role="combobox"]',
        '[role="dropdown"]',
        ".dropdown",
    ],
    "tables": [
        "table",
        '[role="grid"]',
        '[role="table"]',
    ],
    "modals": [
        '[role="dialog"]',
        '[role="alertdialog"]',
        ".modal",
        ".dialog",
        "[data-modal]",
    ],
}


async def is_element_visible(element: ElementHandle) -> bool:
    """
    判断元素是否可见。

    使用 Playwright 的 is_visible() 方法 + computed style 双重检查。
    """
    try:
        visible = await element.is_visible()
        if not visible:
            return False

        # 额外检查 computed style 中的 display/visibility/opacity
        hidden = await element.evaluate("""
            (el) => {
                const style = window.getComputedStyle(el);
                return style.display === 'none'
                    || style.visibility === 'hidden'
                    || style.opacity === '0'
                    || el.offsetWidth === 0
                    || el.offsetHeight === 0;
            }
        """)
        return not hidden
    except Exception:
        return False


async def extract_element_metadata(page_or_frame: Page | Frame, element: ElementHandle) -> dict[str, Any] | None:
    """
    提取单个元素的元数据。

    返回:
        {
            "tagName": "INPUT",
            "type": "text",
            "innerText": "",
            "value": "",
            "placeholder": "Search...",
            "id": "search-input",
            "name": "q",
            "className": "search-field",
            "role": "textbox",
            "ariaLabel": "搜索",
            "boundingBox": {"x": 120, "y": 80, "width": 300, "height": 40},
            "styles": {
                "backgroundColor": "rgb(255, 255, 255)",
                "fontSize": "14px",
                "border": "1px solid rgb(204, 204, 204)"
            }
        }
    """
    try:
        if not await is_element_visible(element):
            return None

        # 提取基本属性
        metadata = await element.evaluate("""
            (el) => {
                const style = window.getComputedStyle(el);
                return {
                    tagName: el.tagName,
                    type: el.type || '',
                    innerText: (el.innerText || '').substring(0, 500),
                    value: (el.value || '').substring(0, 500),
                    placeholder: el.placeholder || '',
                    id: el.id || '',
                    name: el.name || '',
                    className: el.className || '',
                    role: el.getAttribute('role') || '',
                    ariaLabel: el.getAttribute('aria-label') || '',
                    dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '',
                    href: el.href || '',
                    disabled: el.disabled || false,
                    readOnly: el.readOnly || false,
                    styles: {
                        backgroundColor: style.backgroundColor,
                        fontSize: style.fontSize,
                        border: style.border,
                        color: style.color,
                        fontFamily: style.fontFamily,
                        fontWeight: style.fontWeight,
                        padding: style.padding,
                        margin: style.margin,
                        borderRadius: style.borderRadius,
                        boxShadow: style.boxShadow,
                        position: style.position,
                        display: style.display,
                        zIndex: style.zIndex,
                    }
                };
            }
        """)

        # 提取 boundingBox（绝对坐标和尺寸）
        bbox = await element.bounding_box()
        if bbox:
            metadata["boundingBox"] = {
                "x": round(bbox["x"], 2),
                "y": round(bbox["y"], 2),
                "width": round(bbox["width"], 2),
                "height": round(bbox["height"], 2),
            }
        else:
            metadata["boundingBox"] = None

        # 如果 className 是 SVGAnimatedString 或其他对象，转为字符串
        if not isinstance(metadata.get("className"), str):
            metadata["className"] = str(metadata.get("className", ""))

        return metadata

    except Exception as e:
        logger.debug(f"提取元素元数据失败: {e}")
        return None


async def extract_table_metadata(page_or_frame: Page | Frame, element: ElementHandle) -> dict[str, Any] | None:
    """
    提取表格的增强元数据，包括行列数和表头内容。
    """
    base = await extract_element_metadata(page_or_frame, element)
    if not base:
        return None

    try:
        table_info = await element.evaluate("""
            (table) => {
                const headers = [];
                const ths = table.querySelectorAll('thead th, thead td, tr:first-child th');
                ths.forEach(th => headers.push(th.innerText.trim()));

                return {
                    rowCount: table.querySelectorAll('tbody tr, tr').length,
                    colCount: headers.length || (table.querySelector('tr') ? table.querySelector('tr').children.length : 0),
                    headers: headers.slice(0, 50),
                    caption: table.querySelector('caption') ? table.querySelector('caption').innerText.trim() : '',
                };
            }
        """)
        base["tableInfo"] = table_info
    except Exception as e:
        logger.debug(f"提取表格增强信息失败: {e}")

    return base


async def extract_page_elements(page_or_frame: Page | Frame) -> dict[str, list]:
    """
    批量提取页面中的 5 类目标元素。

    返回:
        {
            "inputs": [...],
            "buttons": [...],
            "selects": [...],
            "tables": [...],
            "modals": [...]
        }
    """
    result: dict[str, list] = {
        "inputs": [],
        "buttons": [],
        "selects": [],
        "tables": [],
        "modals": [],
    }

    seen_elements: set[str] = set()  # 通过 outerHTML hash 去重

    for category, selectors in SELECTORS.items():
        for selector in selectors:
            try:
                elements = await page_or_frame.query_selector_all(selector)
                for element in elements:
                    try:
                        # 使用元素的唯一标识去重
                        elem_id = await element.evaluate("""
                            (el) => {
                                const id = el.id || '';
                                const tag = el.tagName || '';
                                const name = el.name || '';
                                const cls = (typeof el.className === 'string' ? el.className : '') || '';
                                const type = el.type || '';
                                const text = (el.innerText || '').substring(0, 50);
                                return `${tag}|${id}|${name}|${cls}|${type}|${text}`;
                            }
                        """)

                        if elem_id in seen_elements:
                            continue
                        seen_elements.add(elem_id)

                        if category == "tables":
                            metadata = await extract_table_metadata(page_or_frame, element)
                        else:
                            metadata = await extract_element_metadata(page_or_frame, element)

                        if metadata:
                            result[category].append(metadata)

                    except Exception as e:
                        logger.debug(f"处理元素失败 ({selector}): {e}")
                        continue

            except Exception as e:
                logger.debug(f"选择器查询失败 ({selector}): {e}")
                continue

    counts = {k: len(v) for k, v in result.items()}
    logger.info(f"  元素提取完成: {counts}")

    return result


async def extract_iframe_elements(page: Page) -> list[dict[str, Any]]:
    """
    递归进入 iframe 提取元素。

    返回:
        [
            {
                "src": "https://...",
                "name": "iframe-name",
                "elements": { "inputs": [...], ... }
            }
        ]
    """
    iframe_results = []

    try:
        frames = page.frames
        # 跳过主 frame（index 0）
        for frame in frames[1:]:
            try:
                frame_url = frame.url
                frame_name = frame.name or ""

                # 跳过空白 iframe 和特殊协议
                if not frame_url or frame_url in ("about:blank", "about:srcdoc"):
                    continue
                if frame_url.startswith("javascript:"):
                    continue

                logger.info(f"  进入 iframe: {frame_name} ({frame_url[:80]})")

                # 等待 iframe 加载
                try:
                    await frame.wait_for_load_state("domcontentloaded", timeout=10000)
                except Exception:
                    logger.debug(f"  iframe 加载超时: {frame_url[:80]}")

                elements = await extract_page_elements(frame)

                total = sum(len(v) for v in elements.values())
                if total > 0:
                    iframe_results.append({
                        "src": frame_url,
                        "name": frame_name,
                        "elements": elements,
                    })

            except Exception as e:
                logger.debug(f"  处理 iframe 失败: {e}")
                continue

    except Exception as e:
        logger.debug(f"获取 iframe 列表失败: {e}")

    if iframe_results:
        logger.info(f"  共提取 {len(iframe_results)} 个 iframe 的元素")

    return iframe_results


async def discover_navigation_links(page: Page, base_domain: str) -> list[str]:
    """
    发现页面上的导航链接。

    策略:
    - 抓取 <a href> 标签
    - 检测侧边栏菜单项 (nav a, [role="menuitem"])
    - 过滤同域名链接
    - 忽略静态资源、锚点、外部链接
    """
    ignored_extensions = {
        ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg",
        ".ico", ".woff", ".woff2", ".ttf", ".eot", ".pdf",
        ".zip", ".tar", ".gz", ".mp4", ".mp3",
    }

    try:
        links = await page.evaluate("""
            (baseDomain) => {
                const anchors = document.querySelectorAll('a[href], nav a, [role="menuitem"] a, [role="menuitem"][href]');
                const urls = new Set();

                anchors.forEach(a => {
                    let href = a.href || a.getAttribute('href') || '';

                    // 跳过非 URL
                    if (!href
                        || href.startsWith('javascript:')
                        || href.startsWith('mailto:')
                        || href.startsWith('tel:')
                        || href === '#'
                        || href.startsWith('#')) {
                        return;
                    }

                    try {
                        const url = new URL(href, window.location.origin);
                        // 只保留同域名链接
                        if (url.hostname === baseDomain || url.hostname.endsWith('.' + baseDomain)) {
                            // 去掉 hash 部分
                            url.hash = '';
                            urls.add(url.href);
                        }
                    } catch (e) {
                        // 忽略无效 URL
                    }
                });

                return Array.from(urls);
            }
        """, base_domain)

        # 服务端过滤
        filtered = []
        for url in links:
            # 检查文件扩展名
            lower_url = url.lower()
            skip = False
            for ext in ignored_extensions:
                if lower_url.endswith(ext):
                    skip = True
                    break

            if not skip:
                filtered.append(url)

        logger.info(f"  发现 {len(filtered)} 个导航链接")
        return filtered

    except Exception as e:
        logger.debug(f"发现导航链接失败: {e}")
        return []


# ============================================================
# 动态元素提取（供 interactive_scraper 调用）
# ============================================================


async def extract_modal_elements(
    page_or_frame: Page | Frame, dialog: ElementHandle
) -> dict[str, Any]:
    """
    提取弹窗/对话框内部的结构化元数据。

    返回:
        {
            "title": "Add Parameter",
            "fields": [
                {
                    "label": "Name",
                    "required": true,
                    "type": "text",
                    "placeholder": "Enter name",
                    "value": "",
                },
                ...
            ],
            "buttons": [
                {"text": "Cancel", "type": "secondary"},
                {"text": "OK", "type": "primary"},
            ],
            "rawElements": { "inputs": [...], "buttons": [...], ... }
        }
    """
    result: dict[str, Any] = {
        "title": "",
        "fields": [],
        "buttons": [],
        "rawElements": {},
    }

    try:
        # ---- 提取标题 ----
        title_selectors = [
            "h1", "h2", "h3", "h4",
            "[class*='title']", "[class*='header']",
            "[class*='Title']", "[class*='Header']",
        ]
        for sel in title_selectors:
            try:
                title_el = await dialog.query_selector(sel)
                if title_el:
                    text = (await title_el.inner_text()).strip()
                    if text:
                        result["title"] = text
                        break
            except Exception:
                continue

        # ---- 提取表单字段（label + input 对） ----
        result["fields"] = await dialog.evaluate("""
            (dlg) => {
                const fields = [];

                // 方式 1: 查找 label + 关联 input
                const labels = dlg.querySelectorAll('label');
                labels.forEach(label => {
                    const forId = label.getAttribute('for');
                    let input = null;
                    if (forId) {
                        input = dlg.querySelector('#' + CSS.escape(forId));
                    }
                    if (!input) {
                        // 查找同级或后续兄弟中的 input
                        const parent = label.parentElement;
                        if (parent) {
                            input = parent.querySelector('input, textarea, select, [role="combobox"], [role="listbox"]');
                        }
                    }

                    const labelText = label.innerText.trim();
                    const required = labelText.includes('*')
                        || (input && input.hasAttribute('required'))
                        || (input && input.getAttribute('aria-required') === 'true');

                    fields.push({
                        label: labelText.replace('*', '').trim(),
                        required: required,
                        type: input ? (input.type || input.tagName.toLowerCase()) : 'unknown',
                        placeholder: input ? (input.placeholder || input.getAttribute('aria-placeholder') || '') : '',
                        value: input ? (input.value || '') : '',
                        tagName: input ? input.tagName : '',
                        role: input ? (input.getAttribute('role') || '') : '',
                    });
                });

                // 方式 2: 查找没有 label 的独立 input（补充）
                const allInputs = dlg.querySelectorAll('input, textarea, select, [role="combobox"]');
                const labeledIds = new Set();
                labels.forEach(l => {
                    const fid = l.getAttribute('for');
                    if (fid) labeledIds.add(fid);
                });

                allInputs.forEach(input => {
                    if (input.id && labeledIds.has(input.id)) return;
                    // 检查是否已被方式 1 处理
                    const alreadyCovered = fields.some(f =>
                        f.placeholder === (input.placeholder || '') && f.type === (input.type || input.tagName.toLowerCase())
                    );
                    if (alreadyCovered) return;

                    const ariaLabel = input.getAttribute('aria-label') || '';
                    const name = input.getAttribute('name') || '';
                    fields.push({
                        label: ariaLabel || name || '',
                        required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
                        type: input.type || input.tagName.toLowerCase(),
                        placeholder: input.placeholder || input.getAttribute('aria-placeholder') || '',
                        value: input.value || '',
                        tagName: input.tagName,
                        role: input.getAttribute('role') || '',
                    });
                });

                return fields;
            }
        """)

        # ---- 提取按钮 ----
        result["buttons"] = await dialog.evaluate("""
            (dlg) => {
                const buttons = [];
                const btnEls = dlg.querySelectorAll('button, [role="button"], input[type="submit"]');
                btnEls.forEach(btn => {
                    const text = (btn.innerText || btn.value || '').trim();
                    if (!text) return;

                    const style = window.getComputedStyle(btn);
                    const bgColor = style.backgroundColor;

                    // 简单判断主次按钮
                    let btnType = 'secondary';
                    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                        btnType = 'primary';
                    }
                    if (text.toLowerCase() === 'cancel' || text.toLowerCase() === 'close') {
                        btnType = 'secondary';
                    }

                    buttons.push({
                        text: text,
                        type: btnType,
                        disabled: btn.disabled || false,
                        className: typeof btn.className === 'string' ? btn.className : '',
                    });
                });
                return buttons;
            }
        """)

        # ---- 也提取原始元素（兜底）----
        raw = await extract_page_elements(dialog)
        result["rawElements"] = raw

    except Exception as e:
        logger.warning(f"提取弹窗元素失败: {e}")

    return result


async def extract_dropdown_options(
    page_or_frame: Page | Frame, dropdown: ElementHandle
) -> list[dict[str, Any]]:
    """
    提取展开后的下拉选项列表。

    同时检查 <option> 元素和 ARIA role="option" 元素。

    返回:
        [
            {"text": "Option 1", "value": "opt1", "selected": false},
            ...
        ]
    """
    options: list[dict[str, Any]] = []

    try:
        # 方式 1: 原生 <select> 的 <option>
        tag = await dropdown.evaluate("el => el.tagName")
        if tag and tag.upper() == "SELECT":
            options = await dropdown.evaluate("""
                (sel) => {
                    return Array.from(sel.options).map(opt => ({
                        text: opt.text.trim(),
                        value: opt.value,
                        selected: opt.selected,
                    }));
                }
            """)
            return options

        # 方式 2: ARIA listbox / combobox → 查找 role="option"
        option_selectors = [
            '[role="option"]',
            ".dropdown-item",
            ".select-option",
            "li",
        ]
        for sel in option_selectors:
            try:
                elems = await page_or_frame.query_selector_all(sel)
                for el in elems:
                    try:
                        visible = await el.is_visible()
                        if not visible:
                            continue
                        text = (await el.inner_text()).strip()
                        value = await el.get_attribute("data-value") or await el.get_attribute("value") or ""
                        selected = (await el.get_attribute("aria-selected")) == "true"
                        if text:
                            options.append({
                                "text": text,
                                "value": value,
                                "selected": selected,
                            })
                    except Exception:
                        continue
            except Exception:
                continue

            if options:
                break  # 找到选项就停止

    except Exception as e:
        logger.debug(f"提取下拉选项失败: {e}")

    return options
