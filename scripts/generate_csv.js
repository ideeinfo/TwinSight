import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '../public/data/room_temperatures.csv');

// Configuration
const DAYS = 30; // Generate data for last 30 days
const INTERVAL_MINUTES = 60; // Data every hour
const BASE_TEMP = 25;
const NUM_ROOMS = 50; // Generate data for 50 rooms

// Special rooms offset
const HIGH_LOAD_OFFSET = 3; // +3 degrees for Pump/Power rooms
// Let's say indices 0, 1, 2 are special rooms
const SPECIAL_INDICES = [0, 1, 2];

function generateData() {
    const data = [];
    // Header: timestamp, Room_0, Room_1, ... Room_49
    const headers = ['timestamp'];
    for (let i = 0; i < NUM_ROOMS; i++) {
        headers.push(`Room_${i}`);
    }
    data.push(headers.join(','));

    const now = new Date();
    const start = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000);

    let current = new Date(start);
    while (current <= now) {
        const timestamp = current.toISOString();
        const row = [timestamp];

        const hour = current.getHours();
        // Daily cycle: coldest at 4am, hottest at 4pm
        const dailyVariation = Math.sin(((hour - 4) / 24) * 2 * Math.PI) * 3;

        for (let i = 0; i < NUM_ROOMS; i++) {
            const isSpecial = SPECIAL_INDICES.includes(i);
            const roomOffset = (Math.random() - 0.5) * 0.5; // Slight unique offset per room per timestamp
            const noise = (Math.random() - 0.5) * 1;

            let val = BASE_TEMP + dailyVariation + noise + roomOffset;

            if (isSpecial) {
                val += HIGH_LOAD_OFFSET;
            }

            row.push(val.toFixed(2));
        }

        data.push(row.join(','));

        // Increment
        current = new Date(current.getTime() + INTERVAL_MINUTES * 60 * 1000);
    }

    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, data.join('\n'));
    console.log(`Generated ${data.length} rows with ${NUM_ROOMS} columns to ${OUTPUT_FILE}`);
}

generateData();
