
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../routes/ai-analysis.js');
let content = fs.readFileSync(filePath, 'utf8');

// The duplicate block is:
//                 return `[id: ${linkedIds.join(', ')}]`;
//             });
//
//                 return `[id: ${linkedIds.join(', ')}]`;
//             });

// We want to keep just one instance.
// Let's find the FIRST occurrence of the closing sequence for Pattern 2.
// Pattern 2 regex starts with `analysisText.replace(/(<a[^>]*>.*?<\/a>|<span[^>]*>.*?<\/span>)|(\\[id:?\\s*([0-9,\\s]+)\\])/gi`

const startMarker = "analysisText.replace(/(<a[^>]*>.*?<\\/a>|<span[^>]*>.*?<\\/span>)|(\\[id:?\\s*([0-9,\\s]+)\\])/gi";
const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
    console.error('Could not find Pattern 2 start marker!');
    process.exit(1);
}

// Find the closure of this block.
// It ends with `});`
// But we have duplicates. The file likely looks like:
// ... }); 
// ... return ... });

// Let's look for "});" starting from startIndex.
const firstEndIndex = content.indexOf('});', startIndex);

if (firstEndIndex === -1) {
    console.error('Could not find end of block!');
    process.exit(1);
}

// The clean file should continue with the comments about 10.2 / notes.
// Actually, looking at the previous `view_file` output:
// 612:             });
// 613: 
// 614:                 return `[id: ${linkedIds.join(', ')}]`;
// 615:             });
// 616: 
// 617:             // 注意：上面的 10.2 会再次处理...

// We want to cut from `firstEndIndex + 3` (length of "});") until... checks for next valid content?
// Ideally, line 617 starts with `            // 注意：`
// Let's find the start of the next comment block.
const nextSection = "            // 注意：上面的";
const nextSectionIndex = content.indexOf(nextSection);

if (nextSectionIndex === -1) {
    // Maybe it's further down or slight mismatch.
    console.log('Next section marker not found, using simple cut.');
    // Just replace the duplicate string pattern globally? No, dangerous.

    // Let's try to remove the specific duplicate text.
    const badText = `
                return \`[id: \${linkedIds.join(', ')}]\`;
            });`;

    // If we find TWO occurrences close to each other...
    // Let's manually slice.
    // We keep up to `firstEndIndex + 3`.
    // Then we want to skip until `nextSectionIndex` if found, or just inspect.

    console.log('Manual intervention needed if automated marker missing.');
    process.exit(1);
}

// We want to keep everything before `firstEndIndex + 3`
// AND everything from `nextSectionIndex` onwards.
// The garbage is in between.

const before = content.substring(0, firstEndIndex + 3);
const after = content.substring(nextSectionIndex);

const cleanContent = before + '\n\n' + after;

fs.writeFileSync(filePath, cleanContent, 'utf8');
console.log('Successfully cleaned ai-analysis.js');
