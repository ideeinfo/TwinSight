import { test, expect } from '@playwright/test';

test.describe('System Config Panel Functionality', () => {

    test.beforeEach(async ({ context, page }) => {
        // 在所有页面加载前预先注入 localstorage
        await context.addInitScript(() => {
            const mockUser = {
                id: 1,
                username: 'admin',
                email: 'admin@twinsight.xyz',
                roles: ['admin']
            };
            localStorage.setItem('user', JSON.stringify(mockUser));
            localStorage.setItem('accessToken', 'mock_admin_token_for_playwright');
        });

        // 拦截 `/api/v1/auth/me` 以模拟鉴权成功
        // 由于我们提供的是 mockToken，发送给真实的后端 `/api/v1/auth/me`（或任何系统验证接口）会报 401 从而重置 Store
        await page.route('**/api/v1/auth/me', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        id: 1,
                        name: 'admin',
                        email: 'admin@twinsight.xyz',
                        roles: ['admin'],
                        permissions: ['system:admin']
                    }
                })
            });
        });

        // 拦截 `/api/v1/system-config` 请求
        await page.route('**/api/v1/system-config', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        influxdb: [],
                        ai: []
                    }
                })
            });
        });

        // 跳转到携带系统配置入口的页面
        await page.goto('/viewer', { waitUntil: 'domcontentloaded' });

        // 强行获取 window 上的应用上下文，如果它存在，设置 pinia 状态（这里虽然难以保证一定拦截到，但尽量在挂载前设好缓存）
        await page.evaluate(() => {
            // 直接修改 localstorage，确保即使 store reload 也能读到
            const mockUser = {
                id: 1,
                username: 'admin',
                email: 'admin@twinsight.xyz',
                roles: ['admin'] // authStore.ts 中 hasPermission 判断: state.user?.roles?.includes('admin')
            };
            localStorage.setItem('user', JSON.stringify(mockUser));
            localStorage.setItem('accessToken', 'mock_admin_token_for_playwright');
        });

        // 等待整个 App 容器出现
        await expect(page.locator('.app-layout').first()).toBeVisible({ timeout: 15000 });
    });

    test('should open system config dialog and tabs render correctly without crashing', async ({ page }) => {
        // ---- 1. 打开系统配置面板 ----

        // 定位头像触发区域并点击
        const avatarTrigger = page.locator('.avatar-trigger');
        await expect(avatarTrigger).toBeVisible();
        await avatarTrigger.click();

        // 等待下拉面板出现
        const dropdownPanel = page.locator('.dropdown-panel');
        await expect(dropdownPanel).toBeVisible();

        // 定位并点击“系统配置”按钮 (通过内部文本或 Vue 代码中的字面量)
        const systemConfigBtn = page.getByRole('button', { name: '系统配置' });
        await expect(systemConfigBtn).toBeVisible();
        await systemConfigBtn.click();

        // 验证弹窗是否被正确挂载且处于可见状态
        const dialog = page.locator('.system-config-dialog');
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // 验证主要容器是否渲染
        const configContainer = page.locator('.config-container');
        await expect(configContainer).toBeVisible({ timeout: 10000 });

        // ---- 2. 验证各个 Tabs 之间切换的稳定性 ----

        // 2.1 验证默认的 InfluxDB Tab
        // InfluxDB 的 input 有特定的 name 属性
        await expect(page.locator('input[name="influx-url"]')).toBeVisible();
        await expect(page.locator('input[name="influx-token"]')).toBeVisible();

        // 2.2 切换并验证 LLM Config Tab
        const llmTabBtn = page.locator('#tab-llm');
        await llmTabBtn.click();
        await expect(llmTabBtn).toHaveClass(/is-active/);
        // LLM 有 Test 按钮（如果没有 name 属性则判断其配置容器里的 input 或特定按钮）
        await expect(page.locator('.tab-content').getByRole('button', { name: /Test|测试/i }).first()).toBeVisible();

        // 2.3 切换并验证 Knowledge Base (知识库) Tab
        const knowledgeTabBtn = page.locator('#tab-knowledge');
        await knowledgeTabBtn.click();
        await expect(knowledgeTabBtn).toHaveClass(/is-active/);
        await expect(page.locator('.tab-content').getByRole('button', { name: /Test|测试/i }).first()).toBeVisible();

        // 2.4 切换并验证 Workflow (工作流) Tab
        const workflowTabBtn = page.locator('#tab-workflow');
        await workflowTabBtn.click();
        await expect(workflowTabBtn).toHaveClass(/is-active/);
        await expect(page.locator('.tab-content').getByRole('button', { name: /Test|测试/i }).first()).toBeVisible();

        // 2.5 切换并验证 IoT Triggers (触发器) Tab
        const iotTabBtn = page.locator('#tab-iot');
        await iotTabBtn.click();
        await expect(iotTabBtn).toHaveClass(/is-active/);
        // IoT 配置组件有一个特定的 full-width 容器
        const iotContent = page.locator('.tab-content.full-width');
        await expect(iotContent).toBeVisible();

        // --- 新增：排版边界断言 ---
        // 验证左侧导航区未被右侧宽表格挤压，宽度应足量保持在 180px 附近
        // 允许有一点点亚像素级别的误差
        const headerBox = await page.locator('.config-tabs .el-tabs__header').boundingBox();
        expect(headerBox.width).toBeGreaterThanOrEqual(179);
        expect(headerBox.width).toBeLessThanOrEqual(181);

        // --- 新增：视觉截图断言 ---
        // 对整个配置弹窗进行截图对比，容差设置为 maxDiffPixelRatio: 0.05 (5% 像素差异)
        // 第一次运行会自动生成 baseline 图片
        await expect(dialog).toHaveScreenshot('iot-config-panel.png', { maxDiffPixelRatio: 0.05 });
    });
});
