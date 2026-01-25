/**
 * AI 分析 API 路由
 * 提供前端调用的 AI 分析接口
 */

import express from 'express';
// 直接调用 Open WebUI API
import { chatWithRAG, checkHealth as checkOpenWebUIHealth } from '../services/openwebui-service.js';
// 获取上下文数据的 API
import pool from '../db/index.js';
// 获取 LLM 配置
import { getConfig } from '../services/config-service.js';

const router = express.Router();

// ============================================
// 配置开关：选择使用直接调用 Open WebUI 还是 n8n 工作流
// ============================================
const USE_N8N_WORKFLOW = process.env.USE_N8N_WORKFLOW === 'true' || false;
// 使用现有的环境变量配置
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
const N8N_TEMPERATURE_WEBHOOK = process.env.N8N_TEMPERATURE_ALERT_WEBHOOK || '/webhook/temperature-alert';
const N8N_MANUAL_WEBHOOK = process.env.N8N_MANUAL_ANALYSIS_WEBHOOK || '/webhook/manual-analysis';

// 构建完整的 webhook URL
const N8N_TEMPERATURE_ALERT_URL = `${N8N_BASE_URL}${N8N_TEMPERATURE_WEBHOOK}`;
const N8N_MANUAL_ANALYSIS_URL = `${N8N_BASE_URL}${N8N_MANUAL_WEBHOOK}`;

console.log(`🔧 AI 分析模式: ${USE_N8N_WORKFLOW ? 'n8n 工作流' : '直接调用 Open WebUI'}`);
if (USE_N8N_WORKFLOW) {
    console.log(`🔗 n8n 温度报警 Webhook: ${N8N_TEMPERATURE_ALERT_URL}`);
    console.log(`🔗 n8n 手动分析 Webhook: ${N8N_MANUAL_ANALYSIS_URL}`);
}

/**
 * GET /api/ai/health
 * 检查 AI 服务是否可用
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = await checkOpenWebUIHealth();
        res.json({
            success: true,
            data: {
                openwebui: isHealthy ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString(),
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/temperature-alert
 * 触发温度报警分析（直接调用 Open WebUI RAG）
 * 
 * Body:
 * {
 *   roomCode: string,
 *   roomName: string,
 *   temperature: number,
 *   threshold: number,
 *   alertType: 'high' | 'low',
 *   fileId: number
 * }
 */


