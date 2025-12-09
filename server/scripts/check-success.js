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

async function checkSuccess() {
    try {
        console.log('🎉 检查数据导入成功情况\n');

        // 统计
        const count = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM classifications) as classifications,
                (SELECT COUNT(*) FROM asset_specs) as specs,
                (SELECT COUNT(*) FROM assets) as assets,
                (SELECT COUNT(*) FROM spaces) as spaces
        `);

        console.log('📊 总数统计:');
        console.table(count.rows[0]);

        // 检查规格表的关键字段
        const specsCheck = await pool.query(`
            SELECT 
                spec_code,
                spec_name,
                classification_code,
                manufacturer
            FROM asset_specs 
            LIMIT 5
        `);

        console.log('\n📋 前5条规格数据（检查关键字段）:');
        console.table(specsCheck.rows);

        // 统计有 spec_name 的数量
        const specNameCount = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE spec_name IS NOT NULL AND spec_name != '') as has_spec_name,
                COUNT(*) FILTER (WHERE classification_code IS NOT NULL AND classification_code != '') as has_classification,
                COUNT(*) as total
            FROM asset_specs
        `);

        console.log('\n📊 规格表字段完整性:');
        console.table(specNameCount.rows[0]);

        // 检查资产表
        const assetsCheck = await pool.query(`
            SELECT asset_code, spec_code, name, floor, room 
            FROM assets 
            LIMIT 5
        `);

        console.log('\n📋 前5条资产数据:');
        console.table(assetsCheck.rows);

        // 检查分类表
        const classCheck = await pool.query(`
            SELECT classification_code, classification_desc, classification_type 
            FROM classifications 
            LIMIT 5
        `);

        console.log('\n📋 前5条分类数据:');
        console.table(classCheck.rows);

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await pool.end();
    }
}

checkSuccess();
