/**
 * Open WebUI 服务
 * 提供知识库管理和 RAG 查询功能
 */

import openwebuiConfig from '../config/openwebui-config.js';
import { getConfig } from './config-service.js';
import fs from 'fs';
import path from 'path';
// 不再使用 form-data 包，使用 Node.js 原生 FormData

// MIME 类型映射表
const MIME_TYPES = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json'
};

// 动态读取配置（避免 ES Modules 静态导入时环境变量未加载的问题）
// 每次调用时都从 openwebuiConfig 读取最新值，而不是在模块加载时固定
// 动态读取配置（优先使用系统配置，不使用 env.local）
const getBaseUrl = async () => await getConfig('OPENWEBUI_URL', '');
const getApiKey = async () => await getConfig('OPENWEBUI_API_KEY', '');
const { endpoints, supportedFormats } = openwebuiConfig;

/**
 * 通用请求方法
 */
async function request(endpoint, options = {}) {
    const baseUrl = await getBaseUrl();
    const apiKey = await getApiKey();

    // 调试日志：检查配置状态
    console.log(`🔧 Open WebUI 配置: URL=${baseUrl}, API Key=${apiKey ? `已配置(${apiKey.substring(0, 10)}...)` : '未配置'}`);

    if (!apiKey) {
        console.error('❌ OPENWEBUI_API_KEY 未配置，无法调用 Open WebUI API');
        throw new Error('OPENWEBUI_API_KEY 未配置');
    }

    const url = `${baseUrl}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...options.headers,
    };

    // 如果是 FormData，删除 Content-Type 让 fetch 自动设置
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Open WebUI API 错误 [${response.status}]:`, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`❌ Open WebUI 请求失败 [${endpoint}]:`, error.message);
        throw error;
    }
}

/**
 * 检查 Open WebUI 服务健康状态
 */
export async function checkHealth() {
    try {
        const baseUrl = await getBaseUrl();
        const response = await fetch(`${baseUrl}${endpoints.health}`);
        return response.ok;
    } catch (error) {
        console.error('❌ Open WebUI 健康检查失败:', error.message);
        return false;
    }
}

/**
 * 创建知识库
 * @param {string} name - 知识库名称
 * @param {string} description - 知识库描述
 * @returns {Promise<Object>} 创建的知识库信息
 */
export async function createKnowledgeBase(name, description = '') {
    console.log(`📚 创建知识库: ${name}`);

    const result = await request(endpoints.knowledgeCreate, {
        method: 'POST',
        body: JSON.stringify({
            name,
            description,
        }),
    });

    console.log(`✅ 知识库创建成功: ${result.id}`);
    return result;
}

/**
 * 获取所有知识库
 * @returns {Promise<Array>} 知识库列表
 */
export async function listKnowledgeBases() {
    const result = await request(endpoints.knowledgeList, { method: 'GET' });
    return result.items || result;
}

/**
 * 获取单个知识库详情
 * @param {string} kbId - 知识库 ID
 * @returns {Promise<Object>} 知识库详情
 */
export async function getKnowledgeBase(kbId) {
    return await request(endpoints.knowledgeById(kbId), { method: 'GET' });
}

/**
 * 删除知识库
 * @param {string} kbId - 知识库 ID
 */
export async function deleteKnowledgeBase(kbId) {
    console.log(`🗑️ 删除知识库: ${kbId}`);
    // 正确的删除端点是 /api/v1/knowledge/{id}/delete
    await request(`/api/v1/knowledge/${kbId}/delete`, { method: 'DELETE' });
    console.log(`✅ 知识库删除成功`);
}

/**
 * 检查文件格式是否支持 RAG
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isSupportedFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return supportedFormats.includes(ext);
}

/**
 * 上传文档到知识库（两步操作）
 * Step 1: 上传文件到 /api/v1/files/
 * Step 2: 将文件添加到知识库 /api/v1/knowledge/{id}/file/add
 * @param {string} kbId - 知识库 ID
 * @param {string} filePath - 文件路径
 * @param {string} [originalFileName] - 原始文件名（可选，默认使用系统文件名）
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadDocument(kbId, filePath, originalFileName = null) {
    if (!isSupportedFormat(filePath)) {
        throw new Error(`不支持的文件格式: ${path.extname(filePath)}`);
    }

    // 使用原始文件名或系统文件名
    const fileName = originalFileName || path.basename(filePath);
    console.log(`📄 上传文档到知识库 ${kbId}: ${fileName}`);

    // Step 1: 上传文件到 Open WebUI 文件管理系统
    // 使用 Node.js 原生 File API (Node 20+)
    const fileBuffer = fs.readFileSync(filePath);

    // 根据文件扩展名获取正确的MIME类型
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    console.log(`📋 文件MIME类型: ${mimeType}`);

    const file = new File([fileBuffer], fileName, { type: mimeType });

    const formData = new FormData();
    formData.append('file', file);

    const baseUrl = await getBaseUrl();
    const apiKey = await getApiKey();

    const uploadUrl = `${baseUrl}/api/v1/files/`;
    const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`❌ 文件上传失败 [${uploadResponse.status}]:`, errorText);
        console.error(`   文件名: ${fileName}`);
        console.error(`   文件路径: ${filePath}`);
        console.error(`   MIME类型: ${mimeType}`);
        console.error(`   文件大小: ${fileBuffer.length} bytes`);
        throw new Error(`文件上传失败: HTTP ${uploadResponse.status}: ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;
    console.log(`✅ 文件上传成功, fileId=${fileId}`);

    // 等待 Open WebUI 处理文件内容（解析、分块、嵌入）
    // 轮询检查文件状态，最多等待 30 秒
    console.log(`⏳ 等待文件处理...`);
    let fileReady = false;
    for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待 3 秒

        // 检查文件状态
        const checkResponse = await fetch(`${await getBaseUrl()}/api/v1/files/${fileId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${await getApiKey()}`,
            },
        });

        if (checkResponse.ok) {
            const fileInfo = await checkResponse.json();
            // 检查文件内容是否已处理
            if (fileInfo.data && fileInfo.data.content) {
                console.log(`✅ 文件处理完成`);
                fileReady = true;
                break;
            }
        }
        console.log(`⏳ 等待中... (${i + 1}/10)`);
    }

    if (!fileReady) {
        console.log(`⚠️ 文件处理超时，尝试添加到知识库...`);
    }

    // Step 2: 将文件添加到知识库
    const addToKbUrl = `${await getBaseUrl()}/api/v1/knowledge/${kbId}/file/add`;
    const addResponse = await fetch(addToKbUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${await getApiKey()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_id: fileId }),
    });

    if (!addResponse.ok) {
        const errorText = await addResponse.text();
        console.error(`❌ 添加文件到知识库失败 [${addResponse.status}]:`, errorText);
        throw new Error(`添加文件到知识库失败: HTTP ${addResponse.status}`);
    }

    const addResult = await addResponse.json();
    console.log(`✅ 文档已添加到知识库`);
    console.log(`🔍 addResult:`, JSON.stringify(addResult).substring(0, 200));  // 调试日志

    // 🔧 修复：确保返回的id是文件ID，而不是知识库ID
    // addResult可能包含知识库的id，会覆盖fileId
    return {
        id: fileId,           // 文件ID (重要！)
        fileId: fileId,       // 明确的文件ID
        ...addResult,         // 其他信息
        id: fileId            // 再次确保id是文件ID，覆盖addResult中可能的id
    };
}

/**
 * 获取知识库中的文档列表
 * @param {string} kbId - 知识库 ID
 * @returns {Promise<Array>} 文档列表
 */
