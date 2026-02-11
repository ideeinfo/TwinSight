
import { query } from '../db/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local'), override: true });

async function fixInfluxConfig() {
    console.log('🚀 Starting InfluxDB config cleanup...');

    try {
        // Delete configs with localhost or 127.0.0.1
        const result = await query(`
            DELETE FROM influx_configs 
            WHERE influx_url LIKE '%localhost%' OR influx_url LIKE '%127.0.0.1%'
            RETURNING *
        `);

        console.log(`✅ Deleted ${result.rowCount} invalid InfluxDB configurations.`);

        if (result.rowCount > 0) {
            console.log('Invalid configs removed:');
            result.rows.forEach(row => {
                console.log(`- File ID: ${row.file_id}, URL: ${row.influx_url}`);
            });
        } else {
            console.log('✨ No invalid configurations found.');
        }

    } catch (error) {
        console.error('❌ Error cleaning up InfluxDB config:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

fixInfluxConfig();
