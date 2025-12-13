/**
 * 创建 document_exif 表
 */
import db from './db/index.js';

async function createDocumentExifTable() {
    try {
        console.log('正在创建 document_exif 表...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS document_exif (
                id SERIAL PRIMARY KEY,
                document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                
                -- 文件组 (File)
                date_time TIMESTAMP,
                image_width INTEGER,
                image_height INTEGER,
                
                -- 照相机组 (Camera)
                equip_model VARCHAR(255),
                f_number DECIMAL(5,2),
                exposure_time VARCHAR(50),
                iso_speed INTEGER,
                focal_length DECIMAL(10,2),
                
                -- GPS组
                gps_longitude DECIMAL(12,8),
                gps_latitude DECIMAL(11,8),
                gps_altitude DECIMAL(10,2),
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE(document_id)
            )
        `);

        // 创建索引
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_document_exif_document_id 
            ON document_exif(document_id)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_document_exif_date_time 
            ON document_exif(date_time)
        `);

        console.log('✅ document_exif 表创建成功！');

        // 验证表结构
        const result = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'document_exif'
            ORDER BY ordinal_position
        `);

        console.log('\n表结构:');
        result.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ 创建表失败:', error.message);
        process.exit(1);
    }
}

createDocumentExifTable();
