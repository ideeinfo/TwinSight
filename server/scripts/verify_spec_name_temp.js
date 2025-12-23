
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password', // Hardcoded from .env.local observation
    database: 'tandem',
});

async function verify() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'asset_specs' 
            AND column_name = 'spec_name';
        `);
        console.log('Verification Result:', res.rows);
        if (res.rows.length > 0) {
            console.log('SUCCESS: spec_name column exists.');
        } else {
            console.log('FAILURE: spec_name column MISSING.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
verify();
