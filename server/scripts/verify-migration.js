import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'tandem',
    user: 'postgres',
    password: 'password'
});

async function verify() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'asset_specs' AND column_name = 'spec_name'
        `);

        console.log('✅ 验证 spec_name 字段:');
        console.table(result.rows);

        if (result.rows.length > 0) {
            console.log('\n🎉 spec_name 字段已成功添加到 asset_specs 表！');
        } else {
            console.log('\n❌ 未找到 spec_name 字段');
        }
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
    } finally {
        await pool.end();
    }
}

verify();
