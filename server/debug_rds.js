
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

        const fileId = 6; // Based on user context

        // 1. 检查总数
        const resObj = await client.query('SELECT count(*) FROM rds_objects WHERE file_id = $1', [fileId]);
        console.log('Total Objects:', resObj.rows[0].count);

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

        // 3. 检查特定节点 "电气系统" by Name
        const resElecName = await client.query(`
            SELECT id, name, object_type, ref_code FROM rds_objects 
            WHERE file_id = $1 AND name LIKE '%电气系统%'
        `, [fileId]);
        console.log('Electrical System Object (Name search):', resElecName.rows);


    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
