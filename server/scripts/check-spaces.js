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

async function checkSpaces() {
    try {
        console.log('📊 检查空间数据\n');

        // 检查空间总数
        const count = await pool.query('SELECT COUNT(*) FROM spaces');
        console.log(`空间总数: ${count.rows[0].count}`);

        // 检查前5条空间数据
        const spaces = await pool.query(`
            SELECT 
                space_code, 
                name, 
                classification_code, 
                classification_desc,
                db_id
            FROM spaces 
            LIMIT 10
        `);

        console.log('\n前10条空间数据:');
        console.table(spaces.rows);

        // 检查有分类的空间数量
        const withClass = await pool.query(`
            SELECT COUNT(*) 
            FROM spaces 
            WHERE classification_code IS NOT NULL 
            AND classification_code != ''
        `);

        console.log(`\n有分类编码的空间数: ${withClass.rows[0].count}`);

        // 检查分类表中与空间相关的分类
        const spaceClass = await pool.query(`
            SELECT * 
            FROM classifications 
            WHERE classification_type = 'space'
            LIMIT 5
        `);

        console.log('\n空间类型的分类:');
        console.table(spaceClass.rows);

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await pool.end();
    }
}

checkSpaces();
