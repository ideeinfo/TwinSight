
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Explicitly load .env from server dir BEFORE other imports
dotenv.config({ path: join(__dirname, '../.env') });

async function testInsert() {
    try {
        // 2. Dynamic import
        const { createDocument } = await import('../models/document.js');
        const { query } = await import('../config/database.js');

        // 1. Get a valid view ID first
        const viewRes = await query('SELECT id FROM views LIMIT 1');
        if (viewRes.rows.length === 0) {
            console.error('No views found to test with.');
            process.exit(1);
        }
        const viewId = viewRes.rows[0].id;
        console.log('Testing with View ID:', viewId);

        // 2. Try insert
        const doc = {
            title: 'Test Pano',
            fileName: 'test.jpg',
            filePath: '/docs/test.jpg',
            fileSize: 1000,
            fileType: 'image/jpeg',
            mimeType: 'image/jpeg',
            assetCode: null,
            spaceCode: null,
            specCode: null,
            viewId: viewId // Testing integer pass
        };

        console.log('Inserting document:', doc);
        const res = await createDocument(doc);
        console.log('✅ Insert successful, ID:', res.id);

        // Cleanup
        await query('DELETE FROM documents WHERE id = $1', [res.id]);

        process.exit(0);
    } catch (e) {
        console.error('💥 Insert Failed:', e);
        process.exit(1);
    }
}

testInsert();
