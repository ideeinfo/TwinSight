/**
 * 删除指定 code tag 的数据
 * 只保留 B 和 Q 开头的数据
 * 
 * 运行方式: node scripts/cleanup-influx-codes.js
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
 * 删除数据
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
 * 主清理函数
 */
async function cleanupData() {
    console.log('🗑️ 开始清理 InfluxDB 数据...');
    console.log(`   URL: ${INFLUX_URL}`);
    console.log(`   Org: ${INFLUX_ORG}`);
    console.log(`   Bucket: ${INFLUX_BUCKET}`);
    console.log('   保留: B 和 Q 开头的 code');

    // 1. 获取所有 code tag 值
    console.log('\n📋 查询现有的 code tag 值...');
    const codeTagsQuery = `
        import "influxdata/influxdb/schema"
        schema.tagValues(bucket: "${INFLUX_BUCKET}", tag: "code", start: -30d)
    `;

    const codeTagsCSV = await queryFlux(codeTagsQuery);
    const lines = codeTagsCSV.split('\n').filter(l => l && l.includes(',_result,'));
    const allCodes = lines
        .map(l => {
            const parts = l.split(',');
            return parts[parts.length - 1]?.trim();
        })
        .filter(v => v && v !== '' && v !== '_value');

    console.log(`   找到 ${allCodes.length} 个唯一的 code tag 值`);

    // 2. 过滤出需要删除的 code（不以 B 或 Q 开头）
    const codesToDelete = allCodes.filter(code => !code.startsWith('B') && !code.startsWith('Q'));
    const codesToKeep = allCodes.filter(code => code.startsWith('B') || code.startsWith('Q'));

    console.log(`   保留: ${codesToKeep.length} 个 (B/Q 开头)`);
    console.log(`   删除: ${codesToDelete.length} 个 (其他)`);

    if (codesToDelete.length === 0) {
        console.log('\n✅ 没有需要删除的数据');
        return;
    }

    console.log('\n📋 将删除以下 code:');
    console.log(`   ${codesToDelete.slice(0, 10).join(', ')}${codesToDelete.length > 10 ? '...' : ''}`);

    // 3. 删除数据
    console.log('\n🗑️ 开始删除...');

    // 计算时间范围（30天前到未来1天，确保覆盖所有数据）
    const now = new Date();
    const start30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let deleted = 0;
    for (const code of codesToDelete) {
        try {
            await deleteData(
                start30DaysAgo.toISOString(),
                tomorrow.toISOString(),
                `code="${code}"`
            );
            deleted++;
            if (deleted % 10 === 0 || deleted === codesToDelete.length) {
                console.log(`   ✅ 已删除 ${deleted}/${codesToDelete.length}`);
            }
        } catch (err) {
            console.log(`   ⚠️ 删除 code="${code}" 失败: ${err.message}`);
        }
    }

    console.log(`\n🎉 清理完成！`);
    console.log(`   - 删除了 ${deleted} 个 code 的数据`);
    console.log(`   - 保留了 ${codesToKeep.length} 个 code 的数据 (B/Q 开头)`);
}

// 运行清理
cleanupData().catch(err => {
    console.error('❌ 清理失败:', err.message);
    process.exit(1);
});
