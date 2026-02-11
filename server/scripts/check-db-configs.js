
import { query } from '../db/index.js';

async function checkConfigs() {
    console.log('--- Checking DB Configs ---');

    // 1. system_config
    const sc = await query("SELECT config_key, config_value FROM system_config WHERE config_key IN ('N8N_WEBHOOK_URL', 'USE_N8N')");
    console.log('System Configs:');
    sc.rows.forEach(r => console.log(`- ${r.config_key}: ${r.config_value}`));

    // 2. iot_triggers
    const triggers = await query("SELECT id, name, analysis_engine, enabled FROM iot_triggers");
    console.log('\nIoT Triggers:');
    triggers.rows.forEach(r => console.log(`- [${r.id}] ${r.name}: engine=${r.analysis_engine}, enabled=${r.enabled}`));

    process.exit(0);
}

checkConfigs().catch(err => {
    console.error(err);
    process.exit(1);
});
