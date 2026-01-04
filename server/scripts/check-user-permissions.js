/**
 * 检查用户权限脚本
 * 用途：调试生产环境用户角色和权限问题
 * 用法：node server/scripts/check-user-permissions.js <email>
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PERMISSIONS, getRolePermissions } from '../config/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

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

async function checkPermissions(email) {
    if (!email) {
        console.error('❌ 请提供邮箱地址');
        process.exit(1);
    }

    console.log(`🔍 正在检查用户: ${email}`);

    try {
        const client = await pool.connect();
        try {
            // 1. 获取用户信息
            const userRes = await client.query('SELECT * FROM users WHERE email = $1', [email]);
            const user = userRes.rows[0];

            if (!user) {
                console.error('❌ 用户不存在');
                return;
            }

            console.log('\n👤 用户基本信息:');
            console.table([{
                id: user.id,
                name: user.name,
                is_active: user.is_active,
                created_at: user.created_at
            }]);

            // 2. 获取角色
            const rolesRes = await client.query('SELECT role FROM user_roles WHERE user_id = $1', [user.id]);
            const roles = rolesRes.rows.map(r => r.role);

            console.log('\n🛡️  用户角色:', roles);

            if (roles.length === 0) {
                console.warn('⚠️  警告: 该用户没有任何角色！');
            }

            // 3. 计算权限 (使用当前代码库逻辑)
            const permissions = new Set();
            roles.forEach(role => {
                const rolePerms = getRolePermissions(role);
                rolePerms.forEach(p => permissions.add(p));
            });
            const permArray = Array.from(permissions);

            console.log(`\n🔑 计算得出的权限 (${permArray.length} 个):`);
            // 打印前 10 个和特定关键权限
            console.log(permArray.slice(0, 10));
            if (permArray.length > 10) console.log('... (更多)');

            // 4. 关键权限检查
            const criticalPerms = [
                'model:upload',
                'model:read',
                'model:activate',
                'asset:read'
            ];

            console.log('\n✅ 关键权限检查:');
            const checks = criticalPerms.map(p => ({
                Permission: p,
                HasIt: permArray.includes(p) ? '✅ YES' : '❌ NO'
            }));
            console.table(checks);

            // 5. 检查文件数量 (确认是否有数据)
            const filesRes = await client.query('SELECT COUNT(*) FROM model_files');
            console.log(`\nfq 数据库中的文件数量: ${filesRes.rows[0].count}`);

        } finally {
            client.release();
        }
    } catch (e) {
        console.error('❌ 错误:', e.message);
    } finally {
        await pool.end();
    }
}

// 获取命令行参数
const email = process.argv[2] || 'admin@tandem.local';
checkPermissions(email);
