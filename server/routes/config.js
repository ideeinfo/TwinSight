/**
 * 系统配置 API 路由
 */

import express from 'express';
import { getConfig, setConfig, getAllConfigs, clearConfigCache } from '../services/config-service.js';

const router = express.Router();

/**
 * GET /api/config
 * 获取所有配置（敏感值会被隐藏）
 */
router.get('/', async (req, res) => {
    try {
        const configs = await getAllConfigs();
        res.json({ success: true, data: configs });
    } catch (error) {
        console.error('获取配置失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/config/:key
 * 获取指定配置
 */
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const value = await getConfig(key);

        // 对于敏感配置，只返回是否已设置
        if (key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD')) {
            res.json({
                success: true,
                data: {
                    key,
                    isSet: !!value,
                    value: value ? '******' : ''
                }
            });
        } else {
            res.json({ success: true, data: { key, value } });
        }
    } catch (error) {
        console.error('获取配置失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/config/:key
 * 设置配置值
 * Body: { value: string, description?: string }
 */
router.post('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;

        if (value === undefined) {
            return res.status(400).json({ success: false, error: 'value is required' });
        }

        const success = await setConfig(key, value, description);

        if (success) {
            res.json({ success: true, message: `配置 ${key} 已更新` });
        } else {
            res.status(500).json({ success: false, error: '保存配置失败' });
        }
    } catch (error) {
        console.error('设置配置失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/config/cache/clear
 * 清除配置缓存
 */
router.post('/cache/clear', (req, res) => {
    clearConfigCache();
    res.json({ success: true, message: '配置缓存已清除' });
});

export default router;
