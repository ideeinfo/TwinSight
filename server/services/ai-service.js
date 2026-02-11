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

import fs from 'fs';
import path from 'path';

// ... imports ...

const LOG_FILE = path.join(process.cwd(), 'ai-debug.log');

function logToFile(message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
    console.log(message, data || '');
}

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
            .flatMap(a => [a.name, a.asset_code])
            .filter(val => val && val.length > 2)
            .map(val => `%${val}%`);
        searchPatterns.push(...assetPatterns);
    }
    const assetCodes = assets.map(a => a.asset_code).filter(c => c);
    const specCodes = assets.map(a => a.spec_code).filter(c => c);

    // 2. Query Text Documents (PDF, DOCX, etc.) — excludes images
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

    // Construct the text-document query (with image filter restored)
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

    // 3. Query Photos — one per asset code, matching room assets
    let photoRows = [];
    if (assetCodes.length > 0) {
        const photoQuery = `
            SELECT DISTINCT ON (asset_code) id, title, file_name, file_type, space_code, asset_code, spec_code
            FROM documents
            WHERE asset_code = ANY($1)
              AND file_name ~* '\\.(jpg|jpeg|png|gif|webp)$'
            ORDER BY asset_code, id
            LIMIT 30
        `;
        const photoResult = await pool.query(photoQuery, [assetCodes]);
        photoRows = photoResult.rows;
    }

    // Merge: docs first, then photos (dedup by id)
    const seenIds = new Set(docsResult.rows.map(r => r.id));
    const mergedDocs = [...docsResult.rows];
    for (const photo of photoRows) {
        if (!seenIds.has(photo.id)) {
            mergedDocs.push(photo);
            seenIds.add(photo.id);
        }
    }

    return { assets, documents: mergedDocs, searchPatterns };
}

/**
 * Executes N8N Workflow for temperature alert.
 */
