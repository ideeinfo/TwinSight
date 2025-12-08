/**
 * 数据库连接模块
 * PostgreSQL 连接池配置
 */
import pg from 'pg';
import { config } from 'dotenv';

// 加载环境变量
config();

const { Pool } = pg;

// 创建连接池
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tandem',
    max: 20,  // 最大连接数
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 连接事件
pool.on('connect', () => {
    console.log('📦 PostgreSQL 连接已建立');
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
        console.log('📊 执行查询:', { text: text.substring(0, 50), duration, rows: result.rowCount });
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
