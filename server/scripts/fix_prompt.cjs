
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the document listing format (remove [id: X])
const oldDocFormat = "context.documents.map(d => `- ${d.file_name} [id: ${d.id}]`).join('\\n')";
const newDocFormat = "context.documents.map(d => `- ${d.file_name}`).join('\\n')";

if (content.includes(oldDocFormat)) {
    content = content.replace(oldDocFormat, newDocFormat);
    console.log('✅ 已移除文档列表中的 [id: X] 格式');
} else {
    console.log('⚠️ 未找到文档列表格式，可能已更新');
}

// Find and replace the instruction for reference documents
const oldInstruction = '(重要：请只引用上述"可用参考文档"中列出的文件，格式必须严格使用"文件名 [id: 文档ID]"。如果无法确定，请不要列出任何文档。)';
const newInstruction = '(请列出你在分析中引用的文档名称。注意：系统会自动根据文档名称生成链接，你只需列出文件名即可，无需添加任何ID标记。)';

if (content.includes(oldInstruction)) {
    content = content.replace(oldInstruction, newInstruction);
    console.log('✅ 已更新参考文档格式说明');
} else {
    console.log('⚠️ 未找到参考文档格式说明，可能已更新');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('完成！');
