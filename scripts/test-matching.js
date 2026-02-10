
import { matchFileName } from '../server/services/document-matching-service.js';
import pool, { query } from '../server/db/index.js';

// Mock DB interactions for testing without side effects if possible, 
// but since the service uses the actual DB, we will run read-only queries.
// We will insert some temp data for testing and rollback or delete it.

async function testMatching() {
    console.log('🧪 Starting Document Matching Test...');

    // 1. Prepare Test Data
    console.log('📝 Preparing test data...');
    try {
        await query('BEGIN');

        // Insert Test Asset (Use format matching 'AHU-001')
        await query("DELETE FROM assets WHERE asset_code = 'TESTUNIQUE-001'");
        await query(`
            INSERT INTO assets (asset_code, name, floor, room) 
            VALUES ('TESTUNIQUE-001', 'Test Unique Asset', 'F1', 'R101')
        `);

        // Insert Test Asset for Fuzzy (Name based)
        await query("DELETE FROM assets WHERE asset_code = 'FUZZY-ASSET-001'");
        await query(`
            INSERT INTO assets (asset_code, name, floor, room) 
            VALUES ('FUZZY-ASSET-001', 'SpecialHandlingUnit', 'F1', 'R101')
        `);

        // Insert Test Space
        await query("DELETE FROM spaces WHERE space_code = 'B1-U01'"); // Matches Space Regex
        await query(`
            INSERT INTO spaces (space_code, name) 
            VALUES ('B1-U01', 'UniqueMeetingSpot')
        `);

    } catch (err) {
        console.error('Failed to setup test data:', err);
        process.exit(1);
    }

    // 2. Test Cases
    const testCases = [
        {
            filename: 'TESTUNIQUE-001_Report.pdf',
            desc: 'Exact Code Match',
            expectedType: 'asset',
            expectedCode: 'TESTUNIQUE-001'
        },
        {
            filename: 'SpecialHandlingUnit_Doc.docx',
            desc: 'Fuzzy Name Match (Full Name in filename)',
            expectedType: 'asset',
            expectedCode: 'FUZZY-ASSET-001'
        },
        {
            filename: 'Photo_of_UniqueMeetingSpot.jpg',
            desc: 'Fuzzy Name Match (Full Name in filename)',
            expectedType: 'space',
            expectedCode: 'B1-U01'
        },
        {
            filename: 'Random_File_Name_XYZ.txt',
            desc: 'No Match',
            expectedType: null,
            expectedCode: null
        }
    ];

    let passed = 0;

    for (const test of testCases) {
        console.log(`\n----------------------------------------`);
        console.log(`Case: ${test.desc}`);
        console.log(`File: ${test.filename}`);

        try {
            const matches = await matchFileName(test.filename);

            if (matches.length > 0) {
                console.log('Matches found:', matches.map(m => `${m.type}:${m.code} (${m.confidence}%)`).join(', '));
                const best = matches[0];

                if (test.expectedType === null) {
                    console.error('❌ Expected NO match, but got matches.');
                } else if (best.code === test.expectedCode && best.type === test.expectedType) {
                    console.log('✅ Passed');
                    passed++;
                } else {
                    console.error(`❌ Failed. Expected ${test.expectedType}:${test.expectedCode}, got ${best.type}:${best.code}`);
                }
            } else {
                console.log('No matches found.');
                if (test.expectedType === null) {
                    console.log('✅ Passed');
                    passed++;
                } else {
                    console.error(`❌ Failed. Expected match for ${test.expectedCode}, but found none.`);
                }
            }
        } catch (err) {
            console.error('Error running match:', err);
        }
    }

    // 3. Cleanup
    try {
        await query('ROLLBACK'); // Rollback test data
        console.log('\n🧹 Test data rolled back.');
    } catch (err) {
        console.error('Failed to rollback:', err);
    }

    // 4. Summary
    console.log(`\n📊 Result: ${passed}/${testCases.length} Passed`);

    // Close pool to exit script
    await pool.end();
}

testMatching();
