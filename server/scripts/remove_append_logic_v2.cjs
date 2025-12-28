
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Use English markers that should be more reliable
const startMarker = "// 8. [";
const endMarker = "// 9. [";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Cannot find markers!');
    console.log('startMarker found:', startIndex !== -1);
    console.log('endMarker found:', endIndex !== -1);

    // Debug: show line content around line 412-415
    const lines = content.split('\n');
    for (let i = 410; i < 420 && i < lines.length; i++) {
        console.log(`Line ${i + 1}:`, lines[i].substring(0, 60));
    }
    process.exit(1);
}

// Remove the section (from startMarker to just before endMarker)
const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const newContent = before + after;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully removed append logic');