// Helper: 获取上下文资产和文档 (复用逻辑)
async function getContextData(pool, roomCode, roomName, fileId) {
    // 1. 查询资产 (关联 asset_specs 获取分类信息)
    let assetsQueryKey = `
        SELECT a.asset_code, a.name, a.spec_code, a.floor, a.room, sp.category
        FROM assets a
        LEFT JOIN asset_specs sp ON a.spec_code = sp.spec_code AND (a.file_id = sp.file_id OR sp.file_id IS NULL)
        WHERE (a.room ILIKE $1 OR a.room ILIKE $2)
    `;
    const assetParams = [`%${roomCode}%`, `%${roomName || ''}%`];
    // 移除 assets 的 strict file_id 过滤，防止版本不一致导致找不到资产
    // if (fileId) {
    //     assetsQueryKey += ` AND a.file_id = $3`;
    //     assetParams.push(fileId);
    // }
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

    // 2. 查询文档
    const docsParams = [`%${roomCode}%`, `%${roomName || ''}%`, searchPatterns];
    let docsQuery = '';

    if (fileId) {
        docsParams.push(fileId);
        if (assetCodes.length > 0) docsParams.push(assetCodes);
        if (specCodes.length > 0) docsParams.push(specCodes);

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
                (d.space_code IS NOT NULL AND s.file_id IS NOT NULL) OR
                (d.asset_code IS NOT NULL AND a.file_id IS NOT NULL) OR
                (d.spec_code IS NOT NULL AND sp.file_id IS NOT NULL)
            )
            ${assetCodes.length > 0 ? 'OR d.asset_code = ANY($5)' : ''}
            ${specCodes.length > 0 ? 'OR d.spec_code = ANY($6)' : ''}
            AND d.file_name NOT ILIKE '%.jpg' 
            AND d.file_name NOT ILIKE '%.png'
            AND d.file_name NOT ILIKE '%.jpeg'
            AND d.file_name NOT ILIKE '%.gif'
            AND d.file_name NOT ILIKE '%.webp'
            LIMIT 20
        `;
    } else {
        if (assetCodes.length > 0) docsParams.push(assetCodes);
        if (specCodes.length > 0) docsParams.push(specCodes);

        docsQuery = `
            SELECT id, title, file_name, file_type, space_code, asset_code, spec_code
            FROM documents
            WHERE (
                space_code ILIKE $1 
                OR space_code ILIKE $2
                ${assetCodes.length > 0 ? 'OR asset_code = ANY($4)' : ''}
                ${specCodes.length > 0 ? 'OR spec_code = ANY($5)' : ''}
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

router.post('/temperature-alert', async (req, res) => {
    try {
        const { roomCode, roomName, temperature, threshold, alertType, fileId } = req.body;

        if (!roomCode || temperature === undefined) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: roomCode, temperature'
            });
        }

        // 根据报警类型设置默认阈值
        const defaultThreshold = alertType === 'low' ? 10 : 23;
        const finalThreshold = threshold || defaultThreshold;
        const finalAlertType = alertType || 'high';
        const isHighTemp = finalAlertType === 'high';
        const alertTypeText = isHighTemp ? '高温' : '低温';

        // ============================================
        // 分支：使用 n8n 工作流还是直接调用 Open WebUI
        // ============================================


        if (USE_N8N_WORKFLOW) {
            console.log(`📡 收到温度报警请求 (n8n 工作流):`, {
                roomName, roomCode, temperature, threshold: finalThreshold, alertType: finalAlertType
            });

            try {
                // 调用 n8n webhook
                const n8nResponse = await fetch(N8N_TEMPERATURE_ALERT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomCode,
                        roomName,
                        temperature,
                        threshold: finalThreshold,
                        alertType: finalAlertType,
                        fileId
                    })
                });

                if (!n8nResponse.ok) {
                    throw new Error(`n8n webhook 返回错误: ${n8nResponse.status}`);
                }

                const n8nResult = await n8nResponse.json();
                console.log(`✅ n8n 工作流返回成功`);

                // 在后端处理来源格式化（n8n 只负责 AI 调用编排）
                let analysisText = n8nResult.analysis || '';
                const rawSources = n8nResult.rawSources || []; // Keep for potential debug, not used directly in formatting
                const sourceIndexMap = n8nResult.sourceIndexMap || {};
                let formattedSources = [];

                try {
                    // pre-process: Replace ][ with , to handle adjacent citations like [1][2] -> [1, 2]
                    analysisText = analysisText.replace(/\]\s*\[/g, ', ');

                    // 1. 处理 Open WebUI 返回的 Sources
                    // 从 sourceIndexMap 中提取 Open WebUI 文件 ID
                    const openwebuiFileIds = [];
                    for (const [idx, info] of Object.entries(sourceIndexMap)) {
                        if (info.openwebuiFileId) {
                            openwebuiFileIds.push(info.openwebuiFileId);
                        }
                    }

                    // 查询本地文档信息 (通过 openwebui_file_id 匹配)
                    if (openwebuiFileIds.length > 0) {
                        const docsResult = await pool.query(`
                            SELECT d.id, d.title, d.file_name, d.file_type, kbd.openwebui_file_id
                            FROM kb_documents kbd
                            JOIN documents d ON kbd.document_id = d.id
                            WHERE kbd.openwebui_file_id = ANY($1)
                        `, [openwebuiFileIds]);

                        for (const doc of docsResult.rows) {
                            for (const [idx, info] of Object.entries(sourceIndexMap)) {
                                if (info.openwebuiFileId === doc.openwebui_file_id) {
                                    sourceIndexMap[idx].docId = doc.id;
                                    sourceIndexMap[idx].fileName = doc.file_name;
                                }
                            }
                        }
                    }

                    // 2. [CRITICAL FIX] 获取上下文文档列表作为 Fallback
                    // 因为 LLM 可能会引用 Prompt 中列出的文档 (Indices 1..N) 而非 RAG Sources
                    const { documents: contextDocs } = await getContextData(pool, roomCode, roomName, fileId);

                    // 补充 sourceIndexMap
                    // 遍历 1 到 contextDocs.length，如果 sourceIndexMap 中没有或者无效，则填入上下文文档
                    contextDocs.forEach((doc, index) => {
                        const idx = index + 1; // 1-based index
                        if (!sourceIndexMap[idx] || !sourceIndexMap[idx].docId) {
                            sourceIndexMap[idx] = {
                                index: idx,
                                docId: doc.id,
                                fileName: doc.file_name,
                                name: doc.title,
                                isContextFallback: true
                            };
                            console.log(`   🔄 引用回退到 Prompt 上下文: [${idx}] ${doc.file_name}`);
                        }
                    });

                    // 格式化引用 - 处理 [source X], [id: X], [X]
                    // ... (Refactored below by reusing existing logic)

                    // 格式化引用 - 处理 [source X]
                    analysisText = analysisText.replace(/\[source\s*(\d+(?:\s*,\s*\d+)*)\]/gi, (match, nums) => {
                        const indices = nums.split(/[,\s]+/).filter(n => n).map(n => parseInt(n));
                        const linkedNums = indices.map(idx => {
                            const info = sourceIndexMap[String(idx)];
                            if (info && info.docId) {
                                return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${idx}</span>`;
                            }
                            return String(idx);
                        });
                        return `[${linkedNums.join(', ')}]`;
                    });

                    // 格式化引用 - 处理 [id: X]
                    analysisText = analysisText.replace(/\[id:?\s*([0-9,\s]+)\]/gi, (match, idStr) => {
                        const ids = idStr.split(/[,\s]+/).filter(n => n);
                        const linkedIds = ids.map(id => {
                            // 尝试在 sourceIndexMap 中查找
                            const entry = Object.values(sourceIndexMap).find(e => String(e.docId) === String(id));
                            if (entry) {
                                return `<span class="ai-doc-link" data-id="${entry.docId}" data-name="${entry.fileName}">${entry.index}</span>`;
                            }
                            // 如果不在 sourceIndexMap 中，尝试从 contextDocs 查找
                            const doc = contextDocs && contextDocs.find(d => String(d.id) === String(id));
                            if (doc) {
                                return `<span class="ai-doc-link" data-id="${doc.id}" data-name="${doc.file_name}">${doc.file_name}</span>`;
                            }
                            return id;
                        });
                        return `[${linkedIds.join(', ')}]`;
                    });

                    // 格式化引用 - 处理 [X] (标准学术格式)
                    analysisText = analysisText.replace(/(?<!\w)\[(\d+(?:,\s*\d+)*)\](?!\()/g, (match, nums) => {
                        const indices = nums.split(/[,\s]+/).filter(n => n).map(n => parseInt(n));
                        const linkedNums = indices.map(idx => {
                            const info = sourceIndexMap[String(idx)];
                            if (info && info.docId) {
                                return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${idx}</span>`;
                            }
                            return String(idx);
                        });
                        return `[${linkedNums.join(', ')}]`;
                    });

                    // 计算下一个可用索引
                    const maxIndex = Math.max(0, ...Object.keys(sourceIndexMap).map(k => parseInt(k) || 0));
                    let nextIndex = maxIndex + 1;

                    // 文本扫描：检查分析文本中是否提到了上下文中的文档
                    // n8n 模式有时可能使用了上下文中的文件名但没有返回 structured source
                    if (contextDocs && contextDocs.length > 0) {
                        console.log('🔍 (n8n) 扫描 AI 文本以匹配上下文文档引用...');
                        const existingDocIds = new Set();

                        // 收集已有的 docId
                        Object.values(sourceIndexMap).forEach(info => {
                            if (info.docId) existingDocIds.add(info.docId);
                        });

                        for (const doc of contextDocs) {
                            if (existingDocIds.has(doc.id)) continue;

                            // 检查文件名是否出现在文本中
                            const baseName = doc.file_name.replace(/\.[^/.]+$/, '');
                            const escapedName = doc.file_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                            const namePattern = new RegExp(escapedName, 'i');
                            const baseNamePattern = (baseName.length >= 2) ? new RegExp(escapedBaseName, 'i') : null;

                            if (namePattern.test(analysisText) || (baseNamePattern && baseNamePattern.test(analysisText))) {
                                console.log(`   ➕ (n8n) 从文本中找回引用: ${doc.file_name}`);
                                // 添加到 formattedSources
                                const sourceInfo = {
                                    name: doc.file_name,
                                    fileName: doc.file_name,
                                    url: `/api/documents/${doc.id}/preview`,
                                    downloadUrl: `/api/documents/${doc.id}/download`,
                                    docId: doc.id,
                                    matchedBy: 'text_reference' // 标记来源
                                };
                                formattedSources.push(sourceInfo);
                                sourceIndexMap[nextIndex] = sourceInfo;
                                nextIndex++;
                                existingDocIds.add(doc.id);
                            }
                        }
                    }

                    // 兜底逻辑：如果 formattedSources 为空且有上下文文档，将所有上下文文档作为参考
                    // 这是为了防止 AI 没有显式引用（或 n8n 没解析出引用）导致文档面板空白
                    if (formattedSources.length === 0 && contextDocs && contextDocs.length > 0) {
                        console.log(`⚠️ (n8n) 未检测到引用，使用上下文文档作为兜底 (${contextDocs.length} 个)`);
                        contextDocs.forEach(doc => {
                            const sourceInfo = {
                                name: doc.file_name,
                                fileName: doc.file_name,
                                url: `/api/documents/${doc.id}/preview`,
                                downloadUrl: `/api/documents/${doc.id}/download`,
                                docId: doc.id,
                                isContextFallback: true
                            };
                            formattedSources.push(sourceInfo);
                            sourceIndexMap[nextIndex] = sourceInfo;
                            nextIndex++;
                        });
                    }

                    // 名称链接化：为文中出现的纯文件名（无 ID 标记）添加链接
                    // 仅针对确认为来源的文档
                    for (const source of formattedSources) {
                        if (!source.docId) continue;

                        const docName = source.name;
                        const docId = source.docId;

                        const escapedName = docName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const baseName = docName.replace(/\.[^/.]+$/, '');
                        let patternStr = `(${escapedName})`;

                        if (baseName && baseName.length >= 2 && baseName !== docName) {
                            const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            patternStr = `(${escapedName}|${escapedBaseName})`;
                        }

                        // 避免替换已经在 span 标签内的文本
                        // 这是一个简单的处理，可能无法涵盖所有边缘情况，但在大多情况下有效
                        const plainNameRegex = new RegExp(`${patternStr}(?![^<]*>|\\s*\\[id)`, 'gi'); // Simplified lookahead

                        analysisText = analysisText.replace(plainNameRegex, (match) => {
                            // 简单检查是否已经在 span 中 (context check is hard with regex alone, assumed handled by frontend/logic structure)
                            // 更严谨的方法是先因 tokenizer 分离 tags，这里沿用 Direct 模式的简单逻辑
                            return `<span class="ai-doc-link" data-id="${docId}" data-name="${docName}">${match}</span>`;
                        });
                    }

                    // 提取引用的文档 ID 生成参考文档列表
                    const citedDocIds = new Set();
                    const spanRegex = /<span class="ai-doc-link" data-id="(\d+)"/g;
                    let spanMatch;
                    while ((spanMatch = spanRegex.exec(analysisText)) !== null) {
                        citedDocIds.add(spanMatch[1]);
                    }

                    // 构建去重的文档列表
                    const uniqueDocs = new Map();
                    for (const [idx, info] of Object.entries(sourceIndexMap)) {
                        if (!info.docId || !citedDocIds.has(String(info.docId))) continue;
                        if (!uniqueDocs.has(info.docId)) {
                            uniqueDocs.set(info.docId, {
                                docId: info.docId,
                                fileName: info.fileName,
                                indices: []
                            });
                        }
                        uniqueDocs.get(info.docId).indices.push(parseInt(idx));
                    }

                    const sortedDocs = [...uniqueDocs.values()].sort((a, b) => Math.min(...a.indices) - Math.min(...b.indices));

                    // 自动生成"参考的文档"部分
                    analysisText = analysisText.replace(/\n*### 4\. 参考的文档[\s\S]*$/i, '');
                    if (sortedDocs.length > 0) {
                        let refSection = '\n\n### 4. 参考的文档\n';
                        for (const doc of sortedDocs) {
                            const minIndex = Math.min(...doc.indices);
                            refSection += `[${minIndex}] <span class="ai-doc-link" data-id="${doc.docId}" data-name="${doc.fileName}">${doc.fileName}</span>\n`;
                        }
                        analysisText += refSection;
                    }

                    formattedSources = sortedDocs.map(doc => ({
                        name: doc.fileName,
                        url: `/api/documents/${doc.docId}/preview`,
                        downloadUrl: `/api/documents/${doc.docId}/download`,
                        docId: doc.docId
                    }));

                    console.log(`📝 n8n 结果格式化完成，引用了 ${formattedSources.length} 个文档`);
                } catch (formatError) {
                    console.warn('⚠️ n8n 来源格式化失败，使用原始数据:', formatError.message, formatError.stack);
                }

                return res.json({
                    success: true,
                    data: {
                        analysis: analysisText,
                        sources: formattedSources,
                        alert: n8nResult.alert
                    }
                });
            } catch (n8nError) {
                console.error('❌ n8n 工作流调用失败:', n8nError.message);
                return res.status(500).json({
                    success: false,
                    error: `n8n 工作流调用失败: ${n8nError.message}`
                });
            }
        }

        // ============================================
        // 直接调用 Open WebUI 模式
        // ============================================
        console.log(`📡 收到温度报警请求 (Direct Open WebUI):`, {
            roomName, roomCode, temperature, threshold: finalThreshold, alertType: finalAlertType
        });

        // 1. 获取房间上下文（设备、文档）—— 使用 getContextData 复用逻辑
        let context = { assets: [], documents: [] };
        try {
            const contextData = await getContextData(pool, roomCode, roomName, fileId);
            context = {
                assets: contextData.assets,
                documents: contextData.documents
            };
            console.log(`📦 查询到 ${context.assets.length} 个设备, ${context.documents.length} 个相关文档`);
        } catch (dbError) {
            console.warn('⚠️ 获取上下文数据失败:', dbError.message);
        }

        // 2. 构建 Prompt
        const prompt = `你是一个建筑设施运维专家。请根据以下报警信息和上下文，提供运维建议。

**重要规则**：
1. **全程必须使用中文回答**。
2. **不要**输出你的思考过程、任务复述或英文摘要。
3. **不要**使用英文标题，必须严格按照下方的【输出格式】回答。

## 报警信息
- 房间：${roomName} (${roomCode})
- 当前温度：${temperature}°C
- 报警阈值：${threshold}°C
- 报警类型：${alertType === 'high' ? '高温报警' : '低温报警'}

## 上下文信息
${context.assets.length > 0 ? `### 房间内设备\n${context.assets.map(a => `- ${a.name} (${a.asset_code}) [${a.category || '其它设备'}]`).join('\n')}` : '（无设备信息）'}

