/**
 * 部署后初始化脚本
 * 
 * 功能：
 * - 检查数据库连接
 * - 自动创建表结构（如不存在）
 * - 创建系统基础数据
 * 
 * 特点：幂等执行，可重复运行不会报错
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库连接配置
const getDbConfig = () => {
    let config = {};

    // 优先使用 DATABASE_URL（Railway 等云服务自动注入）
    if (process.env.DATABASE_URL) {
        config = { connectionString: process.env.DATABASE_URL };
    } else {
        // 否则使用独立配置
        config = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'tandem',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password'
        };
    }

    // 生产环境或云服务通常需要 SSL
    if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
        config.ssl = {
            rejectUnauthorized: false // 允许自签名证书（Railway 内部连接通常需要）
        };
    }

    return config;
};

// 等待数据库就绪
async function waitForDatabase(maxRetries = 30, retryDelay = 2000) {
    const config = getDbConfig();

    for (let i = 0; i < maxRetries; i++) {
        try {
            const pool = new pg.Pool(config);
            await pool.query('SELECT 1');
            await pool.end();
            console.log('✅ 数据库连接成功');
            return true;
        } catch (error) {
            console.log(`⏳ 等待数据库就绪... (${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error('❌ 数据库连接超时');
}

// 检查表是否存在
async function tableExists(pool, tableName) {
    const result = await pool.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        );
    `, [tableName]);
    return result.rows[0].exists;
}

// 初始化数据库结构
async function initializeDatabase() {
    const config = getDbConfig();
    const pool = new pg.Pool(config);

    try {
        // 检查核心表是否存在
        const modelsTableExists = await tableExists(pool, 'model_files');

        if (!modelsTableExists) {
            console.log('📦 首次部署，开始创建数据库结构...');

            // 首先创建 model_files 表（其他表依赖它）
            await pool.query(`
                CREATE TABLE IF NOT EXISTS model_files (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(500) NOT NULL,
                    original_name VARCHAR(500),
                    urn VARCHAR(1000),
                    file_path VARCHAR(1000),
                    file_size BIGINT,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('   ✅ model_files 表已创建');

            // 读取并执行完整 schema
            const schemaPath = join(__dirname, '../db/schema.sql');
            const schema = readFileSync(schemaPath, 'utf-8');
            await pool.query(schema);
            console.log('   ✅ 完整数据库结构已创建');
        } else {
            console.log('✅ 数据库结构已存在，跳过初始化');
        }

        // 检查并创建必要的扩展
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        // 创建系统基础数据（如需要）
        await createBaseData(pool);

    } finally {
        await pool.end();
    }
}

// 创建系统基础数据
async function createBaseData(pool) {
    // 检查是否有基础分类数据
    const result = await pool.query('SELECT COUNT(*) FROM classifications');

    if (parseInt(result.rows[0].count) === 0) {
        console.log('📝 创建系统基础数据...');

        // 可以在此添加默认分类数据
        // await pool.query(`
        //     INSERT INTO classifications (classification_code, classification_desc, classification_type)
        //     VALUES ('DEFAULT', '默认分类', 'asset')
        //     ON CONFLICT DO NOTHING;
        // `);

        console.log('   ✅ 基础数据创建完成');
    }
}

// 主函数
async function main() {
    console.log(`
╔════════════════════════════════════════════════╗
║     Twinsight - 部署后初始化                    ║
╚════════════════════════════════════════════════╝
    `);

    try {
        // 1. 等待数据库就绪
        await waitForDatabase();

        // 2. 初始化数据库结构
        await initializeDatabase();

        console.log(`
╔════════════════════════════════════════════════╗
║     ✅ 初始化完成，准备启动应用                ║
╚════════════════════════════════════════════════╝
        `);

    } catch (error) {
        console.error('❌ 初始化失败:', error.message);
        process.exit(1);
    }
}

// 导出初始化函数
export async function runDeployInit() {
    await main();
}

// 只有直接运行时才执行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
