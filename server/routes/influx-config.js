/**
 * InfluxDB 配置 API 路由
 * 兼容旧的按模型接口，但实际统一读写全局 system_config。
 */
import express from 'express';
import { testInfluxConnection } from '../models/influx-config.js';
import { getConfigRaw, setConfig } from '../services/config-service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/auth.js';

const router = express.Router();

async function getGlobalInfluxConfigPayload(fileId = null) {
    const [
        influxUrl,
        influxPort,
        influxOrg,
        influxBucket,
        influxToken,
        enabled
    ] = await Promise.all([
        getConfigRaw('INFLUXDB_URL'),
        getConfigRaw('INFLUXDB_PORT'),
        getConfigRaw('INFLUXDB_ORG'),
        getConfigRaw('INFLUXDB_BUCKET'),
        getConfigRaw('INFLUXDB_TOKEN'),
        getConfigRaw('INFLUXDB_ENABLED')
    ]);

    const hasConfig = !!(influxUrl || influxOrg || influxBucket || influxToken);
    if (!hasConfig) {
        return null;
    }

    return {
        id: null,
        file_id: fileId,
        influx_url: influxUrl || '',
        influx_port: parseInt(influxPort || '8086', 10),
        influx_org: influxOrg || '',
        influx_bucket: influxBucket || '',
        influx_token: influxToken || '',
        influx_user: null,
        influx_password: null,
        use_basic_auth: false,
        is_enabled: enabled == null ? true : enabled === 'true',
        has_password: false,
        has_token: !!influxToken
    };
}

/**
 * 获取 InfluxDB 配置
 * 兼容旧接口：fileId 参数被忽略，统一返回全局配置。
 * GET /api/influx-config/:fileId
 */
router.get('/:fileId', authenticate, authorize(PERMISSIONS.INFLUX_READ), async (req, res) => {
    try {
        const { fileId } = req.params;
        const config = await getGlobalInfluxConfigPayload(Number(fileId));

        if (config) {
            res.json({
                success: true,
                data: config
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
 * 保存 InfluxDB 配置
 * 兼容旧接口：fileId 参数被忽略，统一保存到全局 system_config。
 * POST /api/influx-config/:fileId
 */
router.post('/:fileId', authenticate, authorize(PERMISSIONS.INFLUX_MANAGE), async (req, res) => {
    try {
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

        if (config.useBasicAuth) {
            return res.status(400).json({
                success: false,
                error: '当前收敛方案仅支持全局 Token 认证，请在系统设置中配置 Token。'
            });
        }

        let influxToken = config.influxToken;
        if (influxToken === '******' || influxToken == null) {
            influxToken = await getConfigRaw('INFLUXDB_TOKEN');
        }

        const updates = [
            { key: 'INFLUXDB_URL', value: config.influxUrl },
            { key: 'INFLUXDB_PORT', value: String(config.influxPort || 8086) },
            { key: 'INFLUXDB_ORG', value: config.influxOrg },
            { key: 'INFLUXDB_BUCKET', value: config.influxBucket },
            { key: 'INFLUXDB_ENABLED', value: String(config.isEnabled !== false) }
        ];

        if (influxToken) {
            updates.push({ key: 'INFLUXDB_TOKEN', value: influxToken });
        }

        const results = await Promise.all(
            updates.map(({ key, value }) => setConfig(key, value))
        );

        if (results.some(result => !result)) {
            throw new Error('更新全局 InfluxDB 配置失败');
        }

        const result = await getGlobalInfluxConfigPayload(null);

        res.json({
            success: true,
            data: result
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
 * 删除 InfluxDB 配置
 * 当前全局模式下不再支持按模型删除。
 * DELETE /api/influx-config/:fileId
 */
router.delete('/:fileId', authenticate, authorize(PERMISSIONS.INFLUX_MANAGE), async (req, res) => {
    res.status(410).json({
        success: false,
        error: '按模型删除 InfluxDB 配置已弃用，请改用系统设置管理全局 InfluxDB 配置。'
    });
});

/**
 * 测试 InfluxDB 连接
 * POST /api/influx-config/test
 */
router.post('/test/connection', authenticate, authorize(PERMISSIONS.INFLUX_MANAGE), async (req, res) => {
    try {
        const config = req.body;

        if (config.useBasicAuth) {
            return res.status(400).json({
                success: false,
                error: '当前收敛方案仅支持全局 Token 认证，请在系统设置中配置 Token。'
            });
        }

        if (config.influxToken === '******' || !config.influxToken) {
            config.influxToken = await getConfigRaw('INFLUXDB_TOKEN');
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
