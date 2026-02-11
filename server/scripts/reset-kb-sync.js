
import { query } from '../db/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local'), override: true });

async function resetKbSync() {
    console.log('🚀 Starting Knowledge Base Sync Reset...');

    try {
        // Option 1: Delete all records (Forces full re-upload)
        const result = await query('DELETE FROM kb_documents');

        console.log(`✅ Successfully deleted ${result.rowCount} records from kb_documents.`);
        console.log('🔄 The Document Sync Service will now pick up these files as "new" and re-upload them to Open WebUI.');
        console.log('⏳ Verify the logs of your API service to see the sync progress: docker compose logs -f api');

    } catch (err) {
        console.error('❌ Error resetting KB sync:', err);
    } finally {
        process.exit();
    }
}

resetKbSync();