export async function listDocuments(kbId) {
    return await request(endpoints.knowledgeFiles(kbId), { method: 'GET' });
}

/**
 * 使用 RAG 进行聊天查询
 * @param {Object} options - 查询选项
 * @param {string} options.prompt - 用户问题
 * @param {string} options.kbId - 知识库 ID（Collection Tag 或 UUID）
 * @param {Array<string>} [options.fileIds] - 具体文件 ID 列表（用于精确引用）
 * @param {string} [options.model] - 使用的模型
 * @returns {Promise<Object>} AI 回复
 */
export async function chatWithRAG(options) {
    const {
        prompt,
        messages,
        kbId,
        fileIds = [],
        model = openwebuiConfig.defaultModel,
    } = options;

    console.log(`💬 RAG 查询: ${messages ? `${messages.length} 条消息` : prompt.substring(0, 50)}...`);

    // 构建请求体
    const requestBody = {
        model,
        messages: messages || [
            { role: 'user', content: prompt }
        ],
    };

    // 构建 files 数组
    const filesArray = [];

    // 优先使用具体的文件 ID（更精确的引用）
    if (fileIds && fileIds.length > 0) {
        console.log(`📄 使用 ${fileIds.length} 个具体文件 ID`);
        for (const fid of fileIds) {
            filesArray.push({
                type: 'file',
                id: fid
            });
        }
    }

    // 如果有知识库 ID，也添加到 files 数组（作为补充）
    if (kbId) {
        console.log(`📚 使用知识库: ${kbId}`);
        filesArray.push({
            type: 'collection',
            id: kbId
        });
    }

    // 设置 files 参数
    if (filesArray.length > 0) {
        requestBody.files = filesArray;
    }

    const result = await request(endpoints.chat, {
        method: 'POST',
        body: JSON.stringify(requestBody),
    });

    console.log(`✅ RAG 查询完成`);
    return result;
}

/**
 * 批量同步文档到知识库
 * @param {string} kbId - 知识库 ID
 * @param {Array<{id: number, path: string}>} documents - 文档列表
 * @returns {Promise<{success: number, failed: number, results: Array}>}
 */
export async function syncDocumentsToKB(kbId, documents) {
    console.log(`📦 批量同步 ${documents.length} 个文档到知识库 ${kbId}`);

    let success = 0;
    let failed = 0;
    const results = [];

    // 导入配置以获取数据路径
    const config = await import('../config/index.js');
    const dataPath = config.default.upload.dataPath;

    for (const doc of documents) {
        try {
            // 拼接完整文件路径
            const fullPath = path.join(dataPath, doc.path);

            if (!isSupportedFormat(fullPath)) {
                console.log(`⏭️ 跳过不支持的格式: ${path.basename(fullPath)}`);
                results.push({ id: doc.id, status: 'skipped', reason: 'unsupported_format' });
                continue;
            }

            const result = await uploadDocument(kbId, fullPath, doc.org_name || doc.title);
            results.push({ id: doc.id, status: 'synced', openwebui_doc_id: result.id });
            success++;
        } catch (error) {
            console.error(`❌ 同步文档失败 [${doc.id}]:`, error.message);
            results.push({ id: doc.id, status: 'failed', error: error.message });
            failed++;
        }
    }

    console.log(`📊 同步完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed, results };
}

export default {
    checkHealth,
    createKnowledgeBase,
    listKnowledgeBases,
    getKnowledgeBase,
    deleteKnowledgeBase,
    isSupportedFormat,
    uploadDocument,
    listDocuments,
    chatWithRAG,
    syncDocumentsToKB,
};
