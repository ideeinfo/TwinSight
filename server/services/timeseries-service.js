/**
 * Time Series Service
 * Encapsulates InfluxDB query logic
 */
import { InfluxDB } from '@influxdata/influxdb-client';
import config from '../config/index.js';
import { getConfig } from './config-service.js';

// InfluxDB Client Cache
// InfluxDB Client Cache
let influxClient = null;
let queryApi = null;

const getInfluxConfig = async () => {
    try {
        const url = await getConfig('INFLUXDB_URL', 'http://localhost');
        const port = await getConfig('INFLUXDB_PORT', '8086');
        const org = await getConfig('INFLUXDB_ORG', 'demo');
        const bucket = await getConfig('INFLUXDB_BUCKET', 'twinsight');
        const token = await getConfig('INFLUXDB_TOKEN', '');
        const enabled = await getConfig('INFLUXDB_ENABLED', 'true');

        // Safely construct URL
        let finalUrl = url;
        if (port && !url.includes(`:${port}`)) {
            finalUrl = `${url}:${port}`;
        }

        const cfg = {
            url: finalUrl,
            org,
            bucket,
            token,
            enabled: enabled === 'true'
        };

        console.log(`🔧 InfluxDB Config: URL=${cfg.url}, Org=${cfg.org}, Bucket=${cfg.bucket}, Token=${cfg.token ? 'HasToken' : 'Missing'}`);
        return cfg;
    } catch (error) {
        console.error('Failed to load InfluxDB config:', error);
        // Fallback
        return {
            url: config.influx?.url || 'http://localhost:8086',
            org: config.influx?.org || 'demo',
            bucket: config.influx?.bucket || 'twinsight',
            token: config.influx?.token || '',
            enabled: true
        };
    }
};

/**
 * Get InfluxDB Query API
 */
const getQueryApi = async () => {
    const cfg = await getInfluxConfig();

    if (!cfg.enabled || !cfg.url || !cfg.token) {
        return null;
    }
    // 如果配置变化（URL、Token 或 Org），重新创建客户端
    if (!influxClient || influxClient._url !== cfg.url || influxClient._token !== cfg.token || influxClient._org !== cfg.org) {
        influxClient = new InfluxDB({
            url: cfg.url,
            token: cfg.token,
        });
        influxClient._url = cfg.url;
        influxClient._token = cfg.token;
        influxClient._org = cfg.org;
        queryApi = influxClient.getQueryApi(cfg.org);
    }

    return { api: queryApi, bucket: cfg.bucket, org: cfg.org };
};

/**
 * Query Temperature Data Range
 * @param {string} roomCode 
 * @param {number} startMs 
 * @param {number} endMs 
 * @param {string} [aggregateWindow] e.g. '1h', '15m'
 */
/**
 * 获取最近有数据的房间列表
 * @param {number} hours - 查询过去几小时的数据，默认 24
 */
export async function getAvailableRooms(hours = 24) {
    const influx = await getQueryApi();
    if (!influx) return [];

    const fluxQuery = `
    import "influxdata/influxdb/schema"
    schema.tagValues(
        bucket: "${influx.bucket}",
        tag: "room",
        predicate: (r) => r._field == "value",
        start: -${hours}h
    )
    `;

    const rooms = [];
    await new Promise((resolve, reject) => {
        influx.api.queryRows(fluxQuery, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                if (o._value) rooms.push(o._value);
            },
            error(error) { console.error('Get rooms failed', error); resolve([]); }, // Fail gracefully
            complete() { resolve(); },
        });
    });
    return rooms;
}

/**
 * Query Temperature Data Range (Support Single or Multiple Rooms)
 * @param {string|string[]} roomCodes - Single code or array of codes
 * @param {number} startMs 
 * @param {number} endMs 
 * @param {string} [aggregateWindow]
 */
