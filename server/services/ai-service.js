/**
 * AI Service
 * Encapsulates logic for AI analysis, N8N workflows, and result formatting.
 */
import pool from '../db/index.js';
import * as timeseriesService from './timeseries-service.js';
import { chatWithRAG } from './openwebui-service.js';
import { getConfig } from './config-service.js';
import { server } from '../config/index.js';
import { loadSkills, generateSkillPrompt } from '../skills/skill-registry.js';

// Load Skills on Startup
let skillsPrompt = '';
(async () => {
    try {
        const skills = await loadSkills();
        skillsPrompt = generateSkillPrompt(skills);
        console.log(`🤖 AI 技能系统已加载 ${skills.length} 个技能`);
    } catch (e) {
        console.error('Failed to load skills:', e);
    }
})();

// Configuration
const USE_N8N_WORKFLOW = process.env.USE_N8N_WORKFLOW === 'true' || false;
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
const N8N_TEMPERATURE_WEBHOOK = process.env.N8N_TEMPERATURE_ALERT_WEBHOOK || '/webhook/temperature-alert';
// const N8N_MANUAL_WEBHOOK = process.env.N8N_MANUAL_ANALYSIS_WEBHOOK || '/webhook/manual-analysis';

const N8N_TEMPERATURE_ALERT_URL = `${N8N_BASE_URL}${N8N_TEMPERATURE_WEBHOOK}`;

/**
 * Get context data (Assets and Documents) for a given room.
 * @param {string} roomCode 
 * @param {string} roomName 
 * @param {number} fileId 
 * @returns {Promise<{assets: Array, documents: Array, searchPatterns: Array}>}
 */
async function getContextData(roomCode, roomName, fileId) {
    // 1. Query Assets (assoc with asset_specs for category)
    let assetsQueryKey = `
        SELECT a.asset_code, a.name, a.spec_code, a.floor, a.room, sp.category
        FROM assets a
        LEFT JOIN asset_specs sp ON a.spec_code = sp.spec_code AND (a.file_id = sp.file_id OR sp.file_id IS NULL)
        WHERE (a.room ILIKE $1 OR a.room ILIKE $2)
    `;
    const assetParams = [`%${roomCode}%`, `%${roomName || ''}%`];
    // Note: strict file_id filtering removed as per original code logic to avoid version mismatch issues

    const assetsResult = await pool.query(assetsQueryKey, assetParams);
    const assets = assetsResult.rows;

    const searchPatterns = [`%${roomCode}%`, `%${roomName || ''}%`];
    if (assets.length > 0) {
        const assetPatterns = assets
            .flatMap(a => [a.name])
            .filter(val => val && val.length > 2)
            .map(val => `%${val}%`);
        searchPatterns.push(...assetPatterns);
    }
    const assetCodes = assets.map(a => a.asset_code).filter(c => c);
    const specCodes = assets.map(a => a.spec_code).filter(c => c);

    // 2. Query Documents
    const docsParams = [`%${roomCode}%`, `%${roomName || ''}%`, searchPatterns];
    let queryParts = [];
    let paramCounter = 4;

    if (fileId) {
        docsParams.push(fileId);
        queryParts.push(`(d.space_code IS NOT NULL AND s.file_id = $${paramCounter})`);
        queryParts.push(`(d.asset_code IS NOT NULL AND a.file_id = $${paramCounter})`);
        queryParts.push(`(d.spec_code IS NOT NULL AND sp.file_id = $${paramCounter})`);
        paramCounter++;
    }

    let assetCodesIdx = 0;
    if (assetCodes.length > 0) {
        docsParams.push(assetCodes);
        assetCodesIdx = paramCounter;
        paramCounter++;
    }

    let specCodesIdx = 0;
    if (specCodes.length > 0) {
        docsParams.push(specCodes);
        specCodesIdx = paramCounter;
        paramCounter++;
    }

    let docsQuery = '';

    // Construct the query with correct parameter indices
    if (fileId) {
        docsQuery = `
            SELECT DISTINCT d.id, d.title, d.file_name, d.file_type, d.space_code, d.asset_code, d.spec_code
            FROM documents d
            LEFT JOIN spaces s ON d.space_code = s.space_code AND s.file_id = $4
            LEFT JOIN assets a ON d.asset_code = a.asset_code AND a.file_id = $4
            LEFT JOIN asset_specs sp ON d.spec_code = sp.spec_code AND sp.file_id = $4
            WHERE (
                (d.space_code ILIKE $1 OR d.space_code ILIKE $2)
                OR
                (d.file_name ILIKE ANY($3) OR d.title ILIKE ANY($3))
            )
            AND (
                ${queryParts.join(' OR ')}
            )
            ${assetCodesIdx > 0 ? `OR d.asset_code = ANY($${assetCodesIdx})` : ''}
            ${specCodesIdx > 0 ? `OR d.spec_code = ANY($${specCodesIdx})` : ''}
            AND d.file_name NOT ILIKE '%.jpg' 
            AND d.file_name NOT ILIKE '%.png'
            AND d.file_name NOT ILIKE '%.jpeg'
            AND d.file_name NOT ILIKE '%.gif'
            AND d.file_name NOT ILIKE '%.webp'
            LIMIT 20
        `;
    } else {
        docsQuery = `
            SELECT id, title, file_name, file_type, space_code, asset_code, spec_code
            FROM documents
            WHERE (
                space_code ILIKE $1 
                OR space_code ILIKE $2
                ${assetCodesIdx > 0 ? `OR asset_code = ANY($${assetCodesIdx})` : ''}
                ${specCodesIdx > 0 ? `OR spec_code = ANY($${specCodesIdx})` : ''}
                OR file_name ILIKE ANY($3)
                OR title ILIKE ANY($3)
            )
              AND file_name NOT ILIKE '%.jpg' 
              AND file_name NOT ILIKE '%.png'
              AND file_name NOT ILIKE '%.jpeg'
              AND file_name NOT ILIKE '%.gif'
              AND file_name NOT ILIKE '%.webp'
            LIMIT 20
        `;
    }

    const docsResult = await pool.query(docsQuery, docsParams);
    return { assets, documents: docsResult.rows, searchPatterns };
}

