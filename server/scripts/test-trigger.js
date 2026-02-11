
import { evaluateTriggers } from '../services/iot-trigger-service.js';
import { pool } from '../db/index.js';

async function test() {
    console.log('🧪 Testing IoT Triggers...');

    // Mock context
    const context = {
        fileId: 1, // Assumes model 1 exists
        spaceCode: 'ROOM-101'
    };

    // Mock data - forcing a high temperature
    const data = {
        temperature: 35.5,
        humidity: 60
    };

    console.log('📊 Mock Data:', data);

    try {
        await evaluateTriggers(data, context);
        console.log('✅ Trigger evaluation completed.');
    } catch (error) {
        console.error('❌ Trigger evaluation failed:', error);
    } finally {
        await pool.end();
    }
}

test();
