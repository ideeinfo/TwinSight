
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update prompt to remove "4. 参考的文档" section
// Find and replace the output format section
const oldOutputFormat = `## 【输出格式】

### 1. 可能原因分析
(请用中文分析...)

### 2. 建议的处理步骤
(请用中文列出步骤...)

### 3. 需要检查的设备
(请列出设备名称和编码...)

### 4. 参考的文档
(请列出你在分析中引用的文档名称。系统会自动生成链接。)`;

const newOutputFormat = `## 【输出格式】

### 1. 可能原因分析
(请用中文分析...)

### 2. 建议的处理步骤
(请用中文列出步骤...)

### 3. 需要检查的设备
(请列出设备名称和编码...)

**注意**：请不要输出"参考的文档"部分，系统会自动根据你的引用生成。在正文中使用 [N] 格式引用文档即可（N为数字）。`;

if (content.includes(oldOutputFormat)) {
    content = content.replace(oldOutputFormat, newOutputFormat);
    console.log('✅ 已更新提示词，移除"参考的文档"输出要求');
} else {
    console.log('⚠️ 未找到完整的输出格式模板，尝试部分匹配...');
    // Try partial match
    if (content.includes('### 4. 参考的文档')) {
        // Replace just this section
        content = content.replace(
            /### 4\. 参考的文档[\s\S]*?系统会自动生成链接。\)/,
            '**注意**：请不要输出"参考的文档"部分，系统会自动根据你的引用生成。在正文中使用 [N] 格式引用文档即可（N为数字）。'
        );
        console.log('✅ 已更新提示词（部分匹配）');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done updating prompt!');
