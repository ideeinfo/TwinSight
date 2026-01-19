/**
 * InfluxDB 配置 API 路由
 */
import express from 'express';
import {
    getInfluxConfig,
    saveInfluxConfig,
    deleteInfluxConfig,
    testInfluxConnection
} from '../models/influx-config.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/auth.js';

const router = express.Router();

/**
 * 获取模型的 InfluxDB 配置
 * GET /api/influx-config/:fileId
 */
router.get('/:fileId', authenticate, authorize(PERMISSIONS.INFLUX_READ), async (req, res) => {
    try {
        const { fileId } = req.params;
        const config = await getInfluxConfig(fileId);

        if (config) {
            // 隐藏敏感信息（密码只返回是否有值）
            res.json({
                success: true,
                data: {
                    ...config,
                    // 前端需要查看 Token，因此不再掩盖 (依靠 INFLUX_READ 权限控制)
                    // influx_password: config.influx_password ? '******' : null,
                    // influx_token: config.influx_token ? '******' : null,
                    has_password: !!config.influx_password,
                    has_token: !!config.influx_token
                }
            });
        } else {
            res.json({
                success: true,
                data: null
            });
        }
    } catch (error) {
        console.error('获取 InfluxDB 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取配置失败: ' + error.message
        });
    }
});

/**
 * 保存模型的 InfluxDB 配置
 * POST /api/influx-config/:fileId
 */
router.post('/:fileId', authenticate, authorize(PERMISSIONS.INFLUX_MANAGE), async (req, res) => {
    try {
        const { fileId } = req.params;
        const config = req.body;

        // 验证必填字段
        if (!config.influxUrl) {
            return res.status(400).json({
                success: false,
                error: 'InfluxDB 地址不能为空'
            });
        }
        if (!config.influxOrg) {
            return res.status(400).json({
                success: false,
                error: '组织名称不能为空'
            });
        }
        if (!config.influxBucket) {
            return res.status(400).json({
                success: false,
                error: '存储桶名称不能为空'
            });
        }

        // 如果密码/token 是占位符，获取原有值
        const existing = await getInfluxConfig(fileId);
        if (config.influxPassword === '******' && existing) {
            config.influxPassword = existing.influx_password;
        }
        if (config.influxToken === '******' && existing) {
            config.influxToken = existing.influx_token;
        }

        const result = await saveInfluxConfig(fileId, config);

        res.json({
            success: true,
            data: {
                ...result,
                influx_password: result.influx_password ? '******' : null,
                influx_token: result.influx_token ? '******' : null
            }
        });
    } catch (error) {
        console.error('保存 InfluxDB 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '保存配置失败: ' + error.message
        });
    }
});

/**
 * 删除模型的 InfluxDB 配置
 * DELETE /api/influx-config/:fileId
 */
router.delete('/:fileId', authenticate, authorize(PERMISSIONS.INFLUX_MANAGE), async (req, res) => {
    try {
        const { fileId } = req.params;
        const result = await deleteInfluxConfig(fileId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('删除 InfluxDB 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '删除配置失败: ' + error.message
        });
    }
});

/**
 * 测试 InfluxDB 连接
 * POST /api/influx-config/test
 */
router.post('/test/connection', authenticate, authorize(PERMISSIONS.INFLUX_MANAGE), async (req, res) => {
    try {
        const config = req.body;

        // 如果是从已保存配置测试，需要获取原有密码/token
        if (config.fileId && (config.influxPassword === '******' || config.influxToken === '******')) {
            const existing = await getInfluxConfig(config.fileId);
            if (existing) {
                if (config.influxPassword === '******') {
                    config.influxPassword = existing.influx_password;
                }
                if (config.influxToken === '******') {
                    config.influxToken = existing.influx_token;
                }
            }
        }

        const result = await testInfluxConnection(config);

        res.json({
            success: result.success,
            data: result
        });
    } catch (error) {
        console.error('测试 InfluxDB 连接失败:', error);
        res.status(500).json({
            success: false,
            error: '测试连接失败: ' + error.message
        });
    }
});

export default router;
