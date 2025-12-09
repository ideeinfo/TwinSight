
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tandem',
});

async function checkAllConstraints() {
    try {
        const tables = ['assets', 'spaces', 'asset_specs', 'classifications'];

        for (const table of tables) {
            console.log(`\n🔍 Checking constraints for table: ${table}`);
            const res = await pool.query(`
                SELECT 
                    conname as constraint_name, 
                    pg_get_constraintdef(c.oid) as definition
                FROM pg_constraint c 
                JOIN pg_namespace n ON n.oid = c.connamespace 
                WHERE n.nspname = 'public'
                AND c.conrelid::regclass::text = $1
            `, [table]);

            if (res.rows.length === 0) {
                console.log('   (No constraints found)');
            } else {
                res.rows.forEach(r => console.log(`   - ${r.constraint_name}: ${r.definition}`));
            }

            // Also check Indexes because ON CONFLICT uses indexes
            const indexes = await pool.query(`
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = $1
            `, [table]);
            console.log(`   (Indexes)`);
            if (indexes.rows.length === 0) {
                console.log('   (No indexes found)');
            } else {
                indexes.rows.forEach(r => console.log(`   - ${r.indexname}: ${r.indexdef}`));
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkAllConstraints();
