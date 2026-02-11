
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. 加载环境变量 (与 server/config/index.js 保持一致)
const rootEnvPath = join(__dirname, '../../.env');
const localEnvPath = join(__dirname, '../../.env.local');

if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
}
if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath, override: true });
}

// 2. 动态导入数据库连接
const dbConfigPath = join(__dirname, '../config/database.js');
let query;

async function runMigrations() {
    console.log('🚀 开始检查数据库迁移...');

    try {
        const dbModule = await import(pathToFileURL(dbConfigPath).href);
        query = dbModule.query;
    } catch (err) {
        console.error('❌ 无法加载数据库配置:', err);
        process.exit(1);
    }

    try {
        // 3. 确保迁移记录表存在
        await query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. 读取迁移文件
        const migrationsDir = join(__dirname, '../migrations');
        if (!fs.existsSync(migrationsDir)) {
            console.log('⚠️ 迁移目录不存在，跳过。');
            process.exit(0);
        }

        const files = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // 确保按顺序执行 (001, 002, ...)

        // 5. 获取已执行的迁移
        const { rows: executedRows } = await query('SELECT name FROM _migrations');
        const executedNames = new Set(executedRows.map(r => r.name));

        // 6. 遍历并执行未运行的脚本
        let runCount = 0;
        for (const file of files) {
            if (!executedNames.has(file)) {
                console.log(`⏳ 正在执行迁移: ${file}...`);
                const filePath = join(migrationsDir, file);
                const sql = readFileSync(filePath, 'utf8');

                // 使用事务确保原子性
                try {
                    await query('BEGIN');
                    await query(sql);
                    await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
                    await query('COMMIT');
                    console.log(`✅ 成功执行: ${file}`);
                    runCount++;
                } catch (err) {
                    await query('ROLLBACK');
                    console.error(`❌ 迁移脚本 ${file} 执行失败:`, err);
                    // 在生产环境中，迁移失败应该阻止启动
                    process.exit(1);
                }
            }
        }

        if (runCount === 0) {
            console.log('✨ 没有新的迁移需要执行。');
        } else {
            console.log(`🎉 成功执行了 ${runCount} 个迁移脚本。`);
        }

        // 成功完成，不退出进程，让后续命令继续运行（如果是 && 连接）
        // 或者显式退出0
        process.exit(0);

    } catch (error) {
        console.error('❌ 迁移过程发生致命错误:', error);
        process.exit(1);
    }
}

runMigrations();
