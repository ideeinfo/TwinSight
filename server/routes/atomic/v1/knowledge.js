/**
 * Atomic API - RAG 知识库检索端点
 * 
 * POST /api/atomic/v1/knowledge/rag-search
 * 透传到现有的 AI 分析服务进行 RAG 检索
 */

import { Router } from 'express';
import axios from 'axios';

const router = Router();

/**
 * POST /rag-search
 * RAG 知识库检索
 * 
 * Body: {
 *   query: string,          // 检索查询文本（必填）
 *   fileId?: number,        // 模型文件 ID（用于定位关联知识库）
 *   kbId?: string,          // 知识库 ID（可选，直接指定）
 *   topK?: number           // 返回结果数量（默认 5）
 * }
 */
router.post('/rag-search', async (req, res) => {
    const startTime = Date.now();

    try {
        const { query, fileId, kbId, topK = 5 } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'query is required',
                    request_id: req.tracing?.requestId
                }
            });
        }

        // 透传到现有的 AI context 接口获取 RAG 上下文数据
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const authHeader = req.headers.authorization;
        const headers = authHeader ? { Authorization: authHeader } : {};

        const resolvedFileId = fileId || req.scope?.fileId;

        const response = await axios.post(
            `${baseUrl}/api/ai/context`,
            {
                roomCode: query,   // 使用 query 作为 roomCode 进行上下文检索
                roomName: query,
                fileId: resolvedFileId
            },
            { headers, timeout: 15000 }
        );

        const contextData = response.data;

        res.json({
            success: true,
            data: {
                assets: contextData.assets || [],
                documents: contextData.documents || [],
                kbId: contextData.kbId || kbId,
                fileIds: contextData.fileIds || [],
                query
            },
            meta: {
                request_id: req.tracing?.requestId,
                duration_ms: Date.now() - startTime,
                source: 'openwebui_rag'
            }
        });
    } catch (error) {
        console.error('❌ [atomic/knowledge/rag-search]', error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: {
                code: 'RAG_SEARCH_FAILED',
                message: error.response?.data?.error || error.message,
                request_id: req.tracing?.requestId
            }
        });
    }
});

export default router;
