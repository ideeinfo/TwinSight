
import pg from 'pg';
const { Client } = pg;

// 从 .env.local 提取的配置
const config = {
    host: '192.168.2.183',
    port: 5432,
    database: 'twinsight',
    user: 'postgres',
    password: 'password'
};

const client = new Client(config);

async function run() {
    try {
        await client.connect();
        console.log('Connected to DB');

        // Check available file_ids
        const resFiles = await client.query('SELECT DISTINCT file_id, count(*) FROM rds_objects GROUP BY file_id');
        console.log('File IDs present:', resFiles.rows);

        const fileId = 6; // Keep 6 for now

        // 1. Check mc_code stats
        const resMc = await client.query('SELECT count(*) FROM rds_objects WHERE file_id = $1 AND mc_code IS NOT NULL AND mc_code != \'\'', [fileId]);
        console.log('Objects with valid mc_code:', resMc.rows[0].count);

        const resTotal = await client.query('SELECT count(*) FROM rds_objects WHERE file_id = $1', [fileId]);
        console.log('Total Objects:', resTotal.rows[0].count);

        const resAsp = await client.query(`
            SELECT count(*) FROM rds_aspects a 
            JOIN rds_objects o ON a.object_id = o.id 
            WHERE o.file_id = $1
        `, [fileId]);
        console.log('Total Aspects:', resAsp.rows[0].count);

        // 2. 检查特定节点 =TA001 (虚拟节点) by Name
        const resTA001Name = await client.query(`
            SELECT id, name, object_type, ref_code FROM rds_objects 
            WHERE file_id = $1 AND name = '=TA001'
        `, [fileId]);
        console.log('=TA001 Object (Name search):', resTA001Name.rows);

        // 4. Check for System Objects (Virtual Nodes)
        const resSystem = await client.query(`
            SELECT id, name, ref_code, object_type FROM rds_objects 
            WHERE file_id = $1 AND object_type = 'system'
        `, [fileId]);
        console.log('System Objects Found:', resSystem.rows.length);
        if (resSystem.rows.length > 0) console.log(resSystem.rows[0]);

        // 5. Check "Switch" details
        const resSwitches = await client.query(`
            SELECT id, name, ref_code, object_type, metadata FROM rds_objects 
            WHERE file_id = $1 AND name LIKE '%一位单控暗开关%'
        `, [fileId]);
        console.log('Switches Found Count:', resSwitches.rows.length);
        if (resSwitches.rows.length > 0) {
            console.log('Sample Switch:', resSwitches.rows[0]);
        }



    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
