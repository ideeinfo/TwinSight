/**
 * 数据库连接模块
 * PostgreSQL 连接池配置
 */
import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载项目根目录的统一 .env 文件
config({ path: join(__dirname, '../../.env') });

const { Pool } = pg;

// 创建连接池配置
// 优先使用 DATABASE_URL（Railway 等云服务提供）
let poolConfig;

if (process.env.DATABASE_URL) {
    // 使用 DATABASE_URL 连接字符串
    const isInternalNetwork = process.env.DATABASE_URL.includes('.railway.internal');

    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        // Railway 内部网络不需要 SSL，外部连接需要
        ssl: isInternalNetwork ? false : { rejectUnauthorized: false }
    };
    console.log(`📦 使用 DATABASE_URL 连接 PostgreSQL (内部网络: ${isInternalNetwork})`);
} else {
    // 使用独立环境变量（本地开发）
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'twinsight',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
    console.log('📦 使用独立环境变量连接 PostgreSQL');
}

const pool = new Pool(poolConfig);
const SLOW_SQL_MS = parseInt(process.env.SLOW_SQL_MS || '200', 10);

// 连接事件（禁用日志）
pool.on('connect', () => {
    // console.log('📦 PostgreSQL 连接已建立');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL 连接池错误:', err);
});

/**
 * 执行 SQL 查询
 * @param {string} text - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration >= SLOW_SQL_MS) {
            const compactSql = String(text || '').replace(/\s+/g, ' ').trim();
            console.warn('🐢 Slow SQL:', {
                durationMs: duration,
                rows: result.rowCount,
                sql: compactSql.substring(0, 300)
            });
        }
        return result;
    } catch (error) {
        console.error('❌ 查询错误:', error.message);
        throw error;
    }
};

/**
 * 获取客户端连接（用于事务）
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = async () => {
    return await pool.connect();
};

/**
 * 关闭连接池
 */
export const closePool = async () => {
    await pool.end();
    console.log('📦 PostgreSQL 连接池已关闭');
};

export default pool;