/**
 * Executes N8N Workflow for temperature alert.
 */
async function executeN8nWorkflow(params) {
    const { roomCode, roomName, temperature, threshold, alertType, fileId } = params;

    console.log(`📡 Sending request to N8N:`, { roomName, temperature });

    const n8nResponse = await fetch(N8N_TEMPERATURE_ALERT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomCode,
            roomName,
            temperature,
            threshold,
            alertType,
            fileId,
            apiBaseUrl: server.baseUrl
        })
    });

    if (!n8nResponse.ok) {
        throw new Error(`N8N webhook returned error: ${n8nResponse.status} ${n8nResponse.statusText}`);
    }

    const responseText = await n8nResponse.text();
    let n8nResult;
    try {
        n8nResult = JSON.parse(responseText);
    } catch (e) {
        console.error('❌ Failed to parse N8N response:', responseText.slice(0, 200));
        throw new Error(`Invalid JSON response from N8N: ${e.message}`);
    }

    console.log(`✅ N8N workflow executed successfully`);

    return {
        // We return the raw result + alert info, but we also include the context docs 
        // to help with formatting in the next step
        analysisText: n8nResult.analysis || (typeof n8nResult === 'string' ? n8nResult : ''),
        sourceIndexMap: n8nResult.sourceIndexMap || {},
        alert: n8nResult.alert
    };
}

/**
 * Executes Direct Open WebUI analysis for temperature alert.
 */
async function executeDirectAnalysis(params, context) {
    const { roomCode, roomName, temperature, threshold, alertType, fileId } = params;
    const { assets, documents: contextDocs, searchPatterns } = context;

    const alertTypeText = alertType === 'high' ? '高温' : '低温';

    // 1. Build Prompt
    const prompt = `你是一个建筑设施运维专家。请根据以下报警信息和上下文，提供运维建议。

**重要规则**：
1. **全程必须使用中文回答**。
2. **不要**输出你的思考过程、任务复述或英文摘要。
3. **不要**使用英文标题，必须严格按照下方的【输出格式】回答。

## 报警信息
- 房间：${roomName} (${roomCode})
- 当前温度：${temperature}°C
- 报警阈值：${threshold}°C
- 报警类型：${alertTypeText}报警

## 上下文信息
${assets.length > 0 ? `### 房间内设备\n${assets.map(a => `- ${a.name} (${a.asset_code}) [${a.category || '其它设备'}]`).join('\n')}` : '（无设备信息）'}

## 可用参考文档
${contextDocs && contextDocs.length > 0 ? contextDocs.map(d => `- ${d.file_name}`).join('\n') : '（无相关文档）'}

## 【输出格式】
请严格按照以下格式输出，不同层级使用不同编号样式和缩进：

### 1. 可能原因分析
（一级标题使用"### 数字."格式）
  1) 二级条目使用"数字)"格式，缩进2空格
    - 三级细节使用"- "格式，缩进4空格

### 2. 建议的处理步骤
  1) 第一步操作说明
    - 具体操作细节
    - 注意事项
  2) 第二步操作说明
    - 具体操作细节

