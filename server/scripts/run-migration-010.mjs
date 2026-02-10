/**
 * Run IoT Triggers Migration on Remote Database
 * 
 * Usage: node run-migration-010.mjs
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local'), override: true });

// 远程数据库配置 (192.168.2.183)
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: '192.168.2.183',
    database: process.env.DB_NAME || 'twinsight',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
};

console.log(`🔌 Connecting to database at ${dbConfig.host}:${dbConfig.port}...`);

const pool = new Pool(dbConfig);

const migrationFile = path.join(__dirname, '../migrations/010_iot_triggers.sql');

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log(`📄 Reading migration file: ${migrationFile}`);
        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log('🚀 Executing migration...');
        await client.query('BEGIN');

        // Split and execute statements
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        for (const stmt of statements) {
            await client.query(stmt);
        }

        // Remove global USE_N8N config if exists
        console.log('🗑️ Removing legacy USE_N8N config...');
        await client.query("DELETE FROM system_config WHERE config_key = 'USE_N8N'");

        await client.query('COMMIT');
        console.log('✅ Migration 010_iot_triggers completed successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
