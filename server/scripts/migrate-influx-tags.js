/**
 * InfluxDB 数据迁移脚本
 * 将 room tag 数据迁移到 code tag，然后删除旧数据
 * 
 * 运行方式: node scripts/migrate-influx-tags.js
 */

import { config } from 'dotenv';
config();

const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'demo';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'tandem';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

if (!INFLUX_TOKEN) {
    console.error('❌ INFLUX_TOKEN 未配置');
    process.exit(1);
}

/**
 * 执行 Flux 查询
 */
async function queryFlux(flux) {
    const resp = await fetch(`${INFLUX_URL}/api/v2/query?org=${encodeURIComponent(INFLUX_ORG)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${INFLUX_TOKEN}`,
            'Content-Type': 'application/vnd.flux',
            'Accept': 'application/csv'
        },
        body: flux
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Query failed: ${resp.status} - ${err}`);
    }

    return resp.text();
}

/**
 * 写入 Line Protocol 数据
 */
async function writeLineProtocol(lines) {
    const resp = await fetch(
        `${INFLUX_URL}/api/v2/write?org=${encodeURIComponent(INFLUX_ORG)}&bucket=${encodeURIComponent(INFLUX_BUCKET)}&precision=ms`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Token ${INFLUX_TOKEN}`,
                'Content-Type': 'text/plain; charset=utf-8'
            },
            body: lines
        }
    );

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Write failed: ${resp.status} - ${err}`);
    }

    return true;
}

/**
 * 删除旧数据（使用 InfluxDB Delete API）
 */
async function deleteData(start, stop, predicate) {
    const body = JSON.stringify({
        start,
        stop,
        predicate
    });

    const resp = await fetch(
        `${INFLUX_URL}/api/v2/delete?org=${encodeURIComponent(INFLUX_ORG)}&bucket=${encodeURIComponent(INFLUX_BUCKET)}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Token ${INFLUX_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body
        }
    );

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Delete failed: ${resp.status} - ${err}`);
    }

    return true;
}

/**
 * 主迁移函数
 */
async function migrateData() {
    console.log('🔄 开始迁移 InfluxDB 数据...');
    console.log(`   URL: ${INFLUX_URL}`);
    console.log(`   Org: ${INFLUX_ORG}`);
    console.log(`   Bucket: ${INFLUX_BUCKET}`);

    // 1. 获取所有唯一的 room tag 值
    console.log('\n📋 查询现有的 room tag 值...');
    const roomTagsQuery = `
        import "influxdata/influxdb/schema"
        schema.tagValues(bucket: "${INFLUX_BUCKET}", tag: "room", start: -30d)
    `;

    const roomTagsCSV = await queryFlux(roomTagsQuery);
    const lines = roomTagsCSV.split('\n').filter(l => l && !l.startsWith('#') && !l.includes('_value'));
    const roomTags = lines
        .map(l => {
            const parts = l.split(',');
            return parts[parts.length - 1]?.trim();
        })
        .filter(v => v && v !== '' && v !== '_value');

    console.log(`   找到 ${roomTags.length} 个唯一的 room tag 值`);
    console.log(`   示例: ${roomTags.slice(0, 5).join(', ')}...`);

    if (roomTags.length === 0) {
        console.log('⚠️ 没有找到需要迁移的数据');
        return;
    }

    // 2. 对于每个 room tag，查询数据并重新写入使用 code tag
    let totalMigrated = 0;
    const migratedRooms = [];

    for (const roomCode of roomTags) {
        console.log(`\n🔄 迁移房间: ${roomCode}`);

        // 查询该房间的所有数据（分批处理以避免内存问题）
        const dataQuery = `
            from(bucket: "${INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r._measurement == "room_temp" or r._measurement == "temperature")
            |> filter(fn: (r) => r._field == "value")
            |> filter(fn: (r) => r.room == "${roomCode}")
        `;

        const dataCSV = await queryFlux(dataQuery);
        const dataLines = dataCSV.split('\n').filter(l => l && !l.startsWith('#'));

        // 解析 CSV header
        const headerLine = dataLines.find(l => l.includes('_time') && l.includes('_value'));
        if (!headerLine) {
            console.log(`   ⚠️ 没有数据或格式错误，跳过`);
            continue;
        }

        const headers = headerLine.split(',');
        const timeIdx = headers.indexOf('_time');
        const valueIdx = headers.indexOf('_value');
        const measurementIdx = headers.indexOf('_measurement');

        // 解析数据行
        const newLines = [];
        const escapedCode = roomCode.replace(/[,= ]/g, '_');

        for (const line of dataLines) {
            if (line === headerLine) continue;
            if (!line.trim()) continue;

            const parts = line.split(',');
            const timeStr = parts[timeIdx];
            const valueStr = parts[valueIdx];
            const measurement = parts[measurementIdx] || 'room_temp';

            if (!timeStr || !valueStr) continue;

            const timestamp = new Date(timeStr).getTime();
            const value = parseFloat(valueStr);

            if (!isNaN(timestamp) && !isNaN(value)) {
                // 只使用 code tag，不使用 room tag
                newLines.push(`${measurement},code=${escapedCode} value=${value} ${timestamp}`);
            }
        }

        if (newLines.length === 0) {
            console.log(`   ⚠️ 没有有效数据，跳过`);
            continue;
        }

        console.log(`   📊 迁移 ${newLines.length} 条数据点`);

        // 分批写入新数据（每批 5000 条）
        const batchSize = 5000;
        for (let i = 0; i < newLines.length; i += batchSize) {
            const batch = newLines.slice(i, i + batchSize);
            await writeLineProtocol(batch.join('\n'));
            if ((i + batchSize) % 10000 === 0 || i + batchSize >= newLines.length) {
                console.log(`   ✅ 写入进度: ${Math.min(i + batchSize, newLines.length)}/${newLines.length}`);
            }
        }

        migratedRooms.push(roomCode);
        totalMigrated += newLines.length;
    }

    console.log(`\n✅ 迁移写入完成！共写入 ${totalMigrated} 条新数据点`);

    // 3. 删除旧的只有 room tag 的数据
    console.log('\n🗑️ 清理旧数据（带 room tag 的数据）...');

    // 计算时间范围（30天前到现在）
    const now = new Date();
    const start30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const roomCode of migratedRooms) {
        console.log(`   删除 room="${roomCode}" 的旧数据...`);
        try {
            await deleteData(
                start30DaysAgo.toISOString(),
                now.toISOString(),
                `room="${roomCode}"`
            );
            console.log(`   ✅ 已删除`);
        } catch (err) {
            console.log(`   ⚠️ 删除失败: ${err.message}`);
        }
    }

    console.log(`\n🎉 迁移完成！`);
    console.log(`   - 迁移了 ${migratedRooms.length} 个房间`);
    console.log(`   - 写入了 ${totalMigrated} 条新数据点（使用 code tag）`);
    console.log(`   - 删除了旧数据（使用 room tag）`);
}

// 运行迁移
migrateData().catch(err => {
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
});
