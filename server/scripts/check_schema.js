
import { query } from '../config/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure the correct env file is loaded if needed, relying on fixed config/index.js now
// But verify_spec_name_temp might need explicit dotenv loading if it's standalone?
// Let's assume the fix in config/index.js works for imports.

async function checkSchema() {
    try {
        console.log('🔍 Checking documents table schema...');
        const res = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'documents'
        `);
        console.table(res.rows);

        const hasViewId = res.rows.some(r => r.column_name === 'view_id');
        if (hasViewId) {
            console.log('✅ view_id column EXISTS.');
        } else {
            console.error('❌ view_id column MISSING!');
        }
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}

checkSchema();
