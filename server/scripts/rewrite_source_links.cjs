
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the start of Pattern 10 section
const pattern10Start = "            // 10. [格式化] 格式化分析结果中的文档引用为 HTML 链接";
const startIndex = content.indexOf(pattern10Start);

if (startIndex === -1) {
    console.error('Could not find Pattern 10 start marker!');
    process.exit(1);
}

// Find the end - it should be just before "} catch (sourceError) {"
const catchBlock = "        } catch (sourceError) {";
const endIndex = content.indexOf(catchBlock);

if (endIndex === -1) {
    console.error('Could not find catch block!');
    process.exit(1);
}

// New code for Pattern 10 - handles [source X] format
const newPattern10 = `            // 10. [格式化] 格式化分析结果中的 [source X] 引用为 HTML 链接
            // Open WebUI 返回的 AI 文本使用 [source X] 格式引用，其中 X 是 sources 数组的 1-indexed 索引
            console.log('🎨 格式化 [source X] 引用为 HTML 链接...');
            console.log('   可用 sources:', sources.map((s, i) => \`\${i+1}: \${s.name}\`).join(', '));

            // 匹配 [source 1] 或 [source 1, source 9, source 11] 格式
            analysisText = analysisText.replace(/\\[source\\s*([0-9,\\s]+|[0-9]+(?:,\\s*source\\s*[0-9]+)*)\\]/gi, (match) => {
                // 提取所有数字
                const numbers = match.match(/\\d+/g);
                if (!numbers || numbers.length === 0) return match;

                const linkedSources = numbers.map(numStr => {
                    const index = parseInt(numStr, 10) - 1; // 1-indexed to 0-indexed
                    if (index >= 0 && index < sources.length) {
                        const source = sources[index];
                        // 从 source.url 提取 document ID
                        const urlMatch = source.url.match(/\\/documents\\/(\\d+)\\//);
                        const docId = urlMatch ? urlMatch[1] : null;
                        
                        if (docId) {
                            return \`<span class="ai-doc-link" data-id="\${docId}" data-name="\${source.fileName || source.name}">\${numStr}</span>\`;
                        }
                    }
                    return numStr; // 如果找不到对应的 source，保持原样
                });

                return \`[source \${linkedSources.join(', ')}]\`;
            });

`;

const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const newContent = before + newPattern10 + after;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully rewrote citation logic for [source X] format');
