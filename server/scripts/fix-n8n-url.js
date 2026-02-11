
import { query } from '../db/index.js';

async function updateConfig() {
    console.log('--- Updating N8N_WEBHOOK_URL ---');

    const key = 'N8N_WEBHOOK_URL';
    const newValue = 'https://n8n.twinsight.cn';

    try {
        // Check current value
        const current = await query('SELECT config_value FROM system_config WHERE config_key = $1', [key]);
        if (current.rows.length > 0) {
            console.log(`Current value: ${current.rows[0].config_value}`);
        } else {
            console.log('Key not found, will insert.');
        }

        // Update
        const res = await query(`
            INSERT INTO system_config (config_key, config_value, description)
            VALUES ($1, $2, 'n8n Webhook Base URL')
            ON CONFLICT (config_key) 
            DO UPDATE SET config_value = $2, updated_at = NOW()
            RETURNING *
        `, [key, newValue]);

        console.log(`Updated value: ${res.rows[0].config_value}`);
        console.log('✅ Configuration updated successfully.');

    } catch (err) {
        console.error('❌ Error updating config:', err);
        process.exit(1);
    }
    process.exit(0);
}

updateConfig();
