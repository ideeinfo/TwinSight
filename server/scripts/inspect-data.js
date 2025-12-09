import pg from 'pg';
import { config } from 'dotenv';

config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tandem',
});

async function inspectData() {
    try {
        console.log('📊 检查实际数据...\n');

        // 检查资产数据
        const assets = await pool.query('SELECT * FROM assets LIMIT 5');
        console.log('✅ 前5条资产数据:');
        console.table(assets.rows);

        // 检查资产规格
        const specs = await pool.query('SELECT * FROM asset_specs LIMIT 5');
        console.log('\n📋 资产规格数据:');
        if (specs.rows.length > 0) {
            console.table(specs.rows);
        } else {
            console.log('   ⚠️ 没有资产规格数据');
        }

        // 检查分类
        const classifications = await pool.query('SELECT * FROM classifications LIMIT 5');
        console.log('\n📋 分类编码数据:');
        if (classifications.rows.length > 0) {
            console.table(classifications.rows);
        } else {
            console.log('   ⚠️ 没有分类编码数据');
        }

        // 检查spec_code的值
        const specCodes = await pool.query(`
            SELECT spec_code, COUNT(*) as count 
            FROM assets 
            WHERE spec_code IS NOT NULL
            GROUP BY spec_code 
            LIMIT 10
        `);
        console.log('\n📋 资产中的 spec_code 值（前10个）:');
        console.table(specCodes.rows);

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
    } finally {
        await pool.end();
    }
}

inspectData();
