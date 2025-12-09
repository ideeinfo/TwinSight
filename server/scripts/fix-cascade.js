
import { query, closePool } from '../db/index.js';

const tables = ['assets', 'spaces', 'asset_specs'];

async function fixCascade() {
    try {
        console.log('🏁 Starting cascade fix...');

        for (const table of tables) {
            console.log(`\nChecking table: ${table}`);

            // 0. Clean up orphaned records
            const cleanSql = `DELETE FROM ${table} WHERE file_id IS NOT NULL AND file_id NOT IN (SELECT id FROM model_files)`;
            const cleanResult = await query(cleanSql);
            console.log(`- Cleaned ${cleanResult.rowCount} orphaned records from ${table}`);

            // 1. Find existing foreign key constraint on file_id
            const findSql = `
                SELECT tc.constraint_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_name = $1
                  AND kcu.column_name = 'file_id';
            `;

            const result = await query(findSql, [table]);

            if (result.rows.length > 0) {
                // Potential multiple constraints? (unlikely for same column but possible)
                for (const row of result.rows) {
                    const fkName = row.constraint_name;
                    console.log(`- Found FK constraint: ${fkName}`);

                    // Drop it
                    await query(`ALTER TABLE ${table} DROP CONSTRAINT "${fkName}"`);
                    console.log(`- Dropped constraint: ${fkName}`);
                }
            } else {
                console.log(`- No existing FK constraint found for file_id (will create one)`);
            }

            // 2. Add new constraint with ON DELETE CASCADE
            // We use a standardized name: {table}_file_id_fkey_cascade
            const newFkName = `${table}_file_id_fkey_cascade`;
            const alterSql = `
                ALTER TABLE ${table}
                ADD CONSTRAINT "${newFkName}"
                FOREIGN KEY (file_id)
                REFERENCES model_files(id)
                ON DELETE CASCADE;
            `;

            try {
                // Use a try-catch for adding in case it exists (though we dropped old ones)
                // If it already exists with this name (from previous run), it will fail, which is fine as long as we know it's cascade.
                // But we blindly proceed.
                await query(alterSql);
                console.log(`+ Added constraint: ${newFkName} (ON DELETE CASCADE)`);
            } catch (e) {
                if (e.message.includes('already exists')) {
                    console.log(`- Constraint ${newFkName} already exists.`);
                } else {
                    throw e;
                }
            }
        }

        console.log('\n✅ All constraints updated successfully.');

    } catch (err) {
        console.error('❌ Error fixing cascades:', err);
    } finally {
        await closePool();
    }
}

fixCascade();