async function executeN8nWorkflow(params) {
    const { roomCode, roomName, temperature, threshold, alertType, fileId } = params;

    logToFile(`📡 Sending request to N8N:`, { roomName, temperature, fileId });

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

    logToFile(`✅ N8N workflow executed successfully. Result keys:`, Object.keys(n8nResult));
    if (n8nResult.sourceIndexMap) {
        logToFile(`🔍 N8N SourceIndexMap:`, n8nResult.sourceIndexMap);
    } else {
        logToFile(`⚠️ N8N response missing sourceIndexMap`);
    }

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
    logToFile('🚀 Entering executeDirectAnalysis', { params });
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
    // Dynamic Model Selection
    let llmModel = await getConfig('LLM_MODEL', '');
    if (!llmModel) {
        try {
            const models = await import('./openwebui-service.js').then(m => m.getAvailableModels());
            if (models && models.length > 0) {
                // Priority: defined in env > gpt > gemini > llama > first available
                const preferred = models.find(m => m.id.includes('gpt')) ||
                    models.find(m => m.id.includes('gemini')) ||
                    models.find(m => m.id.includes('llama')) ||
                    models[0];
                llmModel = preferred.id;
                console.log(`🤖 Auto-selected model: ${llmModel}`);
            }
        } catch (e) {
            console.warn('Failed to auto-discover models:', e.message);
        }
    }
    // Fallback if discovery fails
    if (!llmModel) llmModel = 'gemini-2.0-flash';

    const ragResult = await chatWithRAG({
        prompt,
        kbId,
        fileIds,
        model: llmModel,
    });

    console.log(`✅ Direct Open WebUI RAG successful`);

    // 4. Extract Text
    let analysisText = '';

    if (!ragResult) {
        logToFile('❌ Direct RAG returned null or undefined');
        throw new Error('AI Service returned no response');
    }

    // Log the structure for debugging if it seems empty/malformed
    if (!ragResult.choices && !ragResult.message && typeof ragResult !== 'string') {
        logToFile('⚠️ Unexpected RAG result structure:', ragResult);
    }

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

    logToFile('🔍 [AI Service] Resolve IDs:', {
        indices: [...indexMap.keys()],
        openwebuiFileIds,
        contextDocsCount: contextDocs.length
    });

    const docMap = new Map(); // localId -> doc info

    if (openwebuiFileIds.length > 0) {
        const docsResult = await pool.query(`
            SELECT d.id, d.title, d.file_name, d.file_type, kbd.openwebui_file_id
            FROM kb_documents kbd
            JOIN documents d ON kbd.document_id = d.id
            WHERE kbd.openwebui_file_id = ANY($1)
        `, [openwebuiFileIds]);

        logToFile(`🔍 [AI Service] DB Looked up ${docsResult.rows.length} docs from ${openwebuiFileIds.length} OpenWebUI IDs`);

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
        docId: d.docId,
        id: d.docId // Alias for frontend compatibility
    }));

    // 8. Renumber Citations in Text
    const renumberMap = new Map();
    sortedDocs.forEach((d, newIdx) => {
        const newNumber = newIdx + 1;
        d.indices.forEach(oldIdx => {
            renumberMap.set(oldIdx, newNumber);
        });
    });

    formattedText = formattedText.replace(/<span class="ai-doc-link"([^>]*)>(\d+)<\/span>/g, (match, attrs, oldNumStr) => {
        const oldNum = parseInt(oldNumStr);
        if (renumberMap.has(oldNum)) {
            const newNum = renumberMap.get(oldNum);
            return `<span class="ai-doc-link"${attrs}>${newNum}</span>`;
        }
        return match;
    });

    if (sortedDocs.length > 0) {
        // We no longer append the reference section to the text
        // because the frontend now displays sources using the AISourceList component.
        // The inline citations [n] are still preserved in the text.

        /* refSection removed
        let refSection = '\n\n### 4. 参考的文档\n';
        sortedDocs.forEach(d => {
            const minIndex = Math.min(...d.indices);
            refSection += `[${minIndex}] <span class="ai-doc-link" data-id="${d.docId}" data-name="${d.fileName}">${d.fileName}</span>\n`;
        });
        formattedText += refSection;
        */
    }

    return { analysis: formattedText, sources };
}

/**
 * Process temperature alert (Main Entry Point)
 */
