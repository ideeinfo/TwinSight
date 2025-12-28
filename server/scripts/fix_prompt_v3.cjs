
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Target the specific problematic text
const oldText = '(重要：请只引用上述"可用参考文档"中列出的文件，格式必须严格使用"文件名 [id: 文档ID]"。如果无法确定，请不要列出任何文档。)';
const newText = '(请列出你在分析中引用的文档名称。系统会自动生成链接，无需添加ID标记。)';

if (content.includes(oldText)) {
    content = content.replace(oldText, newText);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 已更新提示词指令');
} else {
    // Try to find partial match
    const partial = '格式必须严格使用"文件名';
    if (content.includes(partial)) {
        console.log('找到部分匹配，尝试定位...');
        const idx = content.indexOf(partial);
        console.log('位置:', idx);
        console.log('上下文:', content.substring(idx - 50, idx + 100));
    } else {
        console.log('⚠️ 未找到目标文本，可能编码不同。检查原始内容...');
        // Search for line 163 content
        const lines = content.split('\n');
        for (let i = 160; i < 170 && i < lines.length; i++) {
            console.log(`Line ${i + 1}:`, lines[i].substring(0, 80));
        }
    }
}
