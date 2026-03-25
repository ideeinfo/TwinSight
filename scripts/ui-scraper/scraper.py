"""
scraper.py - Autodesk Tandem UI 元素抓取主脚本

使用 Playwright (async) 递归遍历 Autodesk Tandem 系统页面，
提取 UI 元素元数据并保存为 JSON 文件。

使用方法:
    python scraper.py [--url URL] [--output-dir DIR] [--max-pages N] [--headless]

示例:
    python scraper.py
    python scraper.py --url https://tandem.autodesk.com/pages/manage/parameters
    python scraper.py --max-pages 10 --output-dir ./output
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, Page, Browser

# 将脚本目录加入 path 以支持相对 import
sys.path.insert(0, str(Path(__file__).parent))

from extractors import (
    extract_page_elements,
    extract_iframe_elements,
    discover_navigation_links,
)
from interactive_scraper import process_interactive

# ============================================================
# 配置
# ============================================================

DEFAULT_ENTRY_URL = "https://tandem.autodesk.com/pages/manage"
DEFAULT_OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "UI",
)
DEFAULT_MAX_PAGES = 50
NAVIGATION_TIMEOUT = 60000  # 毫秒
NETWORK_IDLE_TIMEOUT = 30000  # 毫秒

# 时区：东八区
CST = timezone(timedelta(hours=8))

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ============================================================
# 核心爬取逻辑
# ============================================================


def url_to_slug(url: str) -> str:
    """将 URL 转换为文件名安全的 slug。"""
    parsed = urlparse(url)
    path = parsed.path.strip("/").replace("/", "_") or "index"
    # 移除非法文件名字符
    slug = re.sub(r"[^a-zA-Z0-9_\-]", "_", path)
    # 合并连续下划线
    slug = re.sub(r"_+", "_", slug).strip("_")
    return slug[:80]  # 限制长度


def normalize_url(url: str) -> str:
    """标准化 URL 用于去重比较。"""
    parsed = urlparse(url)
    # 去掉 fragment 和 trailing slash
    normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


async def wait_for_page_ready(page: Page):
    """等待页面完全加载。"""
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=NAVIGATION_TIMEOUT)
    except Exception:
        logger.debug("  domcontentloaded 超时")

    try:
        await page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_TIMEOUT)
    except Exception:
        logger.debug("  networkidle 超时，继续处理")

    # 额外等待 2 秒，让 SPA 渲染完成
    await asyncio.sleep(2)


async def save_page_data(
    data: dict, output_dir: str, url: str, timestamp: str
) -> str:
    """将页面数据保存为 JSON 文件。"""
    slug = url_to_slug(url)
    ts_short = timestamp.replace(":", "").replace("-", "").replace("T", "_")[:15]
    filename = f"page_structure_{slug}_{ts_short}.json"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    logger.info(f"  ✅ 已保存: {filename}")
    return filepath


async def scrape_page(
    page: Page, url: str, output_dir: str,
    interactive: bool = False, screenshot_dir: str = ""
) -> dict | None:
    """
    抓取单个页面的 UI 元素元数据。

    返回抓取到的页面数据字典，失败返回 None。
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"📄 抓取页面: {url}")
    logger.info(f"{'='*60}")

    try:
        # 导航到目标页面
        response = await page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT)
        if response and response.status >= 400:
            logger.warning(f"  ⚠️ HTTP {response.status} - 跳过此页面")
            return None

        # 等待页面就绪
        await wait_for_page_ready(page)

        # 获取页面标题
        title = await page.title()
        logger.info(f"  标题: {title}")

        # 获取当前时间戳
        now = datetime.now(CST)
        timestamp = now.isoformat()

        # 提取主页面元素
        logger.info("  提取主页面元素...")
        elements = await extract_page_elements(page)

        # 提取 iframe 元素
        logger.info("  检测 iframe...")
        iframes = await extract_iframe_elements(page)

        # 统计
        total_main = sum(len(v) for v in elements.values())
        total_iframe = sum(
            sum(len(v) for v in ifr["elements"].values())
            for ifr in iframes
        )
        logger.info(f"  📊 主页面元素: {total_main}, iframe 元素: {total_iframe}")

        # ---- 动态交互抓取（可选） ----
        dynamic_elements = {}
        if interactive:
            logger.info("  🔄 开始动态交互抓取...")
            sc_dir = screenshot_dir or os.path.join(output_dir, "screenshots")
            try:
                dynamic_elements = await process_interactive(page, sc_dir)
            except Exception as e:
                logger.error(f"  动态抓取异常: {e}")
                dynamic_elements = {}

        # 构建输出数据
        page_data = {
            "url": url,
            "title": title,
            "timestamp": timestamp,
            "viewport": {
                "width": page.viewport_size["width"] if page.viewport_size else 1920,
                "height": page.viewport_size["height"] if page.viewport_size else 1080,
            },
            "elements": elements,
            "dynamicElements": dynamic_elements,
            "iframes": iframes,
            "summary": {
                "totalMainElements": total_main,
                "totalIframeElements": total_iframe,
                "totalDynamicElements": sum(len(v) for v in dynamic_elements.values()) if dynamic_elements else 0,
                "breakdown": {k: len(v) for k, v in elements.items()},
            },
        }

        # 保存
        await save_page_data(page_data, output_dir, url, timestamp)

        return page_data

    except Exception as e:
        logger.error(f"  ❌ 抓取失败: {e}")
        return None


