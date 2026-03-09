import { test, expect } from '@playwright/test';

test('homepage has title and renders AppViewer', async ({ page }) => {
    // 访问根目录
    await page.goto('/');

    // 期望页面标题包含 TwinSight
    await expect(page).toHaveTitle(/TwinSight/i);

    // 期望页面加载渲染了主要的 App 容器 或者 Header 等元素
    // 根据 TwinSight 的实际情况定，这里假设有个主要内容的容器元素
    const appContainer = page.locator('#app');
    await expect(appContainer).toBeVisible();
});
