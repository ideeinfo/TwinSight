
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the target string (using a more flexible match)
const targetPart = '格式必须严格使用"文件名 [id: 文档ID]"';
const startIndex = content.indexOf(targetPart);

if (startIndex === -1) {
    console.error('未找到目标字符串!');
    process.exit(1);
}

// Find the complete line containing this text
const lineStart = content.lastIndexOf('(', startIndex);
const lineEnd = content.indexOf(')`', startIndex) + 2;

if (lineStart === -1 || lineEnd <= 2) {
    console.error('无法找到完整行边界!');
    process.exit(1);
}

const oldLine = content.substring(lineStart, lineEnd);
console.log('原文:', oldLine);

const newLine = '(请列出你在分析中引用的文档名称。系统会自动根据文档名称生成链接，无需添加ID标记。)`';

content = content.replace(oldLine, newLine);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ 已更新提示词指令');
