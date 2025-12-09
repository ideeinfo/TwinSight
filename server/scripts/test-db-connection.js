import pg from 'pg';
import { config } from 'dotenv';

// 加载环境变量
config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tandem',
});

async function testConnection() {
    try {
        console.log('🔍 测试数据库连接...\n');
        console.log('配置信息:');
        console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
        console.log(`  Port: ${process.env.DB_PORT || '5432'}`);
        console.log(`  Database: ${process.env.DB_NAME || 'tandem'}`);
        console.log(`  User: ${process.env.DB_USER || 'postgres'}\n`);

        const result = await pool.query('SELECT NOW() as now, current_database() as db');

        console.log('✅ 数据库连接成功！');
        console.log(`   当前时间: ${result.rows[0].now}`);
        console.log(`   当前数据库: ${result.rows[0].db}\n`);

        // 检查表
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('📋 数据库表:');
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        // 检查表数据
        const counts = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM classifications) as classifications,
                (SELECT COUNT(*) FROM asset_specs) as specs,
                (SELECT COUNT(*) FROM assets) as assets,
                (SELECT COUNT(*) FROM spaces) as spaces
        `);

        console.log('\n📊 表数据统计:');
        console.log(`   分类: ${counts.rows[0].classifications}`);
        console.log(`   规格: ${counts.rows[0].specs}`);
        console.log(`   资产: ${counts.rows[0].assets}`);
        console.log(`   空间: ${counts.rows[0].spaces}`);

    } catch (error) {
        console.error('\n❌ 数据库连接失败:', error.message);
    } finally {
        await pool.end();
    }
}

testConnection();
