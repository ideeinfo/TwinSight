
import db from '../db/index.js';

async function performLinkage() {
    const client = await db.connect();
    try {
        console.log('🔗 Linking Unlinked Power Nodes to Objects by Name...');

        await client.query('BEGIN');

        // Find unlinked nodes
        const unlinkedNodes = await client.query(`
            SELECT id, label 
            FROM rds_power_nodes 
            WHERE object_id IS NULL
        `);

        let updatedCount = 0;

        for (const node of unlinkedNodes.rows) {
            const label = node.label.trim();
            if (!label) continue;

            // Try to find matching object
            // Priority: Exact match > Ignore space match > Like match
            const objRes = await client.query(`
                SELECT id, name, bim_guid 
                FROM rds_objects 
                WHERE name = $1 OR name = $2
                ORDER BY CASE WHEN name = $1 THEN 1 ELSE 2 END
                LIMIT 1
            `, [label, label.replace(/\s+/g, '')]);

            if (objRes.rows.length > 0) {
                const objectId = objRes.rows[0].id;

                // Update node
                await client.query(`
                    UPDATE rds_power_nodes 
                    SET object_id = $1 
                    WHERE id = $2
                `, [objectId, node.id]);

                process.stdout.write('.');
                updatedCount++;
            }
        }

        await client.query('COMMIT');
        console.log(`\n✅ Successfully linked ${updatedCount} nodes.`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Failed:', err);
    } finally {
        client.release();
        process.exit();
    }
}

performLinkage();
