/**
 * Atomic API - RAG 知识库检索端点
 * 
 * POST /api/atomic/v1/knowledge/rag-search
 * 通过 fileId -> knowledge_bases 映射，调用 Open WebUI 进行真正的 RAG 检索
 */

import { Router } from 'express';
import { query } from '../../../db/index.js';
import { chatWithRAG } from '../../../services/openwebui-service.js';

const router = Router();

/**
 * POST /rag-search
 * RAG 知识库检索
 * 
 * Body: {
 *   query: string,          // 检索查询文本（必填）
 *   fileId?: number,        // 模型文件 ID（用于定位关联知识库）
 *   kbId?: string,          // 知识库 ID（可选，直接指定，优先级最高）
 *   topK?: number           // 返回结果数量（兼容字段，暂未下沉到底层检索深度控制）
 * }
 */
router.post('/rag-search', async (req, res) => {
    const startTime = Date.now();

    try {
        const { query: searchQuery, fileId, kbId, topK = 5 } = req.body;

        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: 'query is required',
                    request_id: req.tracing?.requestId
                }
            });
        }

        // ========== 解析知识库 ID ==========
        let resolvedKbId = null;

        if (kbId) {
            // 优先级1: 显式传入 kbId，直接使用
            resolvedKbId = kbId;
            console.log(`📚 [rag-search] 使用显式 kbId: ${resolvedKbId}`);
        } else {
            // 优先级2: 通过 fileId 查询 knowledge_bases 表
            const resolvedFileId = fileId || req.scope?.fileId;

            if (!resolvedFileId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_PARAMS',
                        message: 'Either kbId or fileId is required. fileId can be provided via request body or X-File-Id header.',
                        request_id: req.tracing?.requestId
                    }
                });
            }

            // 查询 fileId -> openwebui_kb_id 映射
            const kbResult = await query(
                'SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1',
                [resolvedFileId]
            );

            if (kbResult.rows.length === 0 || !kbResult.rows[0].openwebui_kb_id) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'KNOWLEDGE_BASE_NOT_FOUND',
                        message: `No knowledge base mapping found for fileId ${resolvedFileId}`,
                        request_id: req.tracing?.requestId
                    }
                });
            }

            resolvedKbId = kbResult.rows[0].openwebui_kb_id;
            console.log(`📚 [rag-search] fileId=${resolvedFileId} -> kbId=${resolvedKbId}`);
        }

        // ========== 构建定向事实提取的 Prompt ==========
        const systemPrompt = `你是一个精准的知识库内容提取引擎。请基于用户输入的问题，从提供的文档知识库中提取核心事实、维修步骤或参数指标。不要包含任何无意义的闲聊和客套话，以高度结构化的条目列表直接返回客观事实；如果提供的文档中确实找不到能够回答该问题的内容，请仅回复 "NO_MATCH"。`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: searchQuery }
        ];

        // 发起 RAG 对话检索（传入解析后的真实 kbId）
        const ragResponse = await chatWithRAG({
            prompt: searchQuery,
            messages,
            kbId: resolvedKbId,
            // topK 暂为兼容字段，不下沉到底层 Open WebUI 检索深度控制
        });

        // 提取萃取的内容
        const answer = ragResponse?.choices?.[0]?.message?.content || 'NO_MATCH';
        const isMatched = answer !== 'NO_MATCH' && !answer.includes('NO_MATCH');

        res.json({
            success: true,
            data: {
                results: isMatched ? [{ content: answer, score: 1.0 }] : [],
                kbId: resolvedKbId,
                query: searchQuery
            },
            meta: {
                request_id: req.tracing?.requestId,
                duration_ms: Date.now() - startTime,
                source: 'openwebui_rag_extractor'
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
