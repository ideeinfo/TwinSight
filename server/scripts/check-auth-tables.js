/**
 * 检查认证表状态
 */
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'tandem',
    user: 'postgres',
    password: 'password'
});

async function check() {
    try {
        // 检查表是否存在
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'user_roles', 'user_identities', 'refresh_tokens')
            ORDER BY table_name
        `);
        console.log('✅ 已创建的认证表:');
        tables.rows.forEach(r => console.log('   -', r.table_name));

        // 检查是否有默认管理员
        const admin = await pool.query(`SELECT id, email, name FROM users WHERE email = 'admin@tandem.local'`);
        if (admin.rows.length > 0) {
            console.log('\n✅ 默认管理员账户:', admin.rows[0].email);
        } else {
            console.log('\n⚠️ 默认管理员账户未创建');
        }

        // 检查管理员角色
        if (admin.rows.length > 0) {
            const roles = await pool.query(`
                SELECT r.role FROM user_roles r 
                WHERE r.user_id = $1
            `, [admin.rows[0].id]);
            if (roles.rows.length > 0) {
                console.log('   角色:', roles.rows.map(r => r.role).join(', '));
            }
        }

        // 计数
        const userCount = await pool.query(`SELECT COUNT(*) as count FROM users`);
        console.log('\n📊 用户总数:', userCount.rows[0].count);

    } catch (e) {
        console.error('❌ 错误:', e.message);
    } finally {
        await pool.end();
    }
}

check();
