
import { query } from '../config/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function fixConstraint() {
    try {
        console.log('🔨 Dropping obsolete constraint chk_single_relation...');
        await query('ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_single_relation');
        console.log('✅ Constraint dropped successfully!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Failed to drop constraint:', e);
        process.exit(1);
    }
}

fixConstraint();
