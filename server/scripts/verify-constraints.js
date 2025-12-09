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
        // 检查 spec_code 的唯一约束
        const result = await pool.query(`
            SELECT conname, contype
            FROM pg_constraint
            WHERE conrelid = 'asset_specs'::regclass
            AND contype = 'u'
        `);

        console.log('✅ asset_specs 表的唯一约束:');
        if (result.rows.length > 0) {
            result.rows.forEach(row => {
                console.log(`   - ${row.conname} (类型: ${row.contype})`);
            });
            console.log('\n🎉 spec_code 唯一约束已正确创建！');
        } else {
            console.log('   ❌ 未找到唯一约束');
        }

        // 测试插入
        console.log('\n🧪 测试插入数据...');
        await pool.query(`
            INSERT INTO asset_specs (spec_code, spec_name)
            VALUES ('TEST001', '测试规格')
            ON CONFLICT (spec_code) DO NOTHING
        `);
        console.log('✅ ON CONFLICT 语法测试成功！');

        // 清理测试数据
        await pool.query(`DELETE FROM asset_specs WHERE spec_code = 'TEST001'`);

    } catch (error) {
        console.error('❌ 验证失败:', error.message);
    } finally {
        await pool.end();
    }
}

verify();
