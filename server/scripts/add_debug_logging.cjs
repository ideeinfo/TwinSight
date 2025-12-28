
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the target line
const targetLine = "const metadataList = ragResult.sources[0].metadata;";
const insertIndex = content.indexOf(targetLine);

if (insertIndex === -1) {
    console.error('Could not find target line!');
    process.exit(1);
}

// Debug code to insert BEFORE the target line
const debugCode = `// ========== 调试输出：Open WebUI sources 原始数据结构 ==========
                console.log('\\n🔍 ========== Open WebUI sources 原始数据结构 ==========');
                console.log('📦 ragResult.sources 类型:', typeof ragResult.sources);
                console.log('📦 ragResult.sources 长度:', ragResult.sources.length);
                console.log('📦 ragResult.sources 完整内容:');
                console.log(JSON.stringify(ragResult.sources, null, 2));
                if (ragResult.sources[0]) {
                    console.log('📦 ragResult.sources[0] 的所有键:', Object.keys(ragResult.sources[0]));
                    if (ragResult.sources[0].metadata && ragResult.sources[0].metadata[0]) {
                        console.log('📦 metadata[0] 示例:', JSON.stringify(ragResult.sources[0].metadata[0], null, 2));
                    }
                }
                console.log('🔍 ========== End of sources debug ==========\\n');
                // ========== 调试输出结束 ==========

                `;

const newContent = content.substring(0, insertIndex) + debugCode + content.substring(insertIndex);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully added debug logging');
