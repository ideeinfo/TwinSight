
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function check() {
    try {
        const filenames = [
            '技术人员巡视流程与标准.pdf',
            '东雨水泵站操作规程.pdf',
            '点检标准.pdf'
        ];

        console.log('Connecting to DB...');
        for (const name of filenames) {
            const res = await pool.query('SELECT id, file_name, space_code FROM documents WHERE file_name = $1', [name]);
            if (res.rows.length > 0) {
                console.log(`✅ FOUND: ${name} (ID: ${res.rows[0].id}, Space: ${res.rows[0].space_code})`);
            } else {
                console.log(`❌ NOT FOUND: ${name}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

check();
