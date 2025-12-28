
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Target string (part of the old code)
const targetString = `console.log('🎨 格式化 HTML 链接 (Pattern 2)...');
            analysisText = analysisText.replace(/\\[id:?\\s*([0-9,\\s]+)\\]/g, (match, idsContent) => {
                // 拆分 ID
                const ids = idsContent.split(/[,，\\s]+/).filter(i => i);
                
                // 构建替换后的 HTML
                // 形式: [id: <link>1</link>, <link>13</link>]
                const linkedIds = ids.map(id => {
                    const doc = docMap.get(String(id));
                    if (doc) {
                        return \`<span class="ai-doc-link" data-id="\${id}" data-name="\${doc.file_name || doc.title}">\${id}</span>\`;
                    }
                    return id;
                });
                
                return \`[id: \${linkedIds.join(', ')}]\`;
            });`;

// New code
const newCode = `console.log('🎨 格式化 HTML 链接 (Pattern 2 - 独立 ID)...');
            // 这个正则会匹配 HTML 标签 OR [id: ...]
            // 如果匹配到 HTML 标签，原样返回；如果匹配到 [id: ...]，则处理
            analysisText = analysisText.replace(/(<a[^>]*>.*?<\/a>|<span[^>]*>.*?<\/span>)|(\\[id:?\\s*([0-9,\\s]+)\\])/gi, (match, htmlTag, idGroup, idsContent) => {
                if (htmlTag) return match; // 如果是 HTML 标签（包括刚才生成的 span），跳过
                if (!idGroup) return match;
                
                // 处理 [id: 1, 2]
                const ids = idsContent.split(/[,，\\s]+/).filter(i => i);
                const linkedIds = ids.map(id => {
                    const doc = docMap.get(String(id));
                    if (doc) {
                        return \`<span class="ai-doc-link" data-id="\${id}" data-name="\${doc.file_name || doc.title}">\${id}</span>\`;
                    }
                    return id;
                });
                return \`[id: \${linkedIds.join(', ')}]\`;
            });`;

// Normalize line endings for matching
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetString.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
    const newContent = normalizedContent.replace(normalizedTarget, newCode);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully updated ai-analysis.js');
} else {
    console.error('Target string not found!');
    // Fallback: Try simplified matching if exact block fails
    const simplifiedTarget = "console.log('🎨 格式化 HTML 链接 (Pattern 2)...');";
    if (normalizedContent.includes(simplifiedTarget)) {
        console.log('Found simplified target, attempting manual splice...');
        // This is risky without strict bounds, but let's see.
        // Actually, let's just error out and let the agent know.
    }
}
