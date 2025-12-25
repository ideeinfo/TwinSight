/**
 * Open WebUI 连接配置
 * 用于知识库管理和 RAG 功能
 */

export default {
    // 基础配置
    baseUrl: process.env.OPENWEBUI_URL || 'http://localhost:3080',
    apiKey: process.env.OPENWEBUI_API_KEY || '',

    // API 端点
    endpoints: {
        // 知识库管理
        knowledgeList: '/api/v1/knowledge/',
        knowledgeCreate: '/api/v1/knowledge/create',
        knowledgeById: (kbId) => `/api/v1/knowledge/${kbId}`,

        // 文档管理
        knowledgeFiles: (kbId) => `/api/v1/knowledge/${kbId}/file/add`,
        uploadFile: (kbId) => `/api/v1/knowledge/${kbId}/file/add`,

        // 聊天 API (带 RAG)
        chat: '/api/chat/completions',

        // 健康检查
        health: '/health',
    },

    // 支持的 RAG 格式
    supportedFormats: [
        '.docx', '.doc',   // Word
        '.xlsx', '.xls',   // Excel
        '.pptx', '.ppt',   // PowerPoint
        '.pdf',            // PDF
        '.md',             // Markdown
        '.txt',            // 纯文本
        '.csv',            // CSV
        '.json',           // JSON
    ],

    // 默认模型配置
    defaultModel: 'gemini-2.0-flash',

    // RAG 配置
    rag: {
        searchMode: 'hybrid',      // hybrid | semantic | keyword
        topK: 5,                   // 返回的最相似文档数量
        allowWebSearch: true,      // 允许联网搜索
    },
};
