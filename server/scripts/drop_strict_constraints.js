
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

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

async function dropConstraints() {
    const client = await pool.connect();
    try {
        console.log('🔄 Dropping complex constraints to reduce errors...');

        await client.query('BEGIN');

        // Drop unique constraints that cause ON CONFLICT issues if we don't match them perfectly
        // We will rely on application logic or simpler primary keys if needed.
        // Or keep simple primary keys but remove complex composite uniques if they are causing trouble.

        // Actually, the user asked to "remove constraint relationships".
        // This usually means Foreign Keys or strict Unique constraints.

        // 1. Drop Foreign Keys to model_files if they exist (strict referential integrity)
        // Although invalid file_ids are bad, removing FK allows inserting data even if file management is buggy.
        await client.query(`ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_file_id_fkey`);
        await client.query(`ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_file_id_fkey`);
        await client.query(`ALTER TABLE asset_specs DROP CONSTRAINT IF EXISTS asset_specs_file_id_fkey`);
        await client.query(`ALTER TABLE classifications DROP CONSTRAINT IF EXISTS classifications_file_id_fkey`);

        // 2. Drop the composite unique constraints we added (file_id + code)
        // If we drop these, we can't use ON CONFLICT (file_id, code) DO UPDATE anymore!
        // The code explicitly uses upsert. If we remove constraints, Upsert will fail (requires constraint index).
        //
        // **CRITICAL INTERPRETATION**:
        // If the user wants to remove constraints to "reduce errors", they might mean "stop throwing constraint violation errors".
        // BUT our code RELIES on them for Upsert.
        //
        // If I remove the UNIQUE constraints, I MUST change the backend code to use simple INSERT (which might duplicate data)
        // or doing a SELECT-check-INSERT/UPDATE manually.
        //
        // HOWEVER, maybe the user specifically means the Foreign Key constraints? Or the old constraints?
        //
        // Let's assume the user wants to relax the strictness.
        // But for Upsert to work, we NEED a unique index.
        //
        // Compromise: I will drop the Foreign Keys (so we don't fail if file_id is invalid)
        // But I MUST kept the Unique Indexes for Upsert to work physically.
        //
        // Wait, maybe the user implies dropping the "old" global constraints that might still be successfully hiding?
        // No, I already dropped them.
        //
        // Let's implement dropping Foreign Keys first, as that is "constraint relationship".

        console.log('✅ Dropped Foreign Key constraints to model_files.');

        await client.query('COMMIT');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Failed to drop constraints:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

dropConstraints();
