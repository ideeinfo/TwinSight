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

async function countData() {
    try {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM classifications) as classifications,
                (SELECT COUNT(*) FROM asset_specs) as specs,
                (SELECT COUNT(*) FROM assets) as assets,
                (SELECT COUNT(*) FROM spaces) as spaces
        `);

        console.log('📊 数据库数据统计:\n');
        console.table(result.rows[0]);

        // 显示前几条数据
        const assets = await pool.query('SELECT asset_code, spec_code, name, floor, room FROM assets LIMIT 5');
        console.log('\n📋 前5条资产:');
        console.table(assets.rows);

        const specs = await pool.query('SELECT spec_code, spec_name, classification_code FROM asset_specs LIMIT 5');
        console.log('\n📋 前5条规格:');
        console.table(specs.rows);

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await pool.end();
    }
}

countData();
