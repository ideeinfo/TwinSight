
import { InfluxDB } from '@influxdata/influxdb-client';
import { getConfig } from '../services/config-service.js';
import pool from '../db/index.js';

async function check() {
    try {
        const url = await getConfig('INFLUXDB_URL', 'http://localhost');
        const port = await getConfig('INFLUXDB_PORT', '8086');
        const token = await getConfig('INFLUXDB_TOKEN', '');
        const org = await getConfig('INFLUXDB_ORG', 'demo');
        const bucket = await getConfig('INFLUXDB_BUCKET', 'twinsight');

        const fullUrl = port ? `${url}:${port}` : url;

        console.log(`Using InfluxDB: ${fullUrl}, Org: ${org}, Bucket: ${bucket}`);
        console.log(`Token length: ${token ? token.length : 0}`);

        const client = new InfluxDB({ url: fullUrl, token });
        const queryApi = client.getQueryApi(org);

        const query = `
        from(bucket: "${bucket}")
          |> range(start: -30d)
          |> filter(fn: (r) => r["_field"] == "temperature" or r["_field"] == "value")
          |> limit(n: 20)
        `;

        console.log('--- Executing Query ---');
        let count = 0;
        await new Promise((resolve, reject) => {
            queryApi.queryRows(query, {
                next(row, tableMeta) {
                    const o = tableMeta.toObject(row);
                    console.log(`[Row ${++count}] Time: ${o._time}, Measurement: ${o._measurement}, Field: ${o._field}, Room: "${o.room}", Value: ${o._value}`);
                },
                error(error) {
                    console.error('Query Error:', error);
                    reject(error);
                },
                complete() {
                    console.log('--- Query Complete ---');
                    resolve();
                },
            });
        });

    } catch (err) {
        console.error('Script Error:', err);
    } finally {
        await pool.end(); // Close DB pool
    }
}

check();
