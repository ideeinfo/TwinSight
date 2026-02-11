
import { query } from '../db/index.js';
import { getConfig } from '../services/config-service.js';
import { evaluateTriggers } from '../services/iot-trigger-service.js';

async function main() {
    console.log('--- Debugging n8n Trigger ---');

    // 1. Check Configuration
    const n8nUrl = await getConfig('N8N_WEBHOOK_URL');
    console.log(`Config N8N_WEBHOOK_URL: ${n8nUrl}`);

    // 2. Check Triggers
    const res = await query('SELECT * FROM iot_triggers');
    console.log(`Found ${res.rows.length} triggers:`);
    res.rows.forEach(t => {
        console.log(`- [${t.id}] ${t.name} (Enabled: ${t.enabled})`);
        console.log(`  Condition: ${t.condition_field} ${t.condition_operator} ${t.condition_value}`);
        console.log(`  Engine: ${t.analysis_engine}`);
        console.log(`  Webhook: ${t.n8n_webhook_path}`);
    });

    // 3. Simulate Low Temp
    // Find a low temp trigger or just send data that SHOULD trigger it
    console.log('\n--- Simulating Data (Should Trigger Low Temp) ---');
    const data = {
        temperature: 5,
        humidity: 50
    };
    const context = {
        fileId: 'debug-file-id',
        spaceCode: 'ROOM-DEBUG'
    };

    console.log('Input Data:', data);
    try {
        await evaluateTriggers(data, context);
    } catch (e) {
        console.error('Error during evaluation:', e);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
