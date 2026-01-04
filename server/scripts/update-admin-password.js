/**
 * 更新管理员密码哈希
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

async function updateAdminPassword() {
    try {
        // 正确的 bcrypt 哈希 for "Admin123!"
        const correctHash = '$2b$10$xaLzqBZT93.SO0ze5j9l7eQuqD3dKdeP47pCB3QuJz6shxPfAYVzi';

        await pool.query(`
            UPDATE users SET password_hash = $1 WHERE email = 'admin@tandem.local'
        `, [correctHash]);

        console.log('✅ 管理员密码已更新');
        console.log('   邮箱: admin@tandem.local');
        console.log('   密码: Admin123!');

    } catch (e) {
        console.error('❌ 错误:', e.message);
    } finally {
        await pool.end();
    }
}

updateAdminPassword();
