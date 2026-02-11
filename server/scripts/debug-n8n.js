// Native fetch is available in Node.js v18+

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node debug-n8n.js <N8N_URL> <API_KEY>');
    console.log('Example: node debug-n8n.js https://n8n.example.com "your-api-key"');
    process.exit(1);
}

const [n8nUrl, apiKey] = args;
const baseUrl = n8nUrl.replace(/\/$/, '');

async function debugN8n() {
    console.log(`📡 Connecting to ${baseUrl}...`);

    try {
        // 1. Check current user (Validate API Key)
        console.log('\n--- 1. Testing Auth & User ---');
        const userRes = await fetch(`${baseUrl}/api/v1/users`, {
            headers: { 'X-N8N-API-KEY': apiKey }
        });

        if (!userRes.ok) {
            console.error(`❌ Auth Failed: ${userRes.status} ${userRes.statusText}`);
            console.log(await userRes.text());
            return;
        }
        const userData = await userRes.json();
        console.log('✅ Auth Success. Users found:', userData.data.length);

        // 2. Fetch Workflows
        console.log('\n--- 2. Fetching Workflows ---');
        const wfUrl = `${baseUrl}/api/v1/workflows?active=true`; // We only care about active ones
        // const wfUrl = `${baseUrl}/api/v1/workflows`; // Fetch all to debug

        const wfRes = await fetch(wfUrl, {
            headers: { 'X-N8N-API-KEY': apiKey }
        });

        if (!wfRes.ok) {
            console.error(`❌ Fetch Workflows Failed: ${wfRes.status}`);
            return;
        }

        const wfData = await wfRes.json();
        const workflows = wfData.data;
        console.log(`✅ Found ${workflows.length} active workflows.`);

        // 3. Analyze Nodes
        console.log('\n--- 3. Analyzing Trigger Nodes ---');

        let validCount = 0;

        workflows.forEach(w => {
            console.log(`\nWorkflow: [${w.id}] "${w.name}" (Active: ${w.active})`);

            if (!w.nodes || w.nodes.length === 0) {
                console.log('   ⚠️ No nodes found in workflow object.');
                return;
            }

            const triggerNodes = w.nodes.filter(n => n.type.includes('webhook') || n.type.includes('trigger'));

            if (triggerNodes.length === 0) {
                console.log('   ❌ No Webhook/Trigger nodes found.');
                // Print all node types to help debug
                const allTypes = w.nodes.map(n => n.type).join(', ');
                console.log(`   (Node Types: ${allTypes})`);
            } else {
                triggerNodes.forEach(n => {
                    const isWebhook = n.type === 'n8n-nodes-base.webhook';
                    const icon = isWebhook ? '✅' : '❓';
                    console.log(`   ${icon} Found Node: "${n.name}" (Type: ${n.type})`);

                    if (isWebhook) {
                        const path = n.parameters?.path;
                        const method = n.parameters?.httpMethod || 'GET';
                        console.log(`      Path: ${path}, Method: ${method}`);
                        validCount++;
                    } else {
                        console.log(`      ⚠️ This is not 'n8n-nodes-base.webhook'. Backend strictly checks for this type.`);
                    }
                });
            }
        });

        console.log('\n--- Summary ---');
        console.log(`Backend would accept ${validCount} out of ${workflows.length} workflows.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

debugN8n();