## 可用参考文档
${context.documents && context.documents.length > 0 ? context.documents.map(d => `- ${d.file_name}`).join('\n') : '（无相关文档）'}

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

        console.log('📝 [Prompt Debug] 即将发送给 Open WebUI 的提示词:');
        console.log('--------------------------------------------------');
        console.log(prompt);
        console.log('--------------------------------------------------');

        console.log(`📝 Prompt 长度: ${prompt.length} 字符`);

        // 3. 获取知识库 ID 和相关文档的 Open WebUI 文件 ID
        let kbId = null;
        let fileIds = [];
        try {
            if (fileId) {
                // 根据 fileId 查询对应的 Open WebUI 知识库 ID
                const kbResult = await pool.query(`
                    SELECT openwebui_kb_id, kb_name
                    FROM knowledge_bases
                    WHERE file_id = $1
                `, [fileId]);

                if (kbResult.rows.length > 0) {
                    kbId = kbResult.rows[0].openwebui_kb_id;
                    console.log(`📚 使用知识库: ${kbResult.rows[0].kb_name} (${kbId})`);
                }

                // 3.1 准备搜索关键词
                const searchPatterns = [`%${roomCode}%`, `%${roomName}%`];
                if (context.assets.length > 0) {
                    const assetPatterns = context.assets
                        .flatMap(a => [a.name])
                        .filter(val => val && val.length > 2)
                        .map(val => `%${val}%`);
                    searchPatterns.push(...assetPatterns);
                }

                const assetCodes = context.assets.map(a => a.asset_code).filter(c => c);
                const specCodes = context.assets.map(a => a.spec_code).filter(c => c);

                // 从 kb_documents 表查询与房间或设备相关的已同步文档的 Open WebUI 文件 ID
                const fileIdsQuery = `
                    SELECT kbd.openwebui_file_id, d.file_name
                    FROM kb_documents kbd
                    JOIN documents d ON kbd.document_id = d.id
                    WHERE kbd.openwebui_file_id IS NOT NULL
                      AND kbd.sync_status = 'synced'
                      AND (
                          d.space_code ILIKE $1 
                          OR d.space_code ILIKE $2 
                          ${assetCodes.length > 0 ? 'OR d.asset_code = ANY($4)' : ''}
                          ${specCodes.length > 0 ? 'OR d.spec_code = ANY($5)' : ''}
                          OR d.file_name ILIKE ANY($3)
                          OR d.title ILIKE ANY($3)
                      )
                      AND d.file_name NOT ILIKE '%.jpg' 
                      AND d.file_name NOT ILIKE '%.png'
                      AND d.file_name NOT ILIKE '%.jpeg'
                      AND d.file_name NOT ILIKE '%.gif'
                      AND d.file_name NOT ILIKE '%.webp'
                    LIMIT 20
                `;

                const fileIdsParams = [`%${roomCode}%`, `%${roomName}%`, searchPatterns];
                if (assetCodes.length > 0) fileIdsParams.push(assetCodes);
                if (specCodes.length > 0) fileIdsParams.push(specCodes);

                const fileIdsResult = await pool.query(fileIdsQuery, fileIdsParams);

                if (fileIdsResult.rows.length > 0) {
                    fileIds = fileIdsResult.rows.map(r => r.openwebui_file_id);
                    console.log(`📄 找到 ${fileIds.length} 个相关文档 (含设备文档):`,
                        fileIdsResult.rows.map(r => r.file_name).join(', '));
                }
            } else {
                console.warn('⚠️ 未提供 fileId，无法查询知识库');
            }
        } catch (kbError) {
            console.warn('⚠️ 查询知识库失败:', kbError.message);
        }

        // 4. 调用 Open WebUI RAG（使用文件 ID 精确引用 + 知识库作为补充）
        // 从系统配置读取 LLM 模型
        const llmModel = await getConfig('LLM_MODEL', 'gemini-2.0-flash');
        const ragResult = await chatWithRAG({
            prompt,
            kbId,
            fileIds,
            model: llmModel,
        });

        console.log(`✅ Open WebUI RAG 返回成功`);
        console.log(`🔍 ragResult 顶级字段:`, Object.keys(ragResult));
        console.log(`🔍 ragResult.sources 存在:`, !!ragResult.sources);
        if (ragResult.sources) {
            console.log(`🔍 ragResult.sources 内容:`, JSON.stringify(ragResult.sources).substring(0, 500));
        }

        // 5. 提取分析结果
        let analysisText = '';
        if (ragResult.choices?.[0]?.message?.content) {
            analysisText = ragResult.choices[0].message.content;
        } else if (ragResult.message?.content) {
            analysisText = ragResult.message.content;
        } else if (typeof ragResult === 'string') {
            analysisText = ragResult;
        }

        console.log(`📊 分析结果长度: ${analysisText.length} 字符`);

        // 5.4 [新增] 将未出现在文本中的来源补充到“参考的文档”部分
        const refSectionRegex = /### 4\. 参考的文档/;
        const hasRefSection = refSectionRegex.test(analysisText);

        // 收集所有在 sources 列表中但未在文本中被引用的文档
        // 使用文件名或 ID 进行检查以避免重复
        // 此时 sources 已经包含了 Open WebUI 返回的 + Fallback 的所有文档
        // 注意：我们需要先完成 source 收集（即把步骤 6 和 7 的逻辑提前到这里，或者分两步处理）
        // 由于当前的逻辑顺序是：先提取文本 -> 后处理 Sources -> 再回填 Sources 到文本，
        // 我们需要调整顺序：
        // 1. 获取分析文本
        // 2. 处理 Open WebUI sources
        // 3. Fallback sources
        // 4. 文本扫描 sources
        // 5. (NEW) 将未被引用的 sources 追加到文本
        // 6. 格式化 HTML 链接

        // 为了最小化改动，我们在这一步先只做占位，等下方 sources 列表整理完毕后（即 response 前），再执行追加和格式化

        // --- 逻辑移动到下方 --- 

        console.log(`📊 分析结果长度: ${analysisText.length} 字符`);

        // 6. 从 Open WebUI 返回的 sources 字段提取真实引用的文档
        // 重构：每个 ragResult.sources[i] 代表一个被引用的文档
        // AI 使用 [source 1] 格式引用，其中 1 对应 sources[0] (1-indexed)
        let sources = [];
        let sourceIndexMap = new Map(); // Map<sourceIndex (1-indexed), {docId, docName, url}>

        try {
            if (ragResult.sources && Array.isArray(ragResult.sources) && ragResult.sources.length > 0) {
                console.log(`📚 Open WebUI 返回 ${ragResult.sources.length} 个引用来源`);

                for (let i = 0; i < ragResult.sources.length; i++) {
                    const sourceItem = ragResult.sources[i];
                    const sourceIndex = i + 1; // 1-indexed for AI citations

                    // 获取 Open WebUI 文件 ID (UUID)
                    const openwebuiFileId = sourceItem.source?.id ||
                        (sourceItem.metadata?.[0]?.file_id);
                    const docName = sourceItem.metadata?.[0]?.name ||
                        sourceItem.metadata?.[0]?.source ||
                        `Source ${sourceIndex}`;

                    console.log(`  → [source ${sourceIndex}] ${docName} (UUID: ${openwebuiFileId || 'N/A'})`);

                    if (!openwebuiFileId) {
                        console.log(`    ⚠️ 无 Open WebUI 文件 ID，跳过`);
                        continue;
                    }

                    // 通过 openwebui_file_id 查找本地文档
                    const matchResult = await pool.query(`
                        SELECT d.id, d.title, d.file_name, d.file_path, d.file_type
                        FROM kb_documents kbd
                        JOIN documents d ON kbd.document_id = d.id
                        WHERE kbd.openwebui_file_id = $1
                        LIMIT 1
                    `, [openwebuiFileId]);

                    if (matchResult.rows.length > 0) {
                        const doc = matchResult.rows[0];
                        const sourceInfo = {
                            index: sourceIndex,
                            docId: doc.id,
                            name: doc.title || doc.file_name,
                            fileName: doc.file_name,
                            url: `/api/documents/${doc.id}/preview`,
                            downloadUrl: `/api/documents/${doc.id}/download`,
                            fileType: doc.file_type,
                            openwebuiFileId: openwebuiFileId
                        };

                        sources.push(sourceInfo);
                        sourceIndexMap.set(sourceIndex, sourceInfo);
                        console.log(`    ✅ 匹配成功: ${doc.file_name} (本地ID: ${doc.id})`);
                    } else {
                        console.log(`    ⚠️ 未在 kb_documents 中找到匹配: ${openwebuiFileId}`);
                    }
                }

                console.log(`📎 共解析 ${sources.length} 个有效文档来源`);
                console.log('📋 sourceIndexMap 完整映射:');
                for (const [idx, info] of sourceIndexMap.entries()) {
                    console.log(`    [${idx}] => docId:${info.docId}, fileName:${info.fileName}`);
                }
            } else {
                console.log('⚠️ Open WebUI 未返回 sources 字段或为空');
            }

            // 7. [新增] 文本扫描：检查分析文本中是否提到了上下文中的文档
            // Open WebUI 有时可能使用了上下文中的文件名但没有返回 structured source
            if (context.documents && context.documents.length > 0) {
                console.log('🔍 扫描 AI 文本以匹配上下文文档引用...');
                const existingNames = new Set(sources.map(s => s.name));

                for (const doc of context.documents) {
                    // 如果文档已在来源列表中，跳过
                    if (existingNames.has(doc.title) || existingNames.has(doc.file_name)) continue;

                    // 检查文件名是否出现在文本中
                    // 去掉扩展名进行匹配可能更准确
                    const baseName = doc.file_name.replace(/\.[^/.]+$/, '');

                    // 构建简单的正则匹配
                    // 注意：这里需要转义文件名中的特殊字符
                    const escapedName = doc.file_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                    const namePattern = new RegExp(escapedName, 'i');
                    const baseNamePattern = new RegExp(escapedBaseName, 'i');

                    if (namePattern.test(analysisText) || baseNamePattern.test(analysisText)) {
                        console.log(`    ➕ 从文本中找回引用: ${doc.file_name}`);
                        sources.push({
                            name: doc.title || doc.file_name,
                            fileName: doc.file_name,
                            url: `/api/documents/${doc.id}/preview`,
                            downloadUrl: `/api/documents/${doc.id}/download`,
                            fileType: doc.file_type,
                            matchedBy: 'text_reference',
                            isTextReference: true
                        });
                        existingNames.add(doc.title || doc.file_name);
                    }
                }
            }

            // Fallback: 如果 Open WebUI 没有返回来源 (可能是没检索到)，使用本地上下文文档
            if (sources.length === 0 && context.documents && context.documents.length > 0) {
                console.log(`⚠️ Open WebUI 未返回有效来源，使用本地上下文文档作为建议参考 (${context.documents.length} 个)`);
                for (const doc of context.documents) {
                    // 避免重复添加 (虽然此时 sources 为空，但为了逻辑严谨)
                    sources.push({
                        name: doc.title || doc.file_name,
                        fileName: doc.file_name,
                        url: `/api/documents/${doc.id}/preview`,
                        downloadUrl: `/api/documents/${doc.id}/download`,
                        fileType: doc.file_type,
                        matchedBy: 'context_fallback',
                        isContextFallback: true // 标记为上下文回退文档
                    });
                }
                console.log('📚 Open WebUI 未返回有效来源，使用 Fallback 本地文档:', sources.map(s => s.name).join(', '));
            }

            // 9. [新增] 自动为文中出现的纯文件名（无 ID 标记）添加链接
            // 仅针对确认为来源的文档
            for (const source of sources) {
                const docName = source.fileName || source.name;
                if (!docName) continue;

                // 查找该文档的 ID
                const urlMatch = source.url.match(/\/documents\/(\d+)\//);
                const docId = urlMatch ? urlMatch[1] : null;
                if (!docId) continue;

                // 构建正则
                const escapedName = docName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // 同时也尝试匹配不带扩展名的文件名 (baseName)
                const baseName = docName.replace(/\.[^/.]+$/, '');
                let patternStr = `(${escapedName})`;

                if (baseName && baseName.length >= 2 && baseName !== docName) {
                    const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    patternStr = `(${escapedName}|${escapedBaseName})`;
                }

                const plainNameRegex = new RegExp(`${patternStr}(?!\\s*\\[id)`, 'g');

                // 替换为HTML链接
                analysisText = analysisText.replace(plainNameRegex, (match) => {
                    return `<span class="ai-doc-link" data-id="${docId}" data-name="${docName}">${match}</span>`;
                });
            }

            // 构建 Maps 用于查找
            const docMap = new Map();
            const nameToDocMap = new Map();

            const addToMaps = (doc) => {
                if (!doc || !doc.id) return;
                const idStr = String(doc.id);
                // 统一格式的对象
                const docObj = {
                    id: idStr,
                    file_name: doc.file_name || doc.title,
                    title: doc.title || doc.file_name
                };

                docMap.set(idStr, docObj);

                // 建立文件名映射 (全名)
                if (docObj.file_name) {
                    nameToDocMap.set(docObj.file_name.toLowerCase(), docObj);
                }
                // 建立文件名映射 (无后缀)
                if (docObj.file_name && docObj.file_name.includes('.')) {
                    const baseName = docObj.file_name.replace(/\.[^/.]+$/, '');
                    if (baseName.length >= 2) {
                        nameToDocMap.set(baseName.toLowerCase(), docObj);
                    }
                }
            };

            if (context.documents) {
                context.documents.forEach(addToMaps);
            }
            // 确保 sources 里的也能查到 (主要是有 id 的)
            sources.forEach(s => {
                const urlMatch = s.url.match(/\/documents\/(\d+)\//);
                const docId = urlMatch ? urlMatch[1] : null;
                if (docId) {
                    addToMaps({
                        id: docId,
                        file_name: s.fileName || s.name,
                        title: s.name
                    });
                }
            });

            // 10. [格式化] 格式化分析结果中的 [source X] 引用为 HTML 链接
            // Open WebUI 返回的 AI 文本使用 [source X] 格式引用，其中 X 是 sources 数组的 1-indexed 索引
            console.log('🎨 格式化 [source X] 引用为 HTML 链接...');
            console.log('   sourceIndexMap 内容:', [...sourceIndexMap.entries()].map(([k, v]) => `${k}:${v.fileName}`).join(', '));

            // 匹配 [source 1] 或 [source 1, source 9, source 11] 格式
            analysisText = analysisText.replace(/\[source\s*([0-9,\s]+|[0-9]+(?:,\s*source\s*[0-9]+)*)\]/gi, (match) => {
                // 提取所有数字
                const numbers = match.match(/\d+/g);
                if (!numbers || numbers.length === 0) return match;

                const linkedSources = numbers.map(numStr => {
                    const sourceIndex = parseInt(numStr, 10); // 1-indexed
                    const sourceInfo = sourceIndexMap.get(sourceIndex);

                    if (sourceInfo && sourceInfo.docId) {
                        console.log(`   [source ${sourceIndex}] => docId ${sourceInfo.docId} (${sourceInfo.fileName})`);
                        return `<span class="ai-doc-link" data-id="${sourceInfo.docId}" data-name="${sourceInfo.fileName || sourceInfo.name}">${numStr}</span>`;
                    } else {
                        console.log(`   [source ${sourceIndex}] => 未找到映射`);
                    }
                    return numStr; // 如果找不到对应的 source，保持原样
                });

                return `[source ${linkedSources.join(', ')}]`;
            });

            // 10.2 处理 [id: X] 格式 (AI 有时会把 source 索引误写成 [id: X])
            // 策略：如果 X 是小数字（1-50）且 docMap 中不存在，则当作 source 索引处理
            console.log('🎨 格式化 [id: X] 引用为 HTML 链接...');
            analysisText = analysisText.replace(/\[id:?\s*([0-9,\s]+)\]/gi, (match, idsContent) => {
                const numbers = idsContent.split(/[,，\s]+/).filter(i => i);
                if (!numbers || numbers.length === 0) return match;

                const linkedIds = numbers.map(numStr => {
                    const num = parseInt(numStr, 10);

                    // 1. 首先检查是否是有效的数据库文档 ID (通常是 2-3 位数)
                    if (docMap.has(String(num))) {
                        const doc = docMap.get(String(num));
                        console.log(`   [id: ${num}] => 数据库文档 ID (${doc.file_name})`);
                        return `<span class="ai-doc-link" data-id="${num}" data-name="${doc.file_name}">${numStr}</span>`;
                    }

                    // 2. 如果是小数字 (1-50) 且不在 docMap 中，当作 source 索引处理
                    if (num >= 1 && num <= 50 && sourceIndexMap.has(num)) {
                        const sourceInfo = sourceIndexMap.get(num);
                        console.log(`   [id: ${num}] => 当作 source 索引处理 => docId ${sourceInfo.docId} (${sourceInfo.fileName})`);
                        return `<span class="ai-doc-link" data-id="${sourceInfo.docId}" data-name="${sourceInfo.fileName}">${numStr}</span>`;
                    }

                    console.log(`   [id: ${num}] => 未找到匹配`);
                    return numStr;
                });

                return `[id: ${linkedIds.join(', ')}]`;
            });

            // 10.3 处理简单的 [X] 格式 (如 [1], [3], [9] 或 [1], [5], [13])
            // 这是 AI 使用的类似学术论文的引用格式
            console.log('🎨 格式化 [X] 引用为 HTML 链接...');
            analysisText = analysisText.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (match, content) => {
                // 跳过已经处理过的 (包含 span 标签的)
                if (match.includes('data-id')) return match;

                const numbers = content.split(/[,，\s]+/).filter(i => i);
                if (!numbers || numbers.length === 0) return match;

                const linkedNums = numbers.map(numStr => {
                    const num = parseInt(numStr, 10);

                    // 检查 sourceIndexMap
                    if (sourceIndexMap.has(num)) {
                        const sourceInfo = sourceIndexMap.get(num);
                        console.log(`   [${num}] => docId ${sourceInfo.docId} (${sourceInfo.fileName})`);
                        return `<span class="ai-doc-link" data-id="${sourceInfo.docId}" data-name="${sourceInfo.fileName}">${numStr}</span>`;
                    }

                    // 检查 docMap (以防万一是直接的数据库 ID)
                    if (docMap.has(String(num))) {
                        const doc = docMap.get(String(num));
                        console.log(`   [${num}] => docMap ID (${doc.file_name})`);
                        return `<span class="ai-doc-link" data-id="${num}" data-name="${doc.file_name}">${numStr}</span>`;
                    }

                    console.log(`   [${num}] => 未找到匹配`);
                    return numStr;
                });

                return `[${linkedNums.join(', ')}]`;
            });

            // 10.4 自动生成"参考的文档"部分（替换 AI 可能生成的错误版本）
            console.log('📝 自动生成"参考的文档"部分...');

            // 移除 AI 可能生成的"参考的文档"部分
            analysisText = analysisText.replace(/\n*### 4\. 参考的文档[\s\S]*$/i, '');
            analysisText = analysisText.replace(/\n*\*\*?参考的文档\*\*?[\s\S]*$/i, '');

            // 提取正文中实际出现的引用索引 (查找已处理的 span 标签中的 data-id)
            const citedDocIds = new Set();
            const spanRegex = /<span class="ai-doc-link" data-id="(\d+)"/g;
            let spanMatch;
            while ((spanMatch = spanRegex.exec(analysisText)) !== null) {
                citedDocIds.add(spanMatch[1]);
            }
            console.log(`    📊 正文中实际引用的文档ID: ${[...citedDocIds].join(', ')}`);

            // 从 sourceIndexMap 中提取去重的文档列表，只保留实际被引用的
            const uniqueDocs = new Map(); // docId => {fileName, indices: []}
            for (const [idx, info] of sourceIndexMap.entries()) {
                // 只添加实际被引用的文档
                if (!citedDocIds.has(String(info.docId))) continue;

                if (!uniqueDocs.has(info.docId)) {
                    uniqueDocs.set(info.docId, {
                        docId: info.docId,
                        fileName: info.fileName,
                        indices: []
                    });
                }
                uniqueDocs.get(info.docId).indices.push(idx);
            }

            // 按第一次出现的索引排序
            const sortedDocs = [...uniqueDocs.values()].sort((a, b) => Math.min(...a.indices) - Math.min(...b.indices));

            if (sortedDocs.length > 0) {
                let refSection = '\n\n### 4. 参考的文档\n';
                for (const doc of sortedDocs) {
                    // 使用文档对应的最小引用索引作为编号
                    const minIndex = Math.min(...doc.indices);
                    // 生成带原始编号和链接的文档名
                    refSection += `[${minIndex}] <span class="ai-doc-link" data-id="${doc.docId}" data-name="${doc.fileName}">${doc.fileName}</span>\n`;
                }
                analysisText += refSection;
                console.log(`    ✅ 已生成 ${sortedDocs.length} 个实际引用的文档`);
            } else {
                console.log('    ⚠️ 正文中无有效文档引用');
            }

        } catch (sourceError) {
            console.warn('⚠️ 解析文档来源失败:', sourceError.message);
            // 出错时也尝试使用上下文文档
            if (context.documents && context.documents.length > 0) {
                sources = context.documents.map(doc => ({
                    name: doc.title || doc.file_name,
                    fileName: doc.file_name,
                    url: `/api/documents/${doc.id}/preview`,
                    downloadUrl: `/api/documents/${doc.id}/download`,
                    fileType: doc.file_type,
                    matchedBy: 'error_fallback'
                }));
                console.log('📚 Open WebUI RAG 返回的参考文献:', sources.map(s => s.name).join(', '));
            }
        }

        res.json({
            success: true,
            data: {
                analysis: analysisText,
                sources,  // 添加文档来源数组
                alert: {
                    roomCode,
                    roomName,
                    temperature,
                    threshold: finalThreshold,
                    alertType: finalAlertType,
                }
            }
        });
    } catch (error) {
        console.error('❌ 温度报警 API 错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


/**
 * POST /api/ai/analyze
 * 请求手动分析（资产或房间）
 * 
 * Body:
 * {
 *   type: 'asset' | 'room',
 *   target: { ... },  // 资产或房间对象
 *   question?: string,  // 可选的用户问题
 *   fileId: number
 * }
 */
router.post('/analyze', async (req, res) => {
    try {
        const { type, target, question, fileId } = req.body;

        if (!type || !target) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: type, target'
            });
        }

        if (!['asset', 'room'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'type 必须是 asset 或 room'
            });
        }

        const result = await triggerManualAnalysis({
            type,
            target,
            question,
            fileId,
        });

        res.json({
            success: result.success,
            data: result.result,
            error: result.error
        });
    } catch (error) {
        console.error('❌ 手动分析 API 错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// n8n 工作流支持 API
// ============================================

/**
 * GET /api/ai/context
 * 获取上下文数据（供 n8n 工作流使用）
 * 
 * Query:
 *   roomCode: string
 *   roomName: string
 *   fileId: number
 */
router.get('/context', async (req, res) => {
    try {
        const { roomCode, roomName, fileId } = req.query;

        if (!roomCode) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: roomCode'
            });
        }

        console.log(`📡 n8n 请求上下文: roomCode=${roomCode}, roomName=${roomName}, fileId=${fileId}`);

        console.log(`📡 n8n 请求上下文: roomCode=${roomCode}, roomName=${roomName}, fileId=${fileId}`);

        // 使用统一的 Helper 获取上下文
        const { assets, documents, searchPatterns } = await getContextData(pool, roomCode, roomName, fileId);

        console.log(`📦 查询到 ${assets.length} 个设备`);
        console.log(`📄 查询到 ${documents.length} 个相关文档`);


        // 获取知识库 ID 和文件 IDs
        let kbId = null;
        let fileIds = [];

        if (fileId) {
            const kbResult = await pool.query(`
                SELECT openwebui_kb_id, kb_name
                FROM knowledge_bases
                WHERE file_id = $1
            `, [fileId]);

            if (kbResult.rows.length > 0) {
                kbId = kbResult.rows[0].openwebui_kb_id;
            }

            // 查询相关文档的 Open WebUI 文件 ID
            // Re-construct params for fileIds query
            const docsParams = [`%${roomCode}%`, `%${roomName || ''}%`, searchPatterns];

            // 查询相关文档的 Open WebUI 文件 ID
            const fileIdsResult = await pool.query(`
                SELECT kbd.openwebui_file_id, d.file_name
                FROM kb_documents kbd
                JOIN documents d ON kbd.document_id = d.id
                WHERE kbd.openwebui_file_id IS NOT NULL
                  AND kbd.sync_status = 'synced'
                  AND (
                      d.space_code ILIKE $1 
                      ${roomName ? 'OR d.space_code ILIKE $2' : ''}
                      OR d.file_name ILIKE ANY($3)
                  )
                  AND d.file_name NOT ILIKE '%.jpg' 
                  AND d.file_name NOT ILIKE '%.png'
                LIMIT 20
            `, docsParams.slice(0, 3));

            if (fileIdsResult.rows.length > 0) {
                fileIds = fileIdsResult.rows.map(r => r.openwebui_file_id);
            }
        }

        res.json({
            success: true,
            assets,
            documents,
            kbId,
            fileIds
        });
    } catch (error) {
        console.error('❌ 获取上下文失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/format-citations
 * 格式化引用和来源（供 n8n 工作流使用）
 * 
 * Body:
 *   analysisText: string
 *   sourceIndexMap: object
 *   sources: array
 */
router.post('/format-citations', async (req, res) => {
    try {
        const { analysisText: rawAnalysisText, sourceIndexMap, sources } = req.body;

        if (!rawAnalysisText) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: analysisText'
            });
        }

        let analysisText = rawAnalysisText;
        // pre-process: Replace ][ with , to handle adjacent citations like [1][2] -> [1, 2]
        analysisText = analysisText.replace(/\]\s*\[/g, ', ');

        console.log(`📝 格式化引用: 文本长度=${analysisText.length}, sources=${sources?.length || 0}`);

        // 将 sourceIndexMap 对象转换为 Map
        const indexMap = new Map(Object.entries(sourceIndexMap || {}).map(([k, v]) => [parseInt(k), v]));

        // 构建 docMap (通过查询数据库获取本地文档信息)
        const docMap = new Map();
        const openwebuiFileIds = [...indexMap.values()].map(v => v.openwebuiFileId).filter(Boolean);

        if (openwebuiFileIds.length > 0) {
            const docsResult = await pool.query(`
                SELECT d.id, d.title, d.file_name, d.file_type, kbd.openwebui_file_id
                FROM kb_documents kbd
                JOIN documents d ON kbd.document_id = d.id
                WHERE kbd.openwebui_file_id = ANY($1)
            `, [openwebuiFileIds]);

            for (const doc of docsResult.rows) {
                // 更新 indexMap 中的 docId
                for (const [idx, info] of indexMap.entries()) {
                    if (info.openwebuiFileId === doc.openwebui_file_id) {
                        info.docId = doc.id;
                        info.fileName = doc.file_name;
                        indexMap.set(idx, info);
                    }
                }
                docMap.set(String(doc.id), {
                    id: doc.id,
                    file_name: doc.file_name,
                    title: doc.title
                });
            }
        }

        // 文件名 Fallback 匹配 (对于 ID 匹配失败的项)
        const unresolvedIndices = [...indexMap.entries()]
            .filter(([_, info]) => !info.docId && (info.name || info.fileName))
            .map(([idx]) => idx);

        if (unresolvedIndices.length > 0) {
            const namesToLookup = unresolvedIndices.map(idx => {
                const info = indexMap.get(idx);
                return info.name || info.fileName;
            });
            console.log(`⚠️ /format-citations 尝试通过文件名回退匹配 ${unresolvedIndices.length} 个文档`);

            const nameResult = await pool.query(`
                SELECT id, title, file_name 
                FROM documents 
                WHERE file_name = ANY($1) OR title = ANY($1)
             `, [namesToLookup]);

            for (const doc of nameResult.rows) {
                for (const idx of unresolvedIndices) {
                    const info = indexMap.get(idx);
                    const targetName = info.name || info.fileName;
                    if (targetName === doc.file_name || targetName === doc.title) {
                        info.docId = doc.id;
                        info.fileName = doc.file_name;
                        indexMap.set(idx, info);
                        docMap.set(String(doc.id), {
                            id: doc.id,
                            file_name: doc.file_name,
                            title: doc.title
                        });
                        console.log(`   ✅ 文件名回退匹配成功: [${idx}] ${targetName} -> ID ${doc.id}`);
                    }
                }
            }
        }

        let formattedText = analysisText;

        // 10.1 处理 [source X] 格式
        formattedText = formattedText.replace(/\[source\s*(\d+(?:\s*,\s*\d+)*)\]/gi, (match, nums) => {
            const indices = nums.split(/[,\s]+/).filter(n => n).map(n => parseInt(n));
            const linkedNums = indices.map(idx => {
                const info = indexMap.get(idx);
                if (info && info.docId) {
                    return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${idx}</span>`;
                }
                return String(idx);
            });
            return `[${linkedNums.join(', ')}]`;
        });

        // 10.2 处理 [id: X] 格式
        formattedText = formattedText.replace(/\[id:?\s*(\d+(?:\s*,\s*\d+)*)\]/gi, (match, nums) => {
            const indices = nums.split(/[,\s]+/).filter(n => n).map(n => parseInt(n));
            const linkedNums = indices.map(num => {
                // 先尝试直接作为文档 ID
                if (docMap.has(String(num))) {
                    const doc = docMap.get(String(num));
                    return `<span class="ai-doc-link" data-id="${num}" data-name="${doc.file_name}">${num}</span>`;
                }
                // 再尝试作为 source index (1-50 范围)
                if (num <= 50) {
                    const info = indexMap.get(num);
                    if (info && info.docId) {
                        return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${num}</span>`;
                    }
                }
                return String(num);
            });
            return `[${linkedNums.join(', ')}]`;
        });

        // 10.3 处理简单 [X] 格式
        formattedText = formattedText.replace(/(?<!\w)\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (match, nums) => {
            const indices = nums.split(/[,\s]+/).filter(n => n).map(n => parseInt(n));
            const linkedNums = indices.map(num => {
                // 尝试作为 source index
                const info = indexMap.get(num);
                if (info && info.docId) {
                    return `<span class="ai-doc-link" data-id="${info.docId}" data-name="${info.fileName}">${num}</span>`;
                }
                // 尝试作为文档 ID
                if (docMap.has(String(num))) {
                    const doc = docMap.get(String(num));
                    return `<span class="ai-doc-link" data-id="${num}" data-name="${doc.file_name}">${num}</span>`;
                }
                return String(num);
            });
            return `[${linkedNums.join(', ')}]`;
        });

        // 10.4 自动生成"参考的文档"部分
        formattedText = formattedText.replace(/\n*### 4\. 参考的文档[\s\S]*$/i, '');

        // 提取正文中实际引用的文档 ID
        const citedDocIds = new Set();
        const spanRegex = /<span class="ai-doc-link" data-id="(\d+)"/g;
        let spanMatch;
        while ((spanMatch = spanRegex.exec(formattedText)) !== null) {
            citedDocIds.add(spanMatch[1]);
        }

        // 构建去重的文档列表
        const uniqueDocs = new Map();
        for (const [idx, info] of indexMap.entries()) {
            if (!info.docId || !citedDocIds.has(String(info.docId))) continue;
            if (!uniqueDocs.has(info.docId)) {
                uniqueDocs.set(info.docId, {
                    docId: info.docId,
                    fileName: info.fileName,
                    indices: []
                });
            }
            uniqueDocs.get(info.docId).indices.push(idx);
        }

        const sortedDocs = [...uniqueDocs.values()].sort((a, b) => Math.min(...a.indices) - Math.min(...b.indices));

        if (sortedDocs.length > 0) {
            let refSection = '\n\n### 4. 参考的文档\n';
            for (const doc of sortedDocs) {
                const minIndex = Math.min(...doc.indices);
                refSection += `[${minIndex}] <span class="ai-doc-link" data-id="${doc.docId}" data-name="${doc.fileName}">${doc.fileName}</span>\n`;
            }
            formattedText += refSection;
        }

        // 构建最终的 sources 列表
        const formattedSources = sortedDocs.map(doc => ({
            name: doc.fileName,
            url: `/api/documents/${doc.docId}/preview`,
            downloadUrl: `/api/documents/${doc.docId}/download`,
            docId: doc.docId
        }));

        res.json({
            success: true,
            formattedText,
            sources: formattedSources
        });
    } catch (error) {
        console.error('❌ 格式化引用失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
