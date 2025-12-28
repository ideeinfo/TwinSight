
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// The unique anchor to start the replacement
const anchor = "console.log('🎨 格式化 HTML 链接 (Pattern 2)...');";
const startIndex = content.indexOf(anchor);

if (startIndex === -1) {
    console.error('Could not find anchor string!');
    process.exit(1);
}

// Find the end of this block.
const endIndex = content.indexOf('});', startIndex);
if (endIndex === -1) {
    console.error('Could not find end of block!');
    process.exit(1);
}

const oldBlockEnd = endIndex + 3;

const newCodeBlock = `console.log('🎨 格式化 HTML 链接 (Pattern 2 - 独立 ID)...');
            // 这个正则会匹配 HTML 标签 OR [id: ...]
            // 如果匹配到 HTML 标签，原样返回；如果匹配到 [id: ...]，则处理
            analysisText = analysisText.replace(/(<a[^>]*>.*?<\\/a>|<span[^>]*>.*?<\\/span>)|(\\[id:?\\s*([0-9,\\s]+)\\])/gi, (match, htmlTag, idGroup, idsContent) => {
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

const before = content.substring(0, startIndex);
const after = content.substring(oldBlockEnd);

const newContent = before + newCodeBlock + after;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully patched ai-analysis.js');