async def crawl(
    page: Page,
    entry_url: str,
    output_dir: str,
    max_pages: int,
    base_domain: str,
    interactive: bool = False,
    screenshot_dir: str = "",
):
    """
    递归遍历页面并抓取 UI 元素。

    使用 BFS（广度优先搜索）遍历策略。
    """
    visited: set[str] = set()
    queue: list[str] = [normalize_url(entry_url)]
    pages_scraped = 0

    while queue and pages_scraped < max_pages:
        url = queue.pop(0)
        normalized = normalize_url(url)

        if normalized in visited:
            continue
        visited.add(normalized)

        # 抓取页面
        result = await scrape_page(page, url, output_dir, interactive, screenshot_dir)
        if result is None:
            continue

        pages_scraped += 1
        logger.info(f"\n  进度: {pages_scraped}/{max_pages} (队列中: {len(queue)})")

        # 发现新链接
        new_links = await discover_navigation_links(page, base_domain)
        for link in new_links:
            norm_link = normalize_url(link)
            if norm_link not in visited and norm_link not in [normalize_url(u) for u in queue]:
                queue.append(link)
                logger.debug(f"  + 加入队列: {link[:80]}")

    logger.info(f"\n{'='*60}")
    logger.info(f"🎉 爬取完成！共抓取 {pages_scraped} 个页面")
    logger.info(f"{'='*60}")


# ============================================================
# 主入口
# ============================================================


async def main():
    parser = argparse.ArgumentParser(
        description="Autodesk Tandem UI 元素抓取工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_ENTRY_URL,
        help=f"入口 URL (默认: {DEFAULT_ENTRY_URL})",
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"输出目录 (默认: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES,
        help=f"最大抓取页面数 (默认: {DEFAULT_MAX_PAGES})",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="使用无头模式（默认有界面，方便登录）",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="启用动态交互抓取（点击按钮触发弹窗、展开下拉等）",
    )
    parser.add_argument(
        "--screenshot-dir",
        default="",
        help="动态抓取截图保存目录（默认: 输出目录/screenshots）",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="启用 DEBUG 日志级别",
    )

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # 确保输出目录存在
    os.makedirs(args.output_dir, exist_ok=True)

    # 解析域名
    parsed = urlparse(args.url)
    base_domain = parsed.hostname or "tandem.autodesk.com"

    logger.info("🚀 Autodesk Tandem UI 元素抓取工具")
    logger.info(f"   入口 URL:   {args.url}")
    logger.info(f"   输出目录:   {args.output_dir}")
    logger.info(f"   最大页面数: {args.max_pages}")
    logger.info(f"   无头模式:   {args.headless}")
    logger.info(f"   动态抓取:   {args.interactive}")
    logger.info(f"   目标域名:   {base_domain}")

    async with async_playwright() as p:
        # 启动浏览器
        browser: Browser = await p.chromium.launch(
            headless=args.headless,
            args=[
                "--window-size=1920,1080",
                "--disable-blink-features=AutomationControlled",
            ],
        )

        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )

        page = await context.new_page()

        # ========================================
        # 步骤 1: 登录
        # ========================================
        logger.info("\n" + "=" * 60)
        logger.info("🔐 登录阶段")
        logger.info("=" * 60)

        await page.goto(args.url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT)

        print("\n" + "=" * 60)
        print("🔐 请在打开的浏览器窗口中完成登录操作。")
        print("   登录完成后，请回到终端按 Enter 键继续...")
        print("=" * 60)

        # 阻塞等待用户完成登录
        input("\n>>> 按 Enter 继续爬取 <<<\n")

        # 登录后等待页面稳定
        logger.info("  等待页面稳定...")
        await wait_for_page_ready(page)

        current_url = page.url
        logger.info(f"  当前 URL: {current_url}")

        # ========================================
        # 步骤 2: 开始递归爬取
        # ========================================
        logger.info("\n" + "=" * 60)
        logger.info("🕷️ 开始递归爬取")
        logger.info("=" * 60)

        # 使用登录后的当前 URL 作为起始点（可能被重定向）
        start_url = current_url if current_url != "about:blank" else args.url

        await crawl(
            page=page,
            entry_url=start_url,
            output_dir=args.output_dir,
            max_pages=args.max_pages,
            base_domain=base_domain,
            interactive=args.interactive,
            screenshot_dir=args.screenshot_dir,
        )

        # ========================================
        # 步骤 3: 生成汇总报告
        # ========================================
        logger.info("\n" + "=" * 60)
        logger.info("📋 生成汇总报告")
        logger.info("=" * 60)

        # 列出所有生成的 JSON 文件
        json_files = sorted(
            f for f in os.listdir(args.output_dir)
            if f.startswith("page_structure_") and f.endswith(".json")
        )

        summary = {
            "tool": "Autodesk Tandem UI Scraper",
            "entryUrl": args.url,
            "startUrl": start_url,
            "baseDomain": base_domain,
            "timestamp": datetime.now(CST).isoformat(),
            "totalPages": len(json_files),
            "outputDir": args.output_dir,
            "files": json_files,
        }

        summary_path = os.path.join(args.output_dir, "scrape_summary.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        logger.info(f"  汇总报告: {summary_path}")
        logger.info(f"  共生成 {len(json_files)} 个页面数据文件")

        # 关闭浏览器
        await browser.close()

    logger.info("\n✅ 全部完成！")


if __name__ == "__main__":
    asyncio.run(main())
