"""
interactive_scraper.py - 动态 UI 抓取模块

在静态抓取完成后，自动发现可交互元素 → 点击触发 → 等待 DOM 变化
→ 抓取新出现的元素 → 恢复原状 → 截图存档。

核心策略：
  - 按钮发现：黑名单机制，点击所有可见按钮，排除危险操作
  - 弹窗检测：MutationObserver DOM 变化检测，兼容 Grommet/StyledLayer 等框架
  - 列表行点击：检测表格/列表条目点击后的弹窗或页面跳转

仅在用户显式开启 --interactive 参数时调用。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

from playwright.async_api import Page, ElementHandle

from extractors import extract_modal_elements, extract_dropdown_options

logger = logging.getLogger(__name__)

# ============================================================
# 加载交互配置
# ============================================================

CONFIG_PATH = Path(__file__).parent / "interaction_config.json"

# 通用弹窗容器选择器（覆盖主流 UI 框架）
DIALOG_SELECTORS = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '.modal',
    '[data-modal]',
    # Grommet UI (StyledLayer)
    '[class*="StyledLayer"]',
    '[class*="Layer__StyledContainer"]',
    # Material UI
    '[class*="MuiDialog"]',
    '[class*="MuiModal"]',
    # Ant Design
    '.ant-modal',
    '.ant-drawer',
    # Element Plus
    '.el-dialog',
    '.el-drawer',
    # 通用 overlay/popup
    '[class*="overlay"][class*="modal"]',
    '[class*="Overlay"][class*="Modal"]',
]

DIALOG_SELECTOR_COMBINED = ", ".join(DIALOG_SELECTORS)

# 按钮排除选择器：导航、表头排序、列拖拽等非业务按钮
BUTTON_SKIP_SELECTORS = [
    '[role="separator"]',               # 列宽拖拽手柄
    '[data-testid="notifications-button"]',  # 通知
    '[data-testid="user-menu-button"]',      # 用户菜单
    '[aria-label="User Menu"]',
    '[aria-label="Open Drop"]',
    'nav button',                       # 导航栏按钮
]
BUTTON_SKIP_SELECTOR = ", ".join(BUTTON_SKIP_SELECTORS)


def load_config() -> dict:
    """加载交互配置文件。"""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    logger.warning(f"配置文件不存在: {CONFIG_PATH}，使用默认配置")
    return _default_config()


def _default_config() -> dict:
    return {
        "buttonBlacklist": [
            "Delete", "Remove", "Reset", "Confirm", "Submit",
            "Save", "Apply", "OK", "Yes", "No", "Publish",
            "Logout", "Sign Out", "Log Out",
        ],
        "maxModalsPerPage": 15,
        "maxRowClicks": 3,
        "modalCloseStrategies": [
            "button:has-text('Cancel')",
            "button:has-text('Close')",
            "[aria-label='Close']",
            "Escape",
        ],
        "waitAfterClick": 2000,
        "screenshotOnCapture": True,
        "clickTableRows": True,
    }


# ============================================================
# DOM 变化检测
# ============================================================


async def _inject_mutation_observer(page: Page) -> None:
    """注入 MutationObserver 以检测新增的顶级 DOM 节点。"""
    await page.evaluate("""
        () => {
            window.__preClickChildCount = document.body.children.length;
            window.__preClickChildIds = new Set(
                Array.from(document.body.children).map((el, i) => el.id || el.className || `child_${i}`)
            );
            window.__newNodes = [];
            window.__mutationObs = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            window.__newNodes.push(node);
                        }
                    }
                }
            });
            window.__mutationObs.observe(document.body, { childList: true, subtree: false });
        }
    """)


async def _get_new_overlay(page: Page) -> ElementHandle | None:
    """检测点击后新出现的弹窗/遮罩层。"""
    # 策略 1: MutationObserver 捕获的新增节点
    new_node_handle = await page.evaluate_handle("""
        () => {
            const newNodes = window.__newNodes || [];
            for (const node of newNodes) {
                if (node.nodeType !== 1) continue;
                const hasForm = node.querySelector('input, textarea, select, button, [role="combobox"]');
                const hasText = (node.innerText || '').length > 10;
                if (hasForm || hasText) return node;
            }
            if (newNodes.length > 0) return newNodes[newNodes.length - 1];
            return null;
        }
    """)
    try:
        node_type = await new_node_handle.evaluate("el => el && el.nodeType")
        if node_type == 1:
            return new_node_handle.as_element()
    except Exception:
        pass

    # 策略 2: 已知选择器
    for sel in DIALOG_SELECTORS:
        try:
            elements = await page.query_selector_all(sel)
            for el in elements:
                if await el.is_visible():
                    return el
        except Exception:
            continue

    # 策略 3: body 新增子元素
    fallback = await page.evaluate_handle("""
        () => {
            const currentCount = document.body.children.length;
            const preCount = window.__preClickChildCount || 0;
            if (currentCount > preCount) {
                const lastChild = document.body.children[currentCount - 1];
                const style = window.getComputedStyle(lastChild);
                if (style.display !== 'none' && style.visibility !== 'hidden'
                    && lastChild.offsetWidth > 50 && lastChild.offsetHeight > 50) {
                    return lastChild;
                }
            }
            return null;
        }
    """)
    try:
        ft = await fallback.evaluate("el => el && el.nodeType")
        if ft == 1:
            return fallback.as_element()
    except Exception:
        pass
    return None


async def _cleanup_mutation_observer(page: Page) -> None:
    """清理 MutationObserver。"""
    try:
        await page.evaluate("""
            () => {
                if (window.__mutationObs) {
                    window.__mutationObs.disconnect();
                    window.__mutationObs = null;
                }
                window.__newNodes = [];
                window.__preClickChildCount = 0;
                window.__preClickChildIds = null;
            }
        """)
    except Exception:
        pass


# ============================================================
# 发现可交互元素（黑名单机制）
# ============================================================


async def _is_safe_button(button: ElementHandle, config: dict) -> bool:
    """
    检查按钮是否应该被点击。

    黑名单机制：默认点击所有按钮，仅排除：
    1. 空文本 / 纯图标按钮（文本长度 < 2）
    2. 命中 buttonBlacklist 关键字
    3. 属于导航/排序/拖拽等已知非业务按钮
    4. 尺寸过小 (< 20x20)
    5. disabled 的按钮
    """
    try:
        # 检查 disabled
        is_disabled = await button.evaluate("el => el.disabled || el.getAttribute('aria-disabled') === 'true'")
        if is_disabled:
            return False

        # 检查尺寸
        box = await button.bounding_box()
        if box and (box["width"] < 20 or box["height"] < 20):
            return False

        text = (await button.inner_text()).strip()
        # 空文本或纯图标按钮跳过（aria-label 按钮也检查）
        if len(text) < 2:
            aria = await button.get_attribute("aria-label") or ""
            if not aria or aria in ("Open Drop", "User Menu", "Close"):
                return False

        # 黑名单关键字
        blacklist = config.get("buttonBlacklist", [])
        for kw in blacklist:
            if kw.lower() in text.lower():
                logger.debug(f"  ⛔ 按钮 '{text}' 命中黑名单 '{kw}'，跳过")
                return False

        # 表头排序按钮跳过（HeaderCellButton 类名）
        class_name = await button.get_attribute("class") or ""
        if "HeaderCellButton" in class_name or "Resizer" in class_name:
            return False

        return True
    except Exception:
        return False


async def _is_skip_button(page: Page, button: ElementHandle) -> bool:
    """检查按钮是否匹配排除选择器。"""
    try:
        return await page.evaluate("""
            (btn) => {
                const skipSels = %s;
                for (const sel of skipSels) {
                    if (btn.matches(sel) || btn.closest(sel)) return true;
                }
                return false;
            }
        """ % json.dumps(BUTTON_SKIP_SELECTORS), button)
    except Exception:
        return False


async def discover_interactive_elements(
    page: Page, config: dict
) -> dict[str, list[ElementHandle]]:
    """
    发现页面上所有可交互元素。

    按钮使用黑名单机制：获取所有可见按钮后排除黑名单和非业务按钮。
    新增 tableRows：获取表格 tbody 中的行或列表项。
    """
    result: dict[str, list[ElementHandle]] = {
        "buttons": [],
        "dropdowns": [],
        "datePickers": [],
        "tableRows": [],
    }

    seen_buttons: set[str] = set()

    # ---- 按钮（黑名单机制：获取所有 → 排除危险操作） ----
    for base_sel in ["button", '[role="button"]']:
        try:
            all_btns = await page.query_selector_all(base_sel)
            for btn in all_btns:
                try:
                    if not await btn.is_visible():
                        continue
                except Exception:
                    continue

                # 排除非业务按钮
                if await _is_skip_button(page, btn):
                    continue

                if not await _is_safe_button(btn, config):
                    continue

                # 去重
                try:
                    btn_text = (await btn.inner_text()).strip()
                except Exception:
                    btn_text = ""
                if not btn_text:
                    btn_text = await btn.get_attribute("aria-label") or ""
                if btn_text in seen_buttons:
                    continue
                seen_buttons.add(btn_text)
                result["buttons"].append(btn)
        except Exception as e:
            logger.debug(f"查找按钮 (选择器 {base_sel}) 失败: {e}")

    # ---- 表格行 / 列表条目 ----
    if config.get("clickTableRows", True):
        max_rows = config.get("maxRowClicks", 3)
        row_selectors = [
            "table tbody tr",
            '[role="row"]',
            '[data-testid*="row"]',
            "li[role='option']",
        ]
        seen_row_texts: set[str] = set()
        for sel in row_selectors:
            try:
                rows = await page.query_selector_all(sel)
                for row in rows:
                    if len(result["tableRows"]) >= max_rows:
                        break
                    try:
                        if not await row.is_visible():
                            continue
                        # 跳过表头行
                        tag = await row.evaluate("el => el.querySelector('th') ? 'header' : 'data'")
                        if tag == "header":
                            continue
                        # 去重
                        row_text = (await row.inner_text()).strip()[:50]
                        if row_text in seen_row_texts or len(row_text) < 3:
                            continue
                        seen_row_texts.add(row_text)
                        result["tableRows"].append(row)
                    except Exception:
                        continue
            except Exception as e:
                logger.debug(f"查找列表行 '{sel}' 失败: {e}")

    # ---- 下拉控件 ----
    dropdown_selectors = [
        "select",
        '[role="combobox"]',
        '[role="listbox"]',
        ".dropdown-trigger",
    ]
    for sel in dropdown_selectors:
        try:
            elems = await page.query_selector_all(sel)
            for el in elems:
                try:
                    if await el.is_visible():
                        result["dropdowns"].append(el)
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"查找下拉控件 '{sel}' 失败: {e}")

    # ---- 日期控件 ----
    date_selectors = [
        'input[type="date"]',
        'input[type="datetime-local"]',
        ".date-picker",
        '[data-type="date"]',
    ]
    for sel in date_selectors:
        try:
            elems = await page.query_selector_all(sel)
            for el in elems:
                try:
                    if await el.is_visible():
                        result["datePickers"].append(el)
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"查找日期控件 '{sel}' 失败: {e}")

    logger.info(
        f"  🔍 发现交互元素: "
        f"按钮={len(result['buttons'])}, "
        f"列表行={len(result['tableRows'])}, "
        f"下拉={len(result['dropdowns'])}, "
        f"日期={len(result['datePickers'])}"
    )
    return result


# ============================================================
# 弹窗关闭
# ============================================================


async def _close_any_overlay(page: Page, dialog: ElementHandle | None, config: dict) -> None:
    """尝试用多种策略关闭弹窗/遮罩层。"""
    strategies = config.get(
        "modalCloseStrategies",
        [
            "button:has-text('Cancel')",
            "button:has-text('Close')",
            "[aria-label='Close']",
            "Escape",
        ],
    )

    if dialog:
        for strat in strategies:
            if strat.lower() == "escape":
                continue
            try:
                close_btn = await dialog.query_selector(strat)
                if close_btn:
                    await close_btn.click()
                    await asyncio.sleep(1)
                    logger.info(f"  ✅ 通过 '{strat}' 关闭弹窗")
                    return
            except Exception as e:
                logger.debug(f"  关闭策略 '{strat}' 在 dialog 内失败: {e}")

    for strat in strategies:
        if strat.lower() == "escape":
            continue
        try:
            close_btn = await page.query_selector(strat)
            if close_btn and await close_btn.is_visible():
                await close_btn.click()
                await asyncio.sleep(1)
                logger.info(f"  ✅ 通过页面级 '{strat}' 关闭弹窗")
                return
        except Exception as e:
            logger.debug(f"  页面级关闭策略 '{strat}' 失败: {e}")

    try:
        await page.keyboard.press("Escape")
        await asyncio.sleep(1)
        logger.info("  ✅ 通过 Escape 关闭弹窗")
        return
    except Exception:
        pass

    logger.warning("  ⚠️ 所有关闭策略失败，尝试点击页面左上角")
    try:
        await page.mouse.click(5, 5)
        await asyncio.sleep(1)
    except Exception:
        pass


async def _ensure_overlay_closed(page: Page) -> None:
    """确保在操作后没有遮罩层阻挡页面。"""
    try:
        overlay_visible = await page.evaluate("""
            () => {
                const overlays = document.querySelectorAll(
                    '[class*="StyledOverlay"], [class*="StyledLayer"], [class*="overlay"], .modal-backdrop'
                );
                for (const o of overlays) {
                    const style = window.getComputedStyle(o);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && o.offsetWidth > 0) {
                        return true;
                    }
                }
                return false;
            }
        """)

        if overlay_visible:
            logger.info("  🧹 检测到残留遮罩层，尝试清除...")
            await page.keyboard.press("Escape")
            await asyncio.sleep(1)

            still_visible = await page.evaluate("""
                () => {
                    const overlays = document.querySelectorAll(
                        '[class*="StyledOverlay"], [class*="StyledLayer"], [class*="overlay"], .modal-backdrop'
                    );
                    for (const o of overlays) {
                        const style = window.getComputedStyle(o);
                        if (style.display !== 'none' && style.visibility !== 'hidden' && o.offsetWidth > 0) return true;
                    }
                    return false;
                }
            """)

            if still_visible:
                logger.warning("  ⚠️ Escape 未关闭遮罩层，尝试强制移除")
                await page.evaluate("""
                    () => {
                        const overlays = document.querySelectorAll(
                            '[class*="StyledOverlay"], [class*="StyledLayer"]'
                        );
                        overlays.forEach(o => {
                            let parent = o;
                            while (parent.parentElement && parent.parentElement !== document.body) {
                                parent = parent.parentElement;
                            }
                            if (parent.parentElement === document.body) parent.remove();
                        });
                    }
                """)
                await asyncio.sleep(0.5)
    except Exception as e:
        logger.debug(f"  遮罩层清除异常: {e}")


# ============================================================
# 对话框捕获（MutationObserver）
# ============================================================


async def click_and_capture_modal(
    page: Page,
    button: ElementHandle,
    screenshot_dir: str,
    config: dict,
) -> dict[str, Any] | None:
    """点击按钮触发弹窗 → MutationObserver 检测 → 抓取 → 截图 → 关闭。"""
    btn_text = ""
    try:
        btn_text = (await button.inner_text()).strip()
    except Exception:
        try:
            btn_text = await button.get_attribute("aria-label") or "unknown"
        except Exception:
            btn_text = "unknown"

    logger.info(f"  🖱️ 点击按钮: '{btn_text}'")

    await _inject_mutation_observer(page)

    try:
        await button.click(timeout=10000)
    except Exception as e:
        logger.warning(f"  点击按钮 '{btn_text}' 失败: {e}")
        await _cleanup_mutation_observer(page)
        await _ensure_overlay_closed(page)
        return None

    wait_ms = config.get("waitAfterClick", 2000)
    await asyncio.sleep(wait_ms / 1000)

    dialog = await _get_new_overlay(page)

    if not dialog:
        logger.warning(f"  ⚠️ 未检测到弹窗（按钮: '{btn_text}'）")
        await _cleanup_mutation_observer(page)
        await _ensure_overlay_closed(page)
        return None

    try:
        dialog_class = await dialog.evaluate("el => el.className || ''")
        dialog_tag = await dialog.evaluate("el => el.tagName || ''")
        logger.info(f"  ✅ 检测到弹窗: <{dialog_tag} class='{str(dialog_class)[:80]}'>")
    except Exception:
        logger.info("  ✅ 检测到弹窗元素")

    # 查找弹窗中的内容区域
    content_dialog = dialog
    try:
        form_container = await dialog.evaluate_handle("""
            (el) => {
                const candidates = el.querySelectorAll('form, [class*="content"], [class*="Content"], [class*="body"], [class*="Body"]');
                for (const c of candidates) {
                    if (c.querySelector('input, textarea, select, button')) return c;
                }
                return el;
            }
        """)
        fc_type = await form_container.evaluate("el => el && el.nodeType")
        if fc_type == 1:
            content_dialog = form_container.as_element()
    except Exception:
        pass

    modal_data = await extract_modal_elements(page, content_dialog)

    screenshot_path = None
    if config.get("screenshotOnCapture", True):
        os.makedirs(screenshot_dir, exist_ok=True)
        ts = int(time.time() * 1000)
        safe_name = btn_text.replace(" ", "_").replace("/", "_")[:30]
        try:
            screenshot_path = os.path.join(screenshot_dir, f"modal_{safe_name}_{ts}.png")
            await dialog.screenshot(path=screenshot_path)
            logger.info(f"  📸 弹窗截图: {screenshot_path}")
        except Exception:
            try:
                screenshot_path = os.path.join(screenshot_dir, f"fullpage_{safe_name}_{ts}.png")
                await page.screenshot(path=screenshot_path)
                logger.info(f"  📸 全页截图: {screenshot_path}")
            except Exception:
                screenshot_path = None

    await _close_any_overlay(page, content_dialog, config)
    await _cleanup_mutation_observer(page)
    await _ensure_overlay_closed(page)
    await asyncio.sleep(1)

    return {
        "trigger": btn_text,
        "modal": modal_data,
        "screenshot": screenshot_path,
    }


# ============================================================
# 列表行 / 表格行点击捕获
# ============================================================


async def click_and_capture_row(
    page: Page,
    row: ElementHandle,
    screenshot_dir: str,
    config: dict,
    original_url: str,
) -> dict[str, Any] | None:
    """
    点击表格行/列表条目 → 检测弹窗或页面跳转 → 抓取。

    返回:
        {
            "trigger": "行文本摘要",
            "action": "modal" | "navigation",
            "modal": { ... } | None,
            "navigatedTo": "https://..." | None,
            "screenshot": "/path/to/screenshot.png" | None,
        }
    """
    row_text = ""
    try:
        row_text = (await row.inner_text()).strip().replace("\n", " | ")[:80]
    except Exception:
        row_text = "unknown row"

    logger.info(f"  📋 点击列表行: '{row_text}'")

    # 记录当前 URL
    pre_url = page.url

    await _inject_mutation_observer(page)

    try:
        # 点击行中的第一个单元格（避免点击到行内按钮）
        first_cell = await row.query_selector("td, [role='cell']")
        if first_cell:
            await first_cell.click(timeout=10000)
        else:
            await row.click(timeout=10000)
    except Exception as e:
        logger.warning(f"  点击行失败: {e}")
        await _cleanup_mutation_observer(page)
        await _ensure_overlay_closed(page)
        return None

    wait_ms = config.get("waitAfterClick", 2000)
    await asyncio.sleep(wait_ms / 1000)

    # 检测是否发生页面跳转
    post_url = page.url
    if post_url != pre_url:
        logger.info(f"  🔗 页面跳转: {pre_url} → {post_url}")

        # 等待新页面加载
        try:
            await page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            pass

        screenshot_path = None
        if config.get("screenshotOnCapture", True):
            os.makedirs(screenshot_dir, exist_ok=True)
            ts = int(time.time() * 1000)
            safe_name = row_text.replace(" ", "_").replace("/", "_")[:20]
            screenshot_path = os.path.join(screenshot_dir, f"nav_{safe_name}_{ts}.png")
            try:
                await page.screenshot(path=screenshot_path)
                logger.info(f"  📸 跳转页面截图: {screenshot_path}")
            except Exception:
                screenshot_path = None

        # 获取新页面的标题和基本元素
        new_title = await page.title()
        nav_data = {
            "url": post_url,
            "title": new_title,
        }

        # 返回原页面
        logger.info(f"  ↩️ 返回原页面: {pre_url}")
        try:
            await page.goto(pre_url, wait_until="networkidle", timeout=15000)
            await asyncio.sleep(2)
        except Exception as e:
            logger.warning(f"  返回失败: {e}")

        await _cleanup_mutation_observer(page)

        return {
            "trigger": row_text,
            "action": "navigation",
            "modal": None,
            "navigatedTo": nav_data,
            "screenshot": screenshot_path,
        }

    # 没有跳转 → 检测弹窗
    dialog = await _get_new_overlay(page)

    if dialog:
        logger.info("  ✅ 行点击触发了弹窗")

        content_dialog = dialog
        try:
            form_container = await dialog.evaluate_handle("""
                (el) => {
                    const candidates = el.querySelectorAll('form, [class*="content"], [class*="Content"]');
                    for (const c of candidates) {
                        if (c.querySelector('input, textarea, select, button')) return c;
                    }
                    return el;
                }
            """)
            fc_type = await form_container.evaluate("el => el && el.nodeType")
            if fc_type == 1:
                content_dialog = form_container.as_element()
        except Exception:
            pass

        modal_data = await extract_modal_elements(page, content_dialog)

        screenshot_path = None
        if config.get("screenshotOnCapture", True):
            os.makedirs(screenshot_dir, exist_ok=True)
            ts = int(time.time() * 1000)
            safe_name = row_text.replace(" ", "_").replace("/", "_")[:20]
            try:
                screenshot_path = os.path.join(screenshot_dir, f"rowmodal_{safe_name}_{ts}.png")
                await dialog.screenshot(path=screenshot_path)
            except Exception:
                try:
                    screenshot_path = os.path.join(screenshot_dir, f"rowfull_{safe_name}_{ts}.png")
                    await page.screenshot(path=screenshot_path)
                except Exception:
                    screenshot_path = None

        await _close_any_overlay(page, content_dialog, config)
        await _cleanup_mutation_observer(page)
        await _ensure_overlay_closed(page)
        await asyncio.sleep(1)

        return {
            "trigger": row_text,
            "action": "modal",
            "modal": modal_data,
            "navigatedTo": None,
            "screenshot": screenshot_path,
        }

    logger.info(f"  ℹ️ 行点击未触发弹窗或跳转")
    await _cleanup_mutation_observer(page)
    await _ensure_overlay_closed(page)
    return None


# ============================================================
# 下拉控件捕获
# ============================================================


async def expand_and_capture_dropdown(
    page: Page, dropdown: ElementHandle, config: dict
) -> dict[str, Any] | None:
    """展开下拉控件 → 抓取选项列表 → 关闭。"""
    trigger_text = ""
    try:
        trigger_text = (await dropdown.inner_text()).strip()
        if not trigger_text:
            trigger_text = await dropdown.get_attribute("aria-label") or ""
        if not trigger_text:
            trigger_text = await dropdown.get_attribute("name") or "unknown"
    except Exception:
        trigger_text = "unknown"

    logger.info(f"  📂 展开下拉: '{trigger_text}'")

    try:
        await dropdown.click(timeout=5000)
    except Exception as e:
        logger.warning(f"  点击下拉 '{trigger_text}' 失败: {e}")
        return None

    wait_ms = config.get("waitAfterClick", 2000)
    await asyncio.sleep(wait_ms / 1000)

    options = await extract_dropdown_options(page, dropdown)

    try:
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.5)
    except Exception:
        pass

    logger.info(f"  📋 获取到 {len(options)} 个选项")
    return {"trigger": trigger_text, "options": options}


# ============================================================
# 日期控件捕获
# ============================================================


async def capture_date_picker(
    page: Page, date_input: ElementHandle, config: dict
) -> dict[str, Any] | None:
    """聚焦日期输入框 → 抓取日历面板结构 → 关闭。"""
    input_name = ""
    try:
        input_name = await date_input.get_attribute("name") or ""
        if not input_name:
            input_name = await date_input.get_attribute("aria-label") or "unknown"
    except Exception:
        input_name = "unknown"

    logger.info(f"  📅 聚焦日期控件: '{input_name}'")

    try:
        await date_input.click(timeout=5000)
    except Exception as e:
        logger.warning(f"  点击日期控件 '{input_name}' 失败: {e}")
        return None

    wait_ms = config.get("waitAfterClick", 2000)
    await asyncio.sleep(wait_ms / 1000)

    panel_selectors = [
        '[role="dialog"]',
        '[class*="StyledLayer"]',
        ".date-picker-panel",
        ".calendar",
        ".datepicker",
        '[role="grid"]',
    ]

    panel_data = {}
    for sel in panel_selectors:
        try:
            panels = await page.query_selector_all(sel)
            for panel in panels:
                if await panel.is_visible():
                    inner_html = await panel.inner_html()
                    inner_text = await panel.inner_text()
                    panel_data = {
                        "selector": sel,
                        "html": inner_html[:2000],
                        "text": inner_text[:500],
                    }
                    break
            if panel_data:
                break
        except Exception:
            continue

    try:
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.5)
    except Exception:
        pass

    if not panel_data:
        logger.warning(f"  ⚠️ 未检测到日历面板（控件: '{input_name}'）")
        return None

    return {"trigger": input_name, "panel": panel_data}


# ============================================================
# 主入口
# ============================================================


async def process_interactive(
    page: Page, screenshot_dir: str
) -> dict[str, list[Any]]:
    """整体流程：发现交互元素 → 逐一触发并捕获。"""
    config = load_config()
    max_modals = config.get("maxModalsPerPage", 15)

    logger.info("\n  ┌─────────────────────────────────────┐")
    logger.info("  │    🔄 开始动态交互抓取              │")
    logger.info("  └─────────────────────────────────────┘")

    elements = await discover_interactive_elements(page, config)

    # 记录当前页面 URL（用于行点击后的返回）
    original_url = page.url

    results: dict[str, list[Any]] = {
        "modals": [],
        "dropdowns": [],
        "datePickers": [],
        "rowClicks": [],
    }

    # ---- 处理按钮（触发弹窗） ----
    for i, btn in enumerate(elements.get("buttons", [])):
        if i >= max_modals:
            logger.info(f"  达到最大弹窗数 {max_modals}，停止")
            break
        try:
            res = await click_and_capture_modal(page, btn, screenshot_dir, config)
            if res:
                results["modals"].append(res)
        except Exception as e:
            logger.warning(f"  处理按钮弹窗异常: {e}")
            await _ensure_overlay_closed(page)
            continue

    # ---- 处理列表行点击 ----
    for row in elements.get("tableRows", []):
        try:
            res = await click_and_capture_row(page, row, screenshot_dir, config, original_url)
            if res:
                results["rowClicks"].append(res)
        except Exception as e:
            logger.warning(f"  处理列表行异常: {e}")
            await _ensure_overlay_closed(page)
            continue

    # ---- 处理下拉控件 ----
    for dropdown in elements.get("dropdowns", []):
        try:
            res = await expand_and_capture_dropdown(page, dropdown, config)
            if res:
                results["dropdowns"].append(res)
        except Exception as e:
            logger.warning(f"  处理下拉控件异常: {e}")
            continue

    # ---- 处理日期控件 ----
    for dp in elements.get("datePickers", []):
        try:
            res = await capture_date_picker(page, dp, config)
            if res:
                results["datePickers"].append(res)
        except Exception as e:
            logger.warning(f"  处理日期控件异常: {e}")
            continue

    total = sum(len(v) for v in results.values())
    logger.info(f"  ✅ 动态抓取完成: 弹窗={len(results['modals'])}, "
                f"行点击={len(results['rowClicks'])}, "
                f"下拉={len(results['dropdowns'])}, "
                f"日期={len(results['datePickers'])} "
                f"(共 {total} 个)")

    return results
