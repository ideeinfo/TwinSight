
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local'), override: true });

const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'twinsight',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
};

console.log(`🔌 Connecting to database at ${dbConfig.host}:${dbConfig.port}...`);

const pool = new pg.Pool(dbConfig);

async function cleanupTriggers() {
    const client = await pool.connect();
    try {
        console.log('🧹 Cleaning up duplicate triggers...');

        // Find duplicates based on name
        const findDuplicatesSql = `
            SELECT name, count(*) 
            FROM iot_triggers 
            GROUP BY name 
            HAVING count(*) > 1;
        `;

        const res = await client.query(findDuplicatesSql);

        if (res.rows.length === 0) {
            console.log('✅ No duplicates found.');
        } else {
            console.log(`⚠️ Found ${res.rows.length} duplicate groups. fixing...`);

            // Keep the one with the lowest ID, delete others
            const cleanupSql = `
                DELETE FROM iot_triggers a 
                USING iot_triggers b 
                WHERE a.id > b.id 
                AND a.name = b.name;
            `;

            const deleteRes = await client.query(cleanupSql);
            console.log(`✅ Deleted ${deleteRes.rowCount} duplicate rows.`);
        }

        // Add unique constraint to avoid future duplicates
        console.log('🔒 Adding unique constraint on (name)...');
        try {
            await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_iot_triggers_name_unique ON iot_triggers(name);');
            console.log('✅ Unique index added.');
        } catch (idxErr) {
            console.warn('⚠️ Could not add unique index (might already exist or conflict):', idxErr.message);
        }

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanupTriggers();
