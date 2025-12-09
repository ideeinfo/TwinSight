import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'tandem',
    user: 'postgres',
    password: 'password'
});

async function checkSchema() {
    try {
        // 检查 asset_specs 表的所有列
        const columns = await pool.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'asset_specs'
            ORDER BY ordinal_position
        `);

        console.log('✅ asset_specs 表的列结构:');
        console.table(columns.rows);

        // 检查约束
        const constraints = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'asset_specs'
        `);

        console.log('\n✅ asset_specs 表的约束:');
        console.table(constraints.rows);

        // 检查唯一索引
        const indexes = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'asset_specs'
        `);

        console.log('\n✅ asset_specs 表的索引:');
        console.table(indexes.rows);

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