### 3. 需要检查的设备
  1) 设备类型一
    - 设备名称 (编码)
  2) 设备类型二
    - 设备名称 (编码)

**注意**：请不要输出"参考的文档"部分，系统会自动根据你的引用生成。在正文中使用 [N] 格式引用文档即可（N为数字）。`;

    // 2. Resolve KB and File IDs
    let kbId = null;
    let fileIds = [];

    if (fileId) {
        try {
            // Get KB ID
            const kbResult = await pool.query(`SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1`, [fileId]);
            if (kbResult.rows.length > 0) {
                kbId = kbResult.rows[0].openwebui_kb_id;
            }

            // Get Open WebUI File IDs
            const assetCodes = assets.map(a => a.asset_code).filter(c => c);
            const specCodes = assets.map(a => a.spec_code).filter(c => c);

            const fileIdsParams = [`%${roomCode}%`, `%${roomName}%`, searchPatterns];
            if (assetCodes.length > 0) fileIdsParams.push(assetCodes);
            if (specCodes.length > 0) fileIdsParams.push(specCodes);

            const fileIdsQuery = `
                SELECT kbd.openwebui_file_id 
                FROM kb_documents kbd
                JOIN documents d ON kbd.document_id = d.id
                WHERE kbd.openwebui_file_id IS NOT NULL AND kbd.sync_status = 'synced'
                AND (
                    d.space_code ILIKE $1 OR d.space_code ILIKE $2 
                    ${assetCodes.length > 0 ? 'OR d.asset_code = ANY($4)' : ''}
                    ${specCodes.length > 0 ? 'OR d.spec_code = ANY($5)' : ''}
                    OR d.file_name ILIKE ANY($3) OR d.title ILIKE ANY($3)
                )
                LIMIT 20
            `;
            const fileIdsResult = await pool.query(fileIdsQuery, fileIdsParams);
            fileIds = fileIdsResult.rows.map(r => r.openwebui_file_id);
        } catch (e) {
            console.warn('⚠️ Error resolving KB/Files:', e.message);
        }
    }

    // 3. Call Open WebUI
    const llmModel = await getConfig('LLM_MODEL', 'gemini-2.0-flash');
    const ragResult = await chatWithRAG({
        prompt,
        kbId,
        fileIds,
        model: llmModel,
    });

    console.log(`✅ Direct Open WebUI RAG successful`);

    // 4. Extract Text
    let analysisText = '';
    if (ragResult.choices?.[0]?.message?.content) {
        analysisText = ragResult.choices[0].message.content;
    } else if (ragResult.message?.content) {
        analysisText = ragResult.message.content;
    } else if (typeof ragResult === 'string') {
        analysisText = ragResult;
    }

    // 5. Convert Open WebUI sources to a normalized sourceIndexMap
    const sourceIndexMap = {};
    if (ragResult.sources && Array.isArray(ragResult.sources)) {
        ragResult.sources.forEach((sourceItem, i) => {
            const idx = i + 1;
            const openwebuiFileId = sourceItem.source?.id || sourceItem.metadata?.[0]?.file_id;
            const name = sourceItem.metadata?.[0]?.name || sourceItem.metadata?.[0]?.source || `Source ${idx}`;

            if (openwebuiFileId) {
                sourceIndexMap[idx] = {
                    index: idx,
                    openwebuiFileId,
                    name,
                    fileName: name
                };
            }
        });
    }

    return {
        analysisText,
        sourceIndexMap,
        alert: params
    };
}

/**
 * Format the analysis result: link citations, resolve document IDs, and rebuild reference list.
 * This unifies logic for both N8N and Direct modes.
 * 
 * @param {string} analysisText - The raw markdown text
 * @param {object} sourceIndexMap - Map of index -> {openwebuiFileId, fileName, etc.}
 * @param {Array} contextDocs - Fallback context documents from database
 */
async function formatAnalysisResult(analysisText, sourceIndexMap, contextDocs = []) {
    let formattedText = analysisText || '';

    // Normalize citations: ][ -> , 
    formattedText = formattedText.replace(/\]\s*\[/g, ', ');

    // 1. Resolve Document IDs
    // Convert sourceIndexMap to Map for easier handling
    const indexMap = new Map(Object.entries(sourceIndexMap || {}).map(([k, v]) => [parseInt(k), v]));

    // Collect all needed Open WebUI File IDs to query local DB
    const openwebuiFileIds = [...indexMap.values()].map(v => v.openwebuiFileId).filter(Boolean);
    const docMap = new Map(); // localId -> doc info

    if (openwebuiFileIds.length > 0) {
        const docsResult = await pool.query(`
            SELECT d.id, d.title, d.file_name, d.file_type, kbd.openwebui_file_id
            FROM kb_documents kbd
            JOIN documents d ON kbd.document_id = d.id
            WHERE kbd.openwebui_file_id = ANY($1)
        `, [openwebuiFileIds]);

        for (const doc of docsResult.rows) {
            // Update items in indexMap that match this openwebuiFileId
            for (const [idx, info] of indexMap.entries()) {
                if (info.openwebuiFileId === doc.openwebui_file_id) {
                    info.docId = doc.id;
                    info.fileName = doc.file_name;
                    indexMap.set(idx, info);
                }
            }
            docMap.set(String(doc.id), doc);
        }
    }

    // 2. Fallback: Context Match
    // If sourceIndexMap entries are missing docId, try to match by name from contextDocs OR query DB by name
    const unresolvedIndices = [...indexMap.entries()].filter(([_, info]) => !info.docId).map(([k]) => k);

    if (unresolvedIndices.length > 0) {
        // First try context docs
        for (const idx of unresolvedIndices) {
            const info = indexMap.get(idx);
            const targetName = info.name || info.fileName;
            if (!targetName) continue;

            const match = contextDocs.find(d => d.file_name === targetName || d.title === targetName);
            if (match) {
                info.docId = match.id;
                info.fileName = match.file_name;
                indexMap.set(idx, info);
                docMap.set(String(match.id), match);
            }
        }

        // If still unresolved, maybe query DB by name? (Skipping for performance, relied on context in original)
    }

    // 3. Fallback: If no sources at all, use contextDocs populating 1..N
    if (indexMap.size === 0 && contextDocs.length > 0) {
        contextDocs.forEach((doc, i) => {
            const idx = i + 1;
            const info = {
                index: idx,
                docId: doc.id,
                fileName: doc.file_name,
                name: doc.title || doc.file_name,
                isContextFallback: true
            };
            indexMap.set(idx, info);
            docMap.set(String(doc.id), doc);
        });
    }

    // 4. Text Scanning for implicit references
    // If a document name appears in text but isn't in indexMap, add it
    let nextIndex = indexMap.size > 0 ? Math.max(...indexMap.keys()) + 1 : 1;
    const existingDocIds = new Set([...indexMap.values()].map(v => v.docId).filter(Boolean));

    for (const doc of contextDocs) {
        if (existingDocIds.has(doc.id)) continue;

        // Check if filename appears in text
        const baseName = doc.file_name.replace(/\.[^/.]+$/, '');
        const escapedName = doc.file_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const pattern = new RegExp(`(${escapedName}|${baseName.length >= 2 ? escapedBaseName : 'IMPOSSIBLE_MATCH'})`, 'i');

        if (pattern.test(formattedText)) {
            const info = {
                index: nextIndex,
                docId: doc.id,
                fileName: doc.file_name,
                name: doc.title,
                matchedBy: 'text_reference'
            };
            indexMap.set(nextIndex, info);
            docMap.set(String(doc.id), doc);
            nextIndex++;
            existingDocIds.add(doc.id);
        }
    }

    // 5. Replace Citations in Text with HTML spans

    // [source X]
    formattedText = formattedText.replace(/\[source\s*(\d+(?:\s*,\s*\d+)*)\]/gi, (match, nums) => {
        const indices = nums.split(/[,\s]+/).filter(n => n).map(n => parseInt(n));
        const linked = indices.map(idx => {
            const info = indexMap.get(idx);
            if (info && info.docId) {
                return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${idx}</span>`;
            }
            return String(idx);
        });
        return `[${linked.join(', ')}]`;
    });

    // [id: X] - Try docId first, then index
    formattedText = formattedText.replace(/\[id:?\s*(\d+(?:\s*,\s*\d+)*)\]/gi, (match, nums) => {
        const indices = nums.split(/[,\s]+/).filter(n => n).map(n => parseInt(n));
        const linked = indices.map(num => {
            if (docMap.has(String(num))) {
                const d = docMap.get(String(num));
                return `<span class="ai-doc-link" data-id="${num}" data-name="${d.file_name}">${num}</span>`;
            }
            if (num <= 50) {
                const info = indexMap.get(num);
                if (info && info.docId) {
                    return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${num}</span>`;
                }
            }
            return String(num);
        });
        return `[${linked.join(', ')}]`;
    });

    // [X] - Standard style
    formattedText = formattedText.replace(/(?<!\w)\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (match, nums) => {
        // Skip if inside a data-id attribute (simple check)
        if (formattedText.includes(match) && match.includes('data-id')) return match;

        const indices = nums.split(/[,\s]+/).filter(n => n).map(n => parseInt(n));
        const linked = indices.map(num => {
            const info = indexMap.get(num);
            if (info && info.docId) {
                return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${num}</span>`;
            }
            if (docMap.has(String(num))) {
                const d = docMap.get(String(num));
                return `<span class="ai-doc-link" data-id="${num}" data-name="${d.file_name}">${num}</span>`;
            }
            return String(num);
        });
        return `[${linked.join(', ')}]`;
    });

    // 6. Name Linking (for plain text appearances)
    for (const info of indexMap.values()) {
        if (!info.docId || !info.fileName) continue;
        const name = info.fileName;
        const baseName = name.replace(/\.[^/.]+$/, '');

        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let patternStr = `(${escapedName})`;
        if (baseName.length >= 2 && baseName !== name) {
            patternStr = `(${escapedName}|${escapedBaseName})`;
        }

        // Regex to match name BUT NOT matching inside HTML tags or existing brackets
        // This is simplified and not perfect but matches original logic
        const regex = new RegExp(`${patternStr}(?!\\s*\\[|[^<]*>)`, 'gi');

        // Note: Replacing in a simplified way can break attributes if names are common words.
        // Original code did this. We will apply cautiously.
        // To be safe, we only replace if not preceded by data-name=" or similar.

        formattedText = formattedText.replace(regex, (m) => {
            return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${m}</span>`;
        });
    }

    // 7. Rebuild Reference Section
    formattedText = formattedText.replace(/\n*### 4\. 参考的文档[\s\S]*$/i, '');
    formattedText = formattedText.replace(/\n*\*\*?参考的文档\*\*?[\s\S]*$/i, '');

    // Identify actually cited IDs
    const citedDocIds = new Set();
    const spanRegex = /<span class="ai-doc-link" data-id="(\d+)"/g;
    let m;
    while ((m = spanRegex.exec(formattedText)) !== null) {
        citedDocIds.add(m[1]);
    }

    const uniqueDocs = new Map();
    for (const [idx, info] of indexMap.entries()) {
        if (!info.docId) continue;
        // Optional: Only include cited? Or all? 
        // Original code: "uniqueDocs.get(info.docId).indices.push(idx);"
        // We usually list all provided sources if relevant, but let's stick to "cited or forced fallback" logic
        // If it was a context fallback or text reference, we definitely want it.
        const isImplicit = info.isContextFallback || info.matchedBy === 'text_reference';

        if (citedDocIds.has(String(info.docId)) || isImplicit) {
            if (!uniqueDocs.has(info.docId)) {
                uniqueDocs.set(info.docId, {
                    docId: info.docId,
                    fileName: info.fileName,
                    indices: []
                });
            }
            uniqueDocs.get(info.docId).indices.push(idx);
        }
    }

    const sortedDocs = [...uniqueDocs.values()].sort((a, b) => Math.min(...a.indices) - Math.min(...b.indices));

    const sources = sortedDocs.map(d => ({
        name: d.file_name || d.fileName,
        fileName: d.file_name || d.fileName,
        url: `/api/documents/${d.docId}/preview`,
        downloadUrl: `/api/documents/${d.docId}/download`,
        docId: d.docId
    }));

    if (sortedDocs.length > 0) {
        let refSection = '\n\n### 4. 参考的文档\n';
        sortedDocs.forEach(d => {
            const minIndex = Math.min(...d.indices);
            refSection += `[${minIndex}] <span class="ai-doc-link" data-id="${d.docId}" data-name="${d.fileName}">${d.fileName}</span>\n`;
        });
        formattedText += refSection;
    }

    return { analysis: formattedText, sources };
}

/**
 * Process temperature alert (Main Entry Point)
 */
async function processTemperatureAlert(params) {
    const { roomCode, roomName, fileId } = params;

    // 1. Get Context
    let context = { assets: [], documents: [], searchPatterns: [] };
    try {
        context = await getContextData(roomCode, roomName, fileId);
    } catch (e) {
        console.warn('Could not get context data:', e);
    }

    let resultRaw;

    if (USE_N8N_WORKFLOW) {
        resultRaw = await executeN8nWorkflow(params);
    } else {
        resultRaw = await executeDirectAnalysis(params, context);
    }

    // 2. Format
    const { analysis, sources } = await formatAnalysisResult(resultRaw.analysisText, resultRaw.sourceIndexMap || {}, context.documents);

    return {
        analysis,
        sources,
        alert: { ...params }
    };
}

/**
 * Process Manual Analysis (Asset/Room + Question)
 */
async function processManualAnalysis(params) {
    const { type, target, question, fileId } = params;
    const roomCode = type === 'room' ? target.code : target.room;
    const roomName = type === 'room' ? target.name : target.roomName; // Assuming target has roomName or we need to fetch it

    // 1. Context
    let context = { assets: [], documents: [], searchPatterns: [] };
    try {
        if (roomCode) {
            context = await getContextData(roomCode, roomName || '', fileId);
        }
    } catch (e) {
        console.warn('Could not get context data:', e);
    }

    // 2. Build Prompt
    const prompt = `你是一个建筑设施运维专家。请根据以下信息和上下文，回答用户的问题。

**重要规则**：
1. **全程必须使用中文回答**。
2. **不要**输出你的思考过程。

## 分析对象
- 类型：${type === 'room' ? '房间' : '设备'}
- 名称：${target.name} (${target.code || target.asset_code})
- 附加信息：${JSON.stringify(target)}
${question ? `\n## 用户问题\n${question}` : ''}

## 上下文信息
${context.assets.length > 0 ? `### 房间内设备\n${context.assets.map(a => `- ${a.name} (${a.asset_code}) [${a.category || '其它设备'}]`).join('\n')}` : '（无设备信息）'}

## 参考文档
${context.documents && context.documents.length > 0 ? context.documents.map(d => `- ${d.file_name}`).join('\n') : '（无相关文档）'}

## 【输出格式】
请提供简洁、专业的分析或回答。如果涉及操作步骤，请分步骤说明。请引用参考文档（使用 [N] 格式）。`;

    // 3. Resolve KB/Files (similar to directAnalysis)
    let kbId = null;
    let fileIds = [];
    if (fileId) {
        try {
            const kbResult = await pool.query(`SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1`, [fileId]);
            if (kbResult.rows.length > 0) kbId = kbResult.rows[0].openwebui_kb_id;

            // Get File IDs from context documents that are synced
            const assetCodes = context.assets.map(a => a.asset_code).filter(c => c);
            // Reuse similar query logic or just rely on what we found in context if we want to be faster
            // Let's use specific query for accurate OpenWebUI File IDs
            const fileIdsQuery = `
                SELECT kbd.openwebui_file_id 
                FROM kb_documents kbd
                JOIN documents d ON kbd.document_id = d.id
                WHERE kbd.openwebui_file_id IS NOT NULL AND kbd.sync_status = 'synced'
                AND (d.space_code ILIKE $1 OR d.space_code ILIKE $2 OR d.file_name ILIKE ANY($3))
                LIMIT 20
             `;
            const fileIdsResult = await pool.query(fileIdsQuery, [`%${roomCode}%`, `%${roomName}%`, context.searchPatterns]);
            fileIds = fileIdsResult.rows.map(r => r.openwebui_file_id);
        } catch (e) { console.warn('KB lookup failed', e); }
    }

    // 4. Call RAG
    const llmModel = await getConfig('LLM_MODEL', 'gemini-2.0-flash');
    const ragResult = await chatWithRAG({
        prompt,
        kbId,
        fileIds,
        model: llmModel,
    });

    // 5. Extract & Format
    let analysisText = '';
    if (ragResult.choices?.[0]?.message?.content) analysisText = ragResult.choices[0].message.content;
    else if (ragResult.message?.content) analysisText = ragResult.message.content;
    else if (typeof ragResult === 'string') analysisText = ragResult;

    const sourceIndexMap = {};
    if (ragResult.sources && Array.isArray(ragResult.sources)) {
        ragResult.sources.forEach((sourceItem, i) => {
            const idx = i + 1;
            const openwebuiFileId = sourceItem.source?.id || sourceItem.metadata?.[0]?.file_id;
            const name = sourceItem.metadata?.[0]?.name || sourceItem.metadata?.[0]?.source || `Source ${idx}`;
            if (openwebuiFileId) {
                sourceIndexMap[idx] = { index: idx, openwebuiFileId, name, fileName: name };
            }
        });
    }

    const { analysis, sources } = await formatAnalysisResult(analysisText, sourceIndexMap, context.documents);

    return {
        success: true,
        result: { analysis, sources }
    };
}

/**
 * Parse AI Response for Action Blocks
 */
function parseAIResponse(content) {
    if (!content) return { content: '', actions: undefined };

    // Regex for ```action ... ``` blocks
    const actionRegex = /```action\s*([\s\S]*?)\s*```/g;
    let match;
    let actions = [];
    let cleanContent = content;

    while ((match = actionRegex.exec(content)) !== null) {
        try {
            // Remove the block from content
            cleanContent = cleanContent.replace(match[0], '');

            // Parse JSON
            const jsonStr = match[1].trim();
            actions.push(JSON.parse(jsonStr));
        } catch (e) {
            console.warn('Failed to parse AI action block:', e);
        }
    }

    return {
        content: cleanContent.trim(),
        actions: actions.length > 0 ? actions : undefined
    };
}

/**
 * Process General Chat Request
 * @param {object} params - { message, context, fileId, history }
 */
async function processChat(params) {
    const { message, context, fileId } = params;

    // 1. Context Data Retrieval
    let contextData = { assets: [], documents: [] };
    let roomCode = '';
    let roomName = '';

    if (context) {
        if (context.type === 'space') {
            roomCode = context.properties.code || context.name; // Fallback
            roomName = context.properties.name || context.name;
        } else if (context.type === 'asset') {
            const props = context.properties || {};
            // If asset has room info, use it to get broader context
            if (props.room) roomCode = props.room;
            // Also store asset code for specific filtering
        }

        if (fileId && roomCode) {
            try {
                contextData = await getContextData(roomCode, roomName, fileId);
            } catch (e) {
                console.warn('Chat context retrieval failed', e);
            }
        }
    }

    // 2. Build Prompt (System Instruction)
    let systemInstruction = `你是一个智能建筑运维助手。
当前关注对象：${context ? `${context.type === 'asset' ? '设备' : '空间'} - ${context.name}` : '未指定对象'}
${context?.properties ? `属性摘要：${JSON.stringify(context.properties).slice(0, 500)}...` : ''}

规则：
1. 请根据上下文信息和参考文档回答用户问题。
2. 回答要简洁、专业，使用中文。
3. 如果引用了文档，请自然地在文中标记（如 [1]）。

能力增强：
你可以查询历史温度数据。若用户询问温度趋势或历史数据（如“最近一周温度”、“昨天最高温”），请不要回答无法获取，而是输出以下 JSON 指令：
@@TOOL_CALL:get_temperature:{"roomCode": "从上下文获取的编码", "duration": "时长(如 24h, 7d)"}@@
注意：只输出指令，不要包含其他文字。`;

    // Inject Skills Prompt
    if (skillsPrompt) {
        systemInstruction += `\n\n${skillsPrompt}`;
    }

    // 3. Construct Messages List
    const messages = [];
    messages.push({ role: 'system', content: systemInstruction });

    const { history } = params;
    if (history && Array.isArray(history)) {
        // Simple sanitation: only keep valid roles and content
        history.forEach(h => {
            if (['user', 'assistant'].includes(h.role) && h.content) {
                // Remove sources/charts from history content if needed, but basic text is fine
                // OpenWebUI usually handles markdown history fine
                messages.push({ role: h.role, content: h.content });
            }
        });
    }

    messages.push({ role: 'user', content: message });

    // 4. Resolve KB & Files
    let kbId = null;
    let fileIds = [];

    if (fileId) {
        try {
            const kbResult = await pool.query('SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1', [fileId]);
            if (kbResult.rows.length > 0) kbId = kbResult.rows[0].openwebui_kb_id;

            // Resolve File IDs from Context Documents (documents that are synced)
            if (contextData.documents.length > 0) {
                const docIds = contextData.documents.map(d => d.id);
                const fileIdsResult = await pool.query(`
                   SELECT openwebui_file_id FROM kb_documents 
                   WHERE document_id = ANY($1) AND openwebui_file_id IS NOT NULL AND sync_status = 'synced'
               `, [docIds]);
                fileIds = fileIdsResult.rows.map(r => r.openwebui_file_id);
            }
        } catch (e) {
            console.warn('Chat KB resolution failed', e);
        }
    }

    // 5. Call RAG
    const llmModel = await getConfig('LLM_MODEL', 'gemini-2.0-flash');
    const ragResult = await chatWithRAG({
        messages, // Use messages array for multi-turn
        kbId,
        fileIds, // Focus on context docs
        model: llmModel
    });

    // 5. Extract & Format
    let analysisText = '';
    // Handle different response structures
    if (ragResult.choices?.[0]?.message?.content) analysisText = ragResult.choices[0].message.content;
    else if (ragResult.message?.content) analysisText = ragResult.message.content;
    else if (typeof ragResult === 'string') analysisText = ragResult;

    // 6. Check for Tool Calls
    let chartData = null;
    const toolMatch = analysisText.match(/@@TOOL_CALL:get_temperature:([\s\S]*?)@@/);

    if (toolMatch) {
        console.log('🔧 Detect Tool Call:', toolMatch[1]);
        try {
            const args = JSON.parse(toolMatch[1]);
            const durationStr = args.duration || '24h';
            let rCode = args.roomCode || roomCode; // Use arg or fallback to context
            // Clean roomCode: remove " [ID]" suffix if present
            if (rCode) {
                rCode = rCode.replace(/\s*\[.*?\]$/, '').trim();
            }

            // 智能房间匹配：如果指定的房间没有数据，尝试自动查找
            try {
                const availableRooms = await timeseriesService.getAvailableRooms(24);
                console.log(`🔍 Available Rooms: ${availableRooms.join(', ')} (Target: ${rCode})`);

                if (availableRooms.length > 0) {
                    if (!rCode || !availableRooms.includes(rCode)) {
                        // 尝试模糊匹配
                        const match = availableRooms.find(r => r.includes(rCode) || (rCode && rCode.includes(r)));
                        if (match) {
                            console.log(`-> Fuzzy matched: ${rCode} => ${match}`);
                            rCode = match;
                        } else {
                            // 如果完全匹配不上，且没有指定 specific room (或者 context 是 generic 的)
                            // 回退到第一个可用房间，或者全部显示？
                            // 这里简单回退到第一个，并告知用户
                            console.log(`-> No match found. Fallback to first available: ${availableRooms[0]}`);
                            rCode = availableRooms[0];
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to get available rooms', err);
            }

            if (rCode) {
                // Parse duration
                const durationMatch = durationStr.match(/(\d+)([dh])/);
                let durationMs = 24 * 3600 * 1000;
                if (durationMatch) {
                    const val = parseInt(durationMatch[1]);
                    const unit = durationMatch[2];
                    durationMs = unit === 'd' ? val * 24 * 3600 * 1000 : val * 3600 * 1000;
                }

                const endMs = Date.now();
                const startMs = endMs - durationMs;

                // Determine aggregation
                let aggregateWindow = '1h';
                if (durationMs > 7 * 24 * 3600 * 1000) aggregateWindow = '1d';
                else if (durationMs <= 24 * 3600 * 1000) aggregateWindow = '15m';

                // Execute Queries
                const points = await timeseriesService.queryTemperatureRange(rCode, startMs, endMs, aggregateWindow);
                const stats = await timeseriesService.getTemperatureStats(rCode, startMs, endMs);

                // Generate Chart Data (Native Format for ChartPanel.vue)
                if (points.length > 0) {
                    chartData = {
                        type: 'temperature',
                        data: points, // { timestamp, value }
                        range: { startMs, endMs },
                        title: `${rCode} 温度趋势`,
                        roomCode: rCode // Add metadata for external link
                    };
                }

                // Call LLM again with data
                messages.push({ role: 'assistant', content: analysisText }); // The tool call message
                messages.push({
                    role: 'user',
                    content: `系统：已执行工具调用 (实际查询房间: ${rCode})。
数据统计：Min: ${stats.min?.toFixed(1)}°C, Max: ${stats.max?.toFixed(1)}°C, Avg: ${stats.avg?.toFixed(1)}°C.
数据点数：${stats.count}.
请根据以上数据回答用户问题（如描述趋势、异常等），并告知已生成图表 (显示房间: ${rCode})。
注意：请直接输出回答，**禁止**输出任何思考过程或“用户询问...”之类的分析。`
                });

                const secondRagResult = await chatWithRAG({
                    messages,
                    kbId,
                    fileIds,
                    model: llmModel
                });

                if (secondRagResult.choices?.[0]?.message?.content) analysisText = secondRagResult.choices[0].message.content;
                else if (secondRagResult.message?.content) analysisText = secondRagResult.message.content;
            } else {
                analysisText = "无法执行查询：未找到房间编码 (Room Code)。";
            }
        } catch (e) {
            console.error('Tool execution failed', e);
            analysisText += `\n(系统：数据查询失败 - ${e.message})`;
        }
    }

    // 7. Parse Actions (New Skill System)
    const { content: cleanContent, actions } = parseAIResponse(analysisText);

    const sourceIndexMap = {};
    if (ragResult.sources && Array.isArray(ragResult.sources)) {
        ragResult.sources.forEach((sourceItem, i) => {
            const idx = i + 1;
            const openwebuiFileId = sourceItem.source?.id || sourceItem.metadata?.[0]?.file_id;
            const name = sourceItem.metadata?.[0]?.name || sourceItem.metadata?.[0]?.source || `Source ${idx}`;
            if (openwebuiFileId) {
                sourceIndexMap[idx] = { index: idx, openwebuiFileId, name, fileName: name };
            }
        });
    }

    const { analysis, sources } = await formatAnalysisResult(cleanContent, sourceIndexMap, contextData.documents);

    return {
        role: 'assistant',
        content: analysis,
        sources: sources,
        chartData: chartData,
        actions: actions, // Return parsed actions
        timestamp: Date.now()
    };
}

export default {
    getContextData,
    processTemperatureAlert,
    processManualAnalysis,
    processChat,
    formatAnalysisResult,
    USE_N8N_WORKFLOW
};
