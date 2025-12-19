/**
 * 时序数据路由模块 (API v1)
 * 封装 InfluxDB 查询
 */
import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import { PERMISSIONS } from '../../config/auth.js';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import config from '../../config/index.js';

const router = Router();

// InfluxDB 客户端
let influxClient = null;
let queryApi = null;

/**
 * 初始化 InfluxDB 客户端
 */
const getQueryApi = () => {
    if (!queryApi && config.influx.url && config.influx.token) {
        influxClient = new InfluxDB({
            url: config.influx.url,
            token: config.influx.token,
        });
        queryApi = influxClient.getQueryApi(config.influx.org);
    }
    return queryApi;
};

/**
 * @swagger
 * /api/v1/timeseries/query:
 *   get:
 *     summary: 查询时序数据
 *     tags: [TimeSeries]
 */
router.get('/query',
    authenticate,
    query('roomCode').notEmpty().withMessage('roomCode 不能为空'),
    query('start').isInt().toInt().withMessage('start 必须是时间戳'),
    query('end').isInt().toInt().withMessage('end 必须是时间戳'),
    query('aggregateWindow').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { roomCode, start, end, aggregateWindow } = req.query;
            const api = getQueryApi();

            if (!api) {
                throw ApiError.internal('InfluxDB 未配置');
            }

            const windowClause = aggregateWindow
                ? `|> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)`
                : '';

            const fluxQuery = `
        from(bucket: "${config.influx.bucket}")
          |> range(start: ${Math.floor(start / 1000)}, stop: ${Math.floor(end / 1000)})
          |> filter(fn: (r) => r["room"] == "${roomCode}")
          |> filter(fn: (r) => r["_field"] == "temperature")
          ${windowClause}
          |> sort(columns: ["_time"])
      `;

            const points = [];

            await new Promise((resolve, reject) => {
                api.queryRows(fluxQuery, {
                    next(row, tableMeta) {
                        const o = tableMeta.toObject(row);
                        points.push({
                            timestamp: new Date(o._time).getTime(),
                            value: o._value,
                        });
                    },
                    error(error) {
                        reject(error);
                    },
                    complete() {
                        resolve();
                    },
                });
            });

            res.json({ success: true, data: points });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/timeseries/query/batch:
 *   post:
 *     summary: 批量查询多个房间的时序数据
 *     tags: [TimeSeries]
 */
router.post('/query/batch',
    authenticate,
    body('roomCodes').isArray().withMessage('roomCodes 必须是数组'),
    body('startTime').isInt().toInt(),
    body('endTime').isInt().toInt(),
    body('aggregateWindow').optional().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { roomCodes, startTime, endTime, aggregateWindow } = req.body;
            const api = getQueryApi();

            if (!api) {
                throw ApiError.internal('InfluxDB 未配置');
            }

            const results = {};

            for (const roomCode of roomCodes) {
                const windowClause = aggregateWindow
                    ? `|> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)`
                    : '';

                const fluxQuery = `
          from(bucket: "${config.influx.bucket}")
            |> range(start: ${Math.floor(startTime / 1000)}, stop: ${Math.floor(endTime / 1000)})
            |> filter(fn: (r) => r["room"] == "${roomCode}")
            |> filter(fn: (r) => r["_field"] == "temperature")
            ${windowClause}
            |> sort(columns: ["_time"])
        `;

                const points = [];

                await new Promise((resolve, reject) => {
                    api.queryRows(fluxQuery, {
                        next(row, tableMeta) {
                            const o = tableMeta.toObject(row);
                            points.push({
                                timestamp: new Date(o._time).getTime(),
                                value: o._value,
                            });
                        },
                        error(error) {
                            reject(error);
                        },
                        complete() {
                            resolve();
                        },
                    });
                });

                results[roomCode] = points;
            }

            res.json({ success: true, data: results });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/timeseries/latest:
 *   post:
 *     summary: 获取多个房间的最新温度值
 *     tags: [TimeSeries]
 */
router.post('/latest',
    authenticate,
    body('roomCodes').isArray().withMessage('roomCodes 必须是数组'),
    validateRequest,
    async (req, res, next) => {
        try {
            const { roomCodes } = req.body;
            const api = getQueryApi();

            if (!api) {
                throw ApiError.internal('InfluxDB 未配置');
            }

            const results = [];

            for (const roomCode of roomCodes) {
                const fluxQuery = `
          from(bucket: "${config.influx.bucket}")
            |> range(start: -1h)
            |> filter(fn: (r) => r["room"] == "${roomCode}")
            |> filter(fn: (r) => r["_field"] == "temperature")
            |> last()
        `;

                let latest = null;

                await new Promise((resolve, reject) => {
                    api.queryRows(fluxQuery, {
                        next(row, tableMeta) {
                            const o = tableMeta.toObject(row);
                            latest = {
                                roomCode,
                                value: o._value,
                                timestamp: new Date(o._time).getTime(),
                            };
                        },
                        error(error) {
                            reject(error);
                        },
                        complete() {
                            resolve();
                        },
                    });
                });

                if (latest) {
                    results.push(latest);
                }
            }

            res.json({ success: true, data: results });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/timeseries/latest/{roomCode}:
 *   get:
 *     summary: 获取单个房间的最新温度值
 *     tags: [TimeSeries]
 */
router.get('/latest/:roomCode',
    authenticate,
    param('roomCode').notEmpty().trim(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { roomCode } = req.params;
            const api = getQueryApi();

            if (!api) {
                throw ApiError.internal('InfluxDB 未配置');
            }

            const fluxQuery = `
        from(bucket: "${config.influx.bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r["room"] == "${roomCode}")
          |> filter(fn: (r) => r["_field"] == "temperature")
          |> last()
      `;

            let result = null;

            await new Promise((resolve, reject) => {
                api.queryRows(fluxQuery, {
                    next(row, tableMeta) {
                        const o = tableMeta.toObject(row);
                        result = {
                            roomCode,
                            value: o._value,
                            timestamp: new Date(o._time).getTime(),
                        };
                    },
                    error(error) {
                        reject(error);
                    },
                    complete() {
                        resolve();
                    },
                });
            });

            if (!result) {
                throw ApiError.notFound('未找到该房间的温度数据');
            }

            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/timeseries/statistics:
 *   get:
 *     summary: 获取时间范围内的统计数据
 *     tags: [TimeSeries]
 */
router.get('/statistics',
    authenticate,
    query('roomCode').notEmpty().trim(),
    query('start').isInt().toInt(),
    query('end').isInt().toInt(),
    validateRequest,
    async (req, res, next) => {
        try {
            const { roomCode, start, end } = req.query;
            const api = getQueryApi();

            if (!api) {
                throw ApiError.internal('InfluxDB 未配置');
            }

            // 获取 min, max, mean, count
            const statsQuery = `
        data = from(bucket: "${config.influx.bucket}")
          |> range(start: ${Math.floor(start / 1000)}, stop: ${Math.floor(end / 1000)})
          |> filter(fn: (r) => r["room"] == "${roomCode}")
          |> filter(fn: (r) => r["_field"] == "temperature")
        
        min = data |> min() |> yield(name: "min")
        max = data |> max() |> yield(name: "max")
        mean = data |> mean() |> yield(name: "mean")
        count = data |> count() |> yield(name: "count")
      `;

            const stats = { min: null, max: null, avg: null, count: 0 };

            await new Promise((resolve, reject) => {
                api.queryRows(statsQuery, {
                    next(row, tableMeta) {
                        const o = tableMeta.toObject(row);
                        if (o.result === 'min') stats.min = o._value;
                        if (o.result === 'max') stats.max = o._value;
                        if (o.result === 'mean') stats.avg = o._value;
                        if (o.result === 'count') stats.count = o._value;
                    },
                    error(error) {
                        reject(error);
                    },
                    complete() {
                        resolve();
                    },
                });
            });

            res.json({ success: true, data: stats });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
