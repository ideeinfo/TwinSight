
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the start of section 6 (sources processing)
const section6Start = "        // 6. 从 Open WebUI 返回的 sources 字段提取真实引用的文档";
const startIndex = content.indexOf(section6Start);

if (startIndex === -1) {
    console.error('Could not find section 6 start!');
    process.exit(1);
}

// Find the start of section 7 (text scanning)
const section7Start = "            // 7. [新增] 文本扫描：检查分析文本中是否提到了上下文中的文档";
const endIndex = content.indexOf(section7Start);

if (endIndex === -1) {
    console.error('Could not find section 7 start!');
    process.exit(1);
}

// New code for section 6
const newSection6 = `        // 6. 从 Open WebUI 返回的 sources 字段提取真实引用的文档
        // 重构：每个 ragResult.sources[i] 代表一个被引用的文档
        // AI 使用 [source 1] 格式引用，其中 1 对应 sources[0] (1-indexed)
        let sources = [];
        let sourceIndexMap = new Map(); // Map<sourceIndex (1-indexed), {docId, docName, url}>

        try {
            if (ragResult.sources && Array.isArray(ragResult.sources) && ragResult.sources.length > 0) {
                console.log(\`📚 Open WebUI 返回 \${ragResult.sources.length} 个引用来源\`);

                for (let i = 0; i < ragResult.sources.length; i++) {
                    const sourceItem = ragResult.sources[i];
                    const sourceIndex = i + 1; // 1-indexed for AI citations
                    
                    // 获取 Open WebUI 文件 ID (UUID)
                    const openwebuiFileId = sourceItem.source?.id || 
                                            (sourceItem.metadata?.[0]?.file_id);
                    const docName = sourceItem.metadata?.[0]?.name || 
                                    sourceItem.metadata?.[0]?.source || 
                                    \`Source \${sourceIndex}\`;

                    console.log(\`  → [source \${sourceIndex}] \${docName} (UUID: \${openwebuiFileId || 'N/A'})\`);

                    if (!openwebuiFileId) {
                        console.log(\`    ⚠️ 无 Open WebUI 文件 ID，跳过\`);
                        continue;
                    }

                    // 通过 openwebui_file_id 查找本地文档
                    const matchResult = await pool.query(\`
                        SELECT d.id, d.title, d.file_name, d.file_path, d.file_type
                        FROM kb_documents kbd
                        JOIN documents d ON kbd.document_id = d.id
                        WHERE kbd.openwebui_file_id = $1
                        LIMIT 1
                    \`, [openwebuiFileId]);

                    if (matchResult.rows.length > 0) {
                        const doc = matchResult.rows[0];
                        const sourceInfo = {
                            index: sourceIndex,
                            docId: doc.id,
                            name: doc.title || doc.file_name,
                            fileName: doc.file_name,
                            url: \`/api/documents/\${doc.id}/preview\`,
                            downloadUrl: \`/api/documents/\${doc.id}/download\`,
                            fileType: doc.file_type,
                            openwebuiFileId: openwebuiFileId
                        };
                        
                        sources.push(sourceInfo);
                        sourceIndexMap.set(sourceIndex, sourceInfo);
                        console.log(\`    ✅ 匹配成功: \${doc.file_name} (本地ID: \${doc.id})\`);
                    } else {
                        console.log(\`    ⚠️ 未在 kb_documents 中找到匹配: \${openwebuiFileId}\`);
                    }
                }

                console.log(\`📎 共解析 \${sources.length} 个有效文档来源\`);
                console.log('📋 sourceIndexMap:', [...sourceIndexMap.entries()].map(([k, v]) => \`\${k}=>\${v.docId}\`).join(', '));
            } else {
                console.log('⚠️ Open WebUI 未返回 sources 字段或为空');
            }

`;

const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const newContent = before + newSection6 + after;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully refactored sources processing');