async function processTemperatureAlert(params) {
    logToFile('🔥 processTemperatureAlert CALLED', params);
    const { roomCode, roomName, fileId } = params;

    try {
        // 1. Get Context
        let context = { assets: [], documents: [], searchPatterns: [] };
        try {
            context = await getContextData(roomCode, roomName, fileId);
            logToFile('✅ Context retrieved', {
                assetCount: context.assets.length,
                docCount: context.documents.length
            });
        } catch (e) {
            logToFile('⚠️ Could not get context data:', e.message);
            console.warn('Could not get context data:', e);
        }

        let resultRaw;

        if (USE_N8N_WORKFLOW) {
            logToFile('🔄 Using N8N Workflow');
            resultRaw = await executeN8nWorkflow(params);
        } else {
            logToFile('🔄 Using Direct Analysis');
            resultRaw = await executeDirectAnalysis(params, context);
        }

        // 2. Format
        const { analysis, sources } = await formatAnalysisResult(resultRaw.analysisText, resultRaw.sourceIndexMap || {}, context.documents);

        logToFile('✅ Analysis processing complete', { sourceCount: sources.length });

        return {
            analysis,
            sources,
            alert: { ...params }
        };
    } catch (error) {
        logToFile('❌ Error in processTemperatureAlert:', error.message);
        throw error;
    }
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
    let llmModel = await getConfig('LLM_MODEL', '');
    if (!llmModel) {
        try {
            const models = await import('./openwebui-service.js').then(m => m.getAvailableModels());
            if (models && models.length > 0) {
                const preferred = models.find(m => m.id.includes('gpt')) ||
                    models.find(m => m.id.includes('gemini')) ||
                    models.find(m => m.id.includes('llama')) ||
                    models[0];
                llmModel = preferred.id;
            }
        } catch (e) { console.warn('Model discovery failed', e); }
    }
    if (!llmModel) llmModel = 'gemini-2.0-flash';

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
4. **能力增强**：您可以查询历史温度数据。如果用户提到具体的房间或设备名称（如“泵房”），请尝试提取该名称作为 roomCode。系统会自动将其解析为对应的物理编码。`;


    // Inject Skills Prompt
    let skillsPrompt = '';
    try {
        const skills = await loadSkills();
        skillsPrompt = generateSkillPrompt(skills);
    } catch (e) {
        console.warn('Failed to load skills for prompt:', e);
    }

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

    // 5. Pre-fetch Data for Tools (Data First Approach)
    // Determine if we should pre-fetch temperature data based on triggers
    let preFetchedData = null;
    let preFetchedRCode = null;
    const tempTriggers = ["查询温度", "温度趋势", "历史温度", "看看温度", "温度曲线", "最近的温度记录", "温度统计", "最高温度", "最低温度", "平均温度"];
    const isTempQuery = tempTriggers.some(t => message.includes(t));

    if (isTempQuery) {
        console.log('🔍 [Pre-fetch] Detecting potential temperature query...');
        try {
            // Extract potential name/code from message
            // but we want to provide data CONTEXT now.
            let targetIdentifier = roomCode; // Default to context
            // 增强正则：匹配更多中文位置词汇
            const nouns = message.match(/(泵房|机房|会议室|冷机|站房|办公室|大厅|走廊|[A-Z0-9-]{3,})/g);
            if (nouns && nouns.length > 0) targetIdentifier = nouns[0];

            if (targetIdentifier) {
                const availableRooms = await timeseriesService.getAvailableRooms(24);
                let resolvedCode = targetIdentifier;

                // Semantic Resolution
                const [assetMatches, spaceMatches] = await Promise.all([
                    pool.query("SELECT asset_code as code FROM assets WHERE name ILIKE $1 OR asset_code ILIKE $1", [`%${targetIdentifier}%`]),
                    pool.query("SELECT space_code as code FROM spaces WHERE name ILIKE $1 OR space_code ILIKE $1", [`%${targetIdentifier}%`])
                ]);
                const allMatches = [...assetMatches.rows, ...spaceMatches.rows];

                if (allMatches.length > 0) {
                    const best = allMatches.find(m => availableRooms.includes(m.code)) ||
                        allMatches.find(m => availableRooms.some(r => r.includes(m.code))) ||
                        allMatches[0];
                    resolvedCode = best.code;
                }

                // Final sync with InfluxDB tags
                const exactTag = availableRooms.find(r => r.includes(resolvedCode) || resolvedCode.includes(r));
                if (exactTag) resolvedCode = exactTag;

                if (availableRooms.includes(resolvedCode)) {
                    preFetchedRCode = resolvedCode;
                    const endMs = Date.now();
                    const startMs = endMs - 24 * 3600 * 1000; // Default 24h for context
                    const points = await timeseriesService.queryTemperatureRange(resolvedCode, startMs, endMs, '15m');
                    const stats = await timeseriesService.getTemperatureStats(resolvedCode, startMs, endMs);

                    if (stats.count > 0) {
                        preFetchedData = { points, stats, roomCode: resolvedCode };
                        console.log(`✅ [Pre-fetch] Data loaded for ${resolvedCode}: ${stats.count} points.`);

                        // Inject into prompt with HIGH PRIORITY instructions
                        systemInstruction += `\n\n## 🔴 实时监测数据 (REAL-TIME DATA - PRIORITIZE THIS!)
系统已自动为您先检索了相关测点数据，详情如下：
- 查询对象: ${resolvedCode}
- 统计周期: 最近24小时
- 统计细节: 最低温 ${stats.min?.toFixed(1)}°C, 最高温 ${stats.max?.toFixed(1)}°C, 平均温 ${stats.avg?.toFixed(1)}°C, 记录数 ${stats.count}。

**重要规则**：
1. **优先使用上述实时数据**回答用户关于“温度”、“趋势”及“统计”的问题。
2. 即使参考文档中没有提及该对象的温度，也请直接引用上述数据。不要说“上下文中未提及”或“无法查询”。
3. 请以肯定、自信的语气告知用户数据详情，并说明已生成图表。
4. 在回复末尾必须包含操作指令块 (Action Block)。`;
                        // Update system message in history
                        messages[0].content = systemInstruction;
                    }
                }
            }
        } catch (e) {
            console.warn('[Pre-fetch] Failed', e);
        }
    }

    // 6. Call RAG (Knowledge Base + Integrated Real-time Data)
    let llmModel = await getConfig('LLM_MODEL', '');
    if (!llmModel) {
        try {
            const models = await import('./openwebui-service.js').then(m => m.getAvailableModels());
            if (models && models.length > 0) {
                const preferred = models.find(m => m.id.includes('gpt')) ||
                    models.find(m => m.id.includes('gemini')) ||
                    models.find(m => m.id.includes('llama')) ||
                    models[0];
                llmModel = preferred.id;
                console.log(`🤖 Chat Auto-selected model: ${llmModel}`);
            }
        } catch (e) {
            console.warn('Chat model discovery failed', e);
        }
    }
    if (!llmModel) llmModel = 'gemini-2.0-flash';

    const ragResult = await chatWithRAG({
        messages,
        kbId,
        fileIds,
        model: llmModel
    });

    // 5. Extract & Format
    let analysisText = '';
    // Handle different response structures
    if (ragResult.choices?.[0]?.message?.content) analysisText = ragResult.choices[0].message.content;
    else if (ragResult.message?.content) analysisText = ragResult.message.content;
    else if (typeof ragResult === 'string') analysisText = ragResult;

    // 6. Check for Tool Calls (Old Tool Call format or New Skill Action)
    let chartData = null;
    let toolAction = null;

    // First check for legacy format
    const toolMatch = analysisText.match(/@@TOOL_CALL:get_temperature:([\s\S]*?)@@/);
    if (toolMatch) {
        try {
            toolAction = { action: 'query_temperature', params: JSON.parse(toolMatch[1]) };
        } catch (e) {
            console.warn('Failed to parse legacy tool call', e);
        }
    } else {
        // Then check for new Skill Action format
        const { actions: initialActions } = parseAIResponse(analysisText);
        if (initialActions && Array.isArray(initialActions)) {
            toolAction = initialActions.find(a => a.action === 'query_temperature');
        }
    }

    if (toolAction) {
        console.log('🔧 Executing Temperature Tool:', toolAction.params);
        try {
            const args = toolAction.params;
            const durationStr = args.duration || '24h';
            let rCode = args.roomCode || roomCode; // Use arg or fallback to context
            // Clean roomCode: remove " [ID]" suffix if present
            if (rCode) {
                rCode = rCode.replace(/\s*\[.*?\]$/, '').trim();
            }

            // 1. 语义解析：将名称解析为物理编码
            try {
                const availableRooms = await timeseriesService.getAvailableRooms(24);
                console.log(`📊 InfluxDB Available Tags: ${availableRooms.length}. Target: ${rCode}`);

                if (availableRooms.length > 0 && (!rCode || !availableRooms.includes(rCode))) {
                    console.log(`🔎 Performing deep semantic search for: ${rCode}`);

                    // 同时查找资产和空间
                    const [assetMatches, spaceMatches] = await Promise.all([
                        pool.query("SELECT asset_code as code, name FROM assets WHERE name ILIKE $1 OR asset_code ILIKE $1", [`%${rCode}%`]),
                        pool.query("SELECT space_code as code, name FROM spaces WHERE name ILIKE $1 OR space_code ILIKE $1", [`%${rCode}%`])
                    ]);

                    const allMatches = [...assetMatches.rows, ...spaceMatches.rows];

                    if (allMatches.length > 0) {
                        // 优先选择已经在 InfluxDB 中有数据的编码
                        const bestMatch = allMatches.find(m => availableRooms.includes(m.code)) ||
                            allMatches.find(m => availableRooms.some(r => r.includes(m.code) || m.code.includes(r))) ||
                            allMatches[0];

                        console.log(`-> Selected Best Candidate: ${rCode} => ${bestMatch.code} (${bestMatch.name})`);
                        rCode = bestMatch.code;

                        // 再次进行模糊同步，确保最终编码与 Tag 一致
                        if (!availableRooms.includes(rCode)) {
                            const exactTag = availableRooms.find(r => r.includes(rCode) || rCode.includes(r));
                            if (exactTag) rCode = exactTag;
                        }
                    } else {
                        // 如果数据库完全没搜到，尝试对输入内容在可用 Room 中做模糊匹配
                        const directFuzzy = availableRooms.find(r => r.includes(rCode) || (rCode && rCode.includes(r)));
                        if (directFuzzy) {
                            console.log(`-> Direct Fuzzy Match: ${rCode} => ${directFuzzy}`);
                            rCode = directFuzzy;
                        }
                    }
                }
            } catch (err) {
                console.error('Advanced semantic resolution failed', err);
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
                        data: points,
                        range: { startMs, endMs },
                        title: `${rCode} 温度趋势`,
                        roomCode: rCode
                    };
                }

                // Call LLM again with data
                messages.push({ role: 'assistant', content: analysisText });

                let statsSummary = '';
                if (stats.count > 0) {
                    statsSummary = `成功获取到历史温度数据（查询对象: ${rCode}）。
统计摘要: 最低温 ${stats.min?.toFixed(1)}°C, 最高温 ${stats.max?.toFixed(1)}°C, 平均温 ${stats.avg?.toFixed(1)}°C。数据点共 ${stats.count} 个。
请基于这些正式数据回复用户。告知用户已在对话框生成相应的趋势图（对应对象：${rCode}）。回答应专业且带有运维关怀。`;
                } else {
                    statsSummary = `尝试为“${rCode}”查询温度数据，但监测系统未返回有效记录（数据点为 0）。
可能有几种情况：1. 测点近期未上线；2. 该位置未配置温度传感器。
请以运维助理的身份，礼貌地告知用户无法获取实时趋势的原因。如果参考文档中有相关设计参数（如设计运行温度），可结合文档提示用户。`;
                }

                messages.push({
                    role: 'user',
                    content: `【系统反馈】
${statsSummary}
注意：请保持回答简洁，并确保最终回复仍保留操作指令（Action Block），以便前端渲染图表（如果适用）。`
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
                analysisText = "无法执行查询：未找到匹配的房间或设备编码。";
            }
        } catch (e) {
            console.error('Temperature tool execution failed', e);
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

    // If we pre-fetched data, ensure chartData is populated for the frontend
    // We reuse the same startMs/endMs context as pre-fetch (24h)
    if (isTempQuery && preFetchedData && preFetchedData.points.length > 0) {
        chartData = {
            type: 'temperature',
            data: preFetchedData.points,
            range: { startMs: Date.now() - 24 * 3600 * 1000, endMs: Date.now() },
            title: `${preFetchedRCode} 温度趋势`,
            roomCode: preFetchedRCode
        };

        // Ensure action exists if LLM forgot it
        const hasTempAction = actions && actions.some(a => a.action === 'query_temperature');
        if (!hasTempAction) {
            if (!actions) actions = [];
            actions.push({
                action: 'query_temperature',
                params: { roomCode: preFetchedRCode, duration: '24h' }
            });
        }
    }

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
