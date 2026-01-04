/**
 * 生产环境数据库修复脚本
 * 用途：
 * 1. 确保 Admin 账户存在且密码正确
 * 2. 确保必要的角色表存在
 * 3. 关联 Admin 用户到 admin 角色
 * 
 * 使用方法：
 * 在本地运行：node scripts/fix-prod-auth.js
 * 必须先在 .env 中配置 DATABASE_URL 为 Railway 的连接字符串
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

// 优先使用 DATABASE_URL (Railway 标准配置)
const config = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tandem',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
};

const pool = new Pool(config);

async function fixAuth() {
    console.log('🔄 开始修复认证数据...');
    console.log(`📡 连接数据库: ${config.connectionString ? 'Railway URL' : 'Localhost'}`);

    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. 确保 users 表存在且有 correct schema
            console.log('🛠️ 检查并修复表结构...');

            // 确保 password_hash 列足够长
            await client.query(`
                ALTER TABLE users ALTER COLUMN password_hash TYPE VARCHAR(255);
            `);

            // 2. 重置管理员账户
            console.log('👤 重置管理员账户...');
            // Admin123! 的 bcrypt 哈希
            const correctHash = '$2b$10$xaLzqBZT93.SO0ze5j9l7eQuqD3dKdeP47pCB3QuJz6shxPfAYVzi';

            await client.query(`
                INSERT INTO users (email, password_hash, name, is_active)
                VALUES ('admin@tandem.local', $1, 'System Admin', true)
                ON CONFLICT (email) DO UPDATE SET 
                    password_hash = EXCLUDED.password_hash,
                    is_active = true;
            `, [correctHash]);

            // 获取 Admin ID
            const res = await client.query(`SELECT id FROM users WHERE email = 'admin@tandem.local'`);
            const adminId = res.rows[0].id;

            // 3. 关联 Admin 角色
            console.log('🛡️ 关联管理员角色...');
            await client.query(`
                INSERT INTO user_roles (user_id, role)
                VALUES ($1, 'admin')
                ON CONFLICT (user_id, role) DO NOTHING;
            `, [adminId]);

            // 4. (可选) 清理特定用户的一样 (如果需要的话，比如清理旧的测试Viewer)
            // 这里我们只打印当前的用户列表
            const usersRes = await client.query(`
                SELECT u.email, array_agg(ur.role) as roles 
                FROM users u 
                LEFT JOIN user_roles ur ON u.id = ur.user_id 
                GROUP BY u.id
            `);

            console.log('\n✅ 当前用户状态:');
            console.table(usersRes.rows);

            await client.query('COMMIT');
            console.log('\n✨ 修复完成！请尝试使用 admin@tandem.local / Admin123! 登录');

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('❌ 修复失败:', e.message);
    } finally {
        await pool.end();
    }
}

fixAuth();
