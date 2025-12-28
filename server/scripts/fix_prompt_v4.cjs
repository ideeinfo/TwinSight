
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Use regex to match the problematic line
// Looking for: (重要：...格式必须严格使用"文件名 [id: 文档ID]"...)`
const regex = /\(重要：请只引用上述"可用参考文档"中列出的文件.*?文档ID\]".*?不要列出任何文档。\)/gs;

const matches = content.match(regex);
if (matches) {
    console.log('找到匹配:', matches[0].substring(0, 50) + '...');
    content = content.replace(regex, '(请列出你在分析中引用的文档名称。系统会自动生成链接，无需添加ID标记。)');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 已更新提示词指令');
} else {
    console.log('⚠️ 正则未匹配，尝试简化匹配...');

    // Try simpler regex
    const simpleRegex = /\[id:\s*文档ID\]/g;
    if (content.match(simpleRegex)) {
        console.log('找到 [id: 文档ID] 格式');
    }

    // Just match "格式必须严格使用"
    if (content.includes('格式必须严格使用')) {
        console.log('找到"格式必须严格使用"');
        // Find the line and replace the whole instruction
        content = content.replace(
            /\(重要[：:].*?格式必须严格使用.*?\)/gs,
            '(请列出你在分析中引用的文档名称。系统会自动生成链接。)'
        );
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('✅ 已更新提示词指令 (简化匹配)');
    } else {
        console.log('⚠️ 完全无法匹配');
    }
}
