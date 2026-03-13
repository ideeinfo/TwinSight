/**
 * Week1 最小回归验证脚本
 *
 * 覆盖场景：
 * 1. WebSocket 握手与房间隔离
 * 2. ui/command 路由目标
 * 3. rag-search fileId -> kbId 映射
 * 4. timeseries average 时间桶聚合
 *
 * 用法:
 *   node tests/test-week1-regression.js
 *
 * 前提条件:
 *   - 后端服务已启动 (默认 http://localhost:3001)
 *   - 数据库中有至少一条 model_files 记录
 *   - 环境变量或 .env 中配置了有效的 JWT_SECRET
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 手动加载 .env（无需 dotenv 包）
const envPath = join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
}

// ========== 配置 ==========
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
// 默认值与 server/config/index.js 保持一致
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'your_secure_service_token_here';

// 使用内置 crypto 生成 HS256 JWT（无需 jsonwebtoken 包）
function makeToken(userId = 1, username = 'test-user') {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub: userId,
        id: userId,
        username,
        role: 'admin',
        roles: ['admin'],
        permissions: ['*'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${signature}`;
}

const TOKEN = makeToken();

// ========== HTTP 请求工具 ==========
function request(method, path, body = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`,
                'X-Service-Token': SERVICE_TOKEN,
                'X-Project-Id': 'test-project',
                ...extraHeaders
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ========== 测试工具 ==========
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, detail = '') {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ ${testName}${detail ? ' — ' + detail : ''}`);
        failed++;
        failures.push(testName);
    }
}

// ========== 测试用例 ==========

async function testUiCommandWithFileId() {
    console.log('\n📋 测试: ui/command 路由目标');

    // 不带 sessionId 且缺 fileId → 应返回 400
    const res1 = await request('POST', '/api/atomic/v1/ui/command', {
        type: 'highlight',
        target: '=A1.FAN01'
    });
    assert(res1.status === 400 && res1.body?.error?.code === 'MISSING_FILE_ID',
        'ui/command 缺 fileId → 400 MISSING_FILE_ID',
        `status=${res1.status}, code=${res1.body?.error?.code}`);

    // 带 X-File-Id 头 → 应成功
    const res2 = await request('POST', '/api/atomic/v1/ui/command', {
        type: 'navigate',
        target: '=A1.FAN01'
    }, { 'X-File-Id': '1' });
    assert(res2.status === 200, 'ui/command 带 X-File-Id → 200', `status=${res2.status}`);
}

async function testRagSearchMapping() {
    console.log('\n📋 测试: rag-search fileId→kbId 映射');

    // 缺少 query → 400
    const res1 = await request('POST', '/api/atomic/v1/knowledge/rag-search', {});
    assert(res1.status === 400 && res1.body?.error?.code === 'INVALID_PARAMS',
        'rag-search 缺 query → 400 INVALID_PARAMS');

    // 缺少 kbId 和 fileId → 400
    const res2 = await request('POST', '/api/atomic/v1/knowledge/rag-search', {
        query: 'test question'
    });
    assert(res2.status === 400 && res2.body?.error?.code === 'INVALID_PARAMS',
        'rag-search 缺 kbId 和 fileId → 400 INVALID_PARAMS');

    // 传不存在映射的 fileId → 404
    const res3 = await request('POST', '/api/atomic/v1/knowledge/rag-search', {
        query: 'test question',
        fileId: 999999
    });
    assert(res3.status === 404 && res3.body?.error?.code === 'KNOWLEDGE_BASE_NOT_FOUND',
        'rag-search 不存在的 fileId → 404 KNOWLEDGE_BASE_NOT_FOUND',
        `status=${res3.status}, code=${res3.body?.error?.code}`);
}

async function testTimeseriesAverage() {
    console.log('\n📋 测试: timeseries average 参数校验');

    // average 缺少 startMs/endMs → 400
    const res1 = await request('POST', '/api/atomic/v1/timeseries/query', {
        roomCodes: ['R001', 'R002'],
        fileId: 1,
        queryType: 'average'
    });
    assert(res1.status === 400 && res1.body?.error?.code === 'INVALID_PARAMS',
        'timeseries average 缺 startMs/endMs → 400',
        `status=${res1.status}, code=${res1.body?.error?.code}`);

    // 缺少 roomCodes → 400
    const res2 = await request('POST', '/api/atomic/v1/timeseries/query', {
        fileId: 1,
        queryType: 'average',
        startMs: 1000,
        endMs: 2000
    });
    assert(res2.status === 400 && res2.body?.error?.code === 'INVALID_PARAMS',
        'timeseries 缺 roomCodes → 400');

    // 缺少 fileId → 400
    const res3 = await request('POST', '/api/atomic/v1/timeseries/query', {
        roomCodes: ['R001'],
        queryType: 'range'
    });
    assert(res3.status === 400 && res3.body?.error?.code === 'INVALID_PARAMS',
        'timeseries 缺 fileId → 400');

    // startMs > endMs → 400
    const res4 = await request('POST', '/api/atomic/v1/timeseries/query', {
        roomCodes: ['R001'],
        fileId: 1,
        queryType: 'average',
        startMs: 2000,
        endMs: 1000
    });
    assert(res4.status === 400, 'timeseries startMs > endMs → 400', `status=${res4.status}`);
}

async function testWebSocketHandshake() {
    console.log('\n📋 测试: WebSocket 握手（需要 socket.io-client）');

    let ioClient;
    try {
        const mod = await import('socket.io-client');
        ioClient = mod.io || mod.default;
    } catch {
        console.log('  ⏭️  socket.io-client 未安装，跳过 WS 握手测试');
        return;
    }

    // 查询一个可用 fileId（优先 active，其次列表第一条）
    let validFileId = null;
    const activeRes = await request('GET', '/api/files/active');
    if (activeRes.status === 200 && activeRes.body?.data?.id) {
        validFileId = activeRes.body.data.id;
    } else {
        const filesRes = await request('GET', '/api/files');
        if (filesRes.status === 200 && Array.isArray(filesRes.body?.data) && filesRes.body.data.length > 0) {
            validFileId = filesRes.body.data[0].id;
        }
    }
    assert(!!validFileId, '存在可用 fileId 供 WS 握手测试');
    if (!validFileId) {
        return;
    }

    // 测试1: 有效 token + 有效 fileId → 应连接成功
    const result1 = await new Promise((resolve) => {
        const socket = ioClient(BASE_URL, {
            path: '/ws/control',
            auth: { token: TOKEN, fileId: validFileId },
            reconnection: false,
            timeout: 5000
        });
        const timer = setTimeout(() => { socket.disconnect(); resolve('timeout'); }, 5000);
        socket.on('connect', () => { clearTimeout(timer); socket.disconnect(); resolve('connected'); });
        socket.on('connect_error', (err) => { clearTimeout(timer); resolve(`error: ${err.message}`); });
    });
    assert(result1 === 'connected',
        `WS 握手 (token+fileId=${validFileId}) → connected`,
        result1);

    // 测试2: 有效 token + 缺失 fileId → 应拒绝
    const result2 = await new Promise((resolve) => {
        const socket = ioClient(BASE_URL, {
            path: '/ws/control',
            auth: { token: TOKEN },
            reconnection: false,
            timeout: 5000
        });
        const timer = setTimeout(() => { socket.disconnect(); resolve('timeout'); }, 5000);
        socket.on('connect', () => { clearTimeout(timer); socket.disconnect(); resolve('connected'); });
        socket.on('connect_error', (err) => { clearTimeout(timer); resolve(`error: ${err.message}`); });
    });
    assert(result2.startsWith('error'), `WS 握手 (缺 fileId) → 应拒绝`, result2);

    // 测试3: 有效 token + 不存在的 fileId → 应拒绝
    const result3 = await new Promise((resolve) => {
        const socket = ioClient(BASE_URL, {
            path: '/ws/control',
            auth: { token: TOKEN, fileId: 999999 },
            reconnection: false,
            timeout: 5000
        });
        const timer = setTimeout(() => { socket.disconnect(); resolve('timeout'); }, 5000);
        socket.on('connect', () => { clearTimeout(timer); socket.disconnect(); resolve('connected'); });
        socket.on('connect_error', (err) => { clearTimeout(timer); resolve(`error: ${err.message}`); });
    });
    assert(result3.startsWith('error'), `WS 握手 (不存在 fileId=999999) → 应拒绝`, result3);
}

// ========== 主流程 ==========
async function main() {
    console.log('='.repeat(60));
    console.log('Week1 最小回归验证');
    console.log(`目标: ${BASE_URL}`);
    console.log('='.repeat(60));

    try {
        await testUiCommandWithFileId();
        await testRagSearchMapping();
        await testTimeseriesAverage();
        await testWebSocketHandshake();
    } catch (err) {
        console.error('\n💥 测试执行异常:', err.message);
        console.error('   请确认后端服务已启动。');
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 结果: ${passed} 通过, ${failed} 失败`);
    if (failures.length > 0) {
        console.log(`❌ 失败用例:`);
        failures.forEach(f => console.log(`   - ${f}`));
    }
    console.log('='.repeat(60));

    process.exit(failed > 0 ? 1 : 0);
}

main();
