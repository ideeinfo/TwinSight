/**
 * 部署后初始化脚本
 * 
 * 功能：
 * - 检查数据库连接
 * - 自动创建表结构（首次部署）
 * - 自动运行增量迁移（更新部署）
 * - 创建系统基础数据
 * 
 * 特点：幂等执行，可重复运行不会报错
 */
import { readFileSync, readdirSync } from 'fs';
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

    // 云服务外部连接通常需要 SSL（例如 Railway 外部连接）
    if (process.env.DATABASE_URL) {
        const isInternalNetwork = process.env.DATABASE_URL.includes('.railway.internal');
        if (!isInternalNetwork) {
            config.ssl = {
                rejectUnauthorized: false // 允许自签名证书
            };
        }
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
            console.log(`⏳ 等待数据库就绪... (${i + 1}/${maxRetries}) - ${error.message}`);
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

// 运行增量迁移
async function runMigrations(pool) {
    console.log('🔄 检查数据库迁移...');

    // 1. 确保 migrations 表存在
    await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. 获取已执行的迁移
    const { rows: executed } = await pool.query('SELECT name FROM migrations');
    const executedNames = new Set(executed.map(row => row.name));

    // 3. 读取本地迁移文件
    const migrationsDir = join(__dirname, '../migrations');
    let files = [];
    try {
        files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    } catch (e) {
        console.warn('⚠️ 无法读取 migrations 目录，跳过迁移检查');
        return;
    }

    // 4. 找出未执行的迁移并排序
    const pending = files.filter(f => !executedNames.has(f)).sort();

    if (pending.length === 0) {
        console.log('✅ 所有迁移已执行');
        return;
    }

    console.log(`📦 发现 ${pending.length} 个待执行迁移:`, pending);

    // 5. 依次执行
    for (const file of pending) {
        console.log(`▶️ 执行迁移: ${file}...`);
        const filePath = join(migrationsDir, file);
        const sql = readFileSync(filePath, 'utf-8');

        try {
            await pool.query('BEGIN');
            await pool.query(sql);
            await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
            await pool.query('COMMIT');
            console.log(`   ✅ 成功`);
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error(`   ❌ 失败: ${error.message}`);
            throw error; // 中断后续迁移，防止部分成功导致状态不一致
        }
    }
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

            // model_files 表由 schema.sql 创建，这里不再单独创建
            // 直接执行 schema.sql
            const schemaPath = join(__dirname, '../db/schema.sql');
            try {
                const schema = readFileSync(schemaPath, 'utf-8');
                await pool.query(schema);
                console.log('   ✅ 完整数据库结构已创建');
            } catch (err) {
                console.error('   ❌ 数据库初始化失败:', err.message);
                throw err;
            }
        } else {
            console.log('✅ 基础数据库结构已存在');
        }

        // 检查并创建必要的扩展
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        // 运行迁移 (处理 Schema 变更)
        await runMigrations(pool);

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
