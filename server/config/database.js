/**
 * 数据库配置
 * PostgreSQL 连接配置
 */
import pg from 'pg';
import config from './index.js';

const { Pool } = pg;

// 创建连接池
const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    max: 20, // 最大连接数
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 连接事件日志
pool.on('connect', () => {
    console.log('📦 PostgreSQL 连接已建立');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL 连接错误:', err);
});

/**
 * 执行查询
 */
export const query = async (text, params) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (config.server.env === 'development') {
        console.log('🔍 SQL 查询:', { text, duration: `${duration}ms`, rows: res.rowCount });
    }

    return res;
};

/**
 * 获取客户端连接（用于事务）
 */
export const getClient = async () => {
    const client = await pool.connect();
    return client;
};

/**
 * 执行事务
 */
export const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export default pool;
