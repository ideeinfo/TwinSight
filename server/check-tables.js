import { query } from './db/index.js';

async function checkTables() {
    try {
        // 检查assets表主键
        const assetsPK = await query(`
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = 'assets'::regclass AND i.indisprimary
        `);
        console.log('Assets表主键:', assetsPK.rows.map(r => r.attname));

        // 检查spaces表主键
        const spacesPK = await query(`
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = 'spaces'::regclass AND i.indisprimary
        `);
        console.log('Spaces表主键:', spacesPK.rows.map(r => r.attname));

        // 检查asset_specs表主键
        const specsPK = await query(`
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = 'asset_specs'::regclass AND i.indisprimary
        `);
        console.log('Asset_specs表主键:', specsPK.rows.map(r => r.attname));

        process.exit(0);
    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

checkTables();
