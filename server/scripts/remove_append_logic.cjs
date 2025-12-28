
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find and remove section 8 (append documents to end)
const startMarker = "            // 8. [新增] 将未出现在文本中的来源补充到"参考的文档"部分";
const endMarker = "            // 9. [新增] 自动为文中出现的纯文件名";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('无法找到目标区块!');
    console.log('startMarker found:', startIndex !== -1);
    console.log('endMarker found:', endIndex !== -1);
    process.exit(1);
}

// Remove the section (from startMarker to just before endMarker)
const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const newContent = before + after;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('✅ 已移除"补充文档到末尾"逻辑');
