import pg from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 server/.env 文件
config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

console.log('🔍 检查后端数据库连接配置...\n');
console.log('环境变量:');
console.log(`  DB_HOST: ${process.env.DB_HOST || '(未设置)'}`);
console.log(`  DB_PORT: ${process.env.DB_PORT || '(未设置)'}`);
console.log(`  DB_NAME: ${process.env.DB_NAME || '(未设置)'}`);
console.log(`  DB_USER: ${process.env.DB_USER || '(未设置)'}`);
console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : '(未设置)'}\n`);

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tandem',
});

async function checkBackendConnection() {
    try {
        console.log('🔌 测试数据库连接...');

        const result = await pool.query('SELECT NOW() as now, current_database() as db, current_user as user');

        console.log('\n✅ 连接成功！');
        console.log(`  连接到数据库: ${result.rows[0].db}`);
        console.log(`  用户: ${result.rows[0].user}`);
        console.log(`  服务器时间: ${result.rows[0].now}\n`);

        // 测试插入
        console.log('🧪 测试插入数据...');

        await pool.query('BEGIN');

        // 插入测试分类
        await pool.query(`
            INSERT INTO classifications (classification_code, classification_desc, classification_type)
            VALUES ('TEST001', '测试分类', 'asset')
            ON CONFLICT (classification_code, classification_type) 
            DO UPDATE SET classification_desc = EXCLUDED.classification_desc
        `);

        console.log('  ✅ 分类插入成功');

        // 插入测试规格
        await pool.query(`
            INSERT INTO asset_specs (spec_code, spec_name)
            VALUES ('TEST_SPEC', '测试规格')
            ON CONFLICT (spec_code)
            DO UPDATE SET spec_name = EXCLUDED.spec_name
        `);

        console.log('  ✅ 规格插入成功');

        // 插入测试资产
        await pool.query(`
            INSERT INTO assets (asset_code, spec_code, name)
            VALUES ('TEST_ASSET', 'TEST_SPEC', '测试资产')
            ON CONFLICT (asset_code)
            DO UPDATE SET name = EXCLUDED.name
        `);

        console.log('  ✅ 资产插入成功');

        await pool.query('ROLLBACK');  // 回滚测试数据

        console.log('\n✅ 所有测试通过！后端数据库连接正常\n');

    } catch (error) {
        await pool.query('ROLLBACK').catch(() => { });
        console.error('\n❌ 测试失败:', error.message);
        console.error('详细错误:', error);
    } finally {
        await pool.end();
    }
}

checkBackendConnection();