export async function queryTemperatureRange(roomCodes, startMs, endMs, aggregateWindow) {
    const influx = await getQueryApi();
    if (!influx) throw new Error('InfluxDB not configured or enabled');

    const windowClause = aggregateWindow
        ? `|> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)`
        : '';

    // Construct Room Filter
    let roomFilter = '';
    const isMulti = Array.isArray(roomCodes);

    if (isMulti && roomCodes.length > 0) {
        // Use standard OR logic for compatibility: r["room"] == "A" or r["room"] == "B"
        const orClause = roomCodes.map(c => `r["room"] == "${c}"`).join(' or ');
        roomFilter = `|> filter(fn: (r) => ${orClause})`;
    } else if (typeof roomCodes === 'string') {
        roomFilter = `|> filter(fn: (r) => r["room"] == "${roomCodes}")`;
    } else {
        // Empty array or null
        return [];
    }

    const fluxQuery = `
    from(bucket: "${influx.bucket}")
      |> range(start: ${Math.floor(startMs / 1000)}, stop: ${Math.floor(endMs / 1000)})
      ${roomFilter}
      |> filter(fn: (r) => r["_measurement"] == "room_temp")
      |> filter(fn: (r) => r["_field"] == "value")
      |> group(columns: ["room"])
      ${windowClause}
      |> sort(columns: ["_time"])
    `;

    // Result structure: { "RoomA": [points], "RoomB": [points] } if multi, or just [points] if single
    // But to keep generic, let's return a list of series: [{ name: 'RoomA', data: [...] }]

    const seriesMap = {};

    await new Promise((resolve, reject) => {
        influx.api.queryRows(fluxQuery, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                const room = o.room || 'Unknown';

                if (!seriesMap[room]) seriesMap[room] = [];

                seriesMap[room].push({
                    timestamp: new Date(o._time).getTime(),
                    value: o._value,
                });
            },
            error(error) { reject(error); },
            complete() { resolve(); },
        });
    });

    // Transform map to array
    // If input was a single string, we originally returned a flat array.
    // To maintain backward compatibility with old calls (if any), check type.
    // BUT for AI Chart, new structure is better.
    // Let's standardize on: if input string -> return flat array (compat). If input array -> return series array.

    if (!isMulti) {
        // Return first series found (should be only one matching roomCodes string)
        return Object.values(seriesMap)[0] || [];
    }

    return Object.keys(seriesMap).map(room => ({
        name: room,
        data: seriesMap[room]
    }));
}

/**
 * Get Statistics (Min, Max, Avg)
 * @param {string} roomCode 
 * @param {number} startMs 
 * @param {number} endMs 
 */
export async function getTemperatureStats(roomCode, startMs, endMs) {
    const influx = await getQueryApi();
    if (!influx) throw new Error('InfluxDB not configured or enabled');

    const fluxQuery = `
    data = from(bucket: "${influx.bucket}")
      |> range(start: ${Math.floor(startMs / 1000)}, stop: ${Math.floor(endMs / 1000)})
      |> filter(fn: (r) => r["room"] == "${roomCode}")
      |> filter(fn: (r) => r["_measurement"] == "room_temp")
      |> filter(fn: (r) => r["_field"] == "value")
    
    min = data |> min() |> yield(name: "min")
    max = data |> max() |> yield(name: "max")
    mean = data |> mean() |> yield(name: "mean")
    count = data |> count() |> yield(name: "count")
    `;

    const stats = { min: null, max: null, avg: null, count: 0 };
    await new Promise((resolve, reject) => {
        influx.api.queryRows(fluxQuery, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                if (o.result === 'min') stats.min = o._value;
                if (o.result === 'max') stats.max = o._value;
                if (o.result === 'mean') stats.avg = o._value;
                if (o.result === 'count') stats.count = o._value;
            },
            error(error) { reject(error); },
            complete() { resolve(); },
        });
    });

    return stats;
}

export default {
    queryTemperatureRange,
    getTemperatureStats,
    getAvailableRooms
};
