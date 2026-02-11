/**
 * AI Analysis API Routes
 * Refactored to use AI Service
 */

import express from 'express';
import { checkHealth as checkOpenWebUIHealth } from '../services/openwebui-service.js';
import aiService from '../services/ai-service.js';
import pool from '../db/index.js'; // Needed for /context additional queries if not moved to service

import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all AI routes
router.use(authenticate);

// Configuration Check (logging only)
console.log(`🔧 AI Analysis Mode: ${aiService.USE_N8N_WORKFLOW ? 'N8N Workflow' : 'Direct Open WebUI request'}`);

/**
 * GET /api/ai/health
 * Check AI Service Health
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
 * Trigger temperature alert analysis
 * Body: { roomCode, roomName, temperature, threshold, alertType, fileId }
 */
router.post('/temperature-alert', async (req, res) => {
    try {
        const { roomCode, temperature } = req.body;
        if (!roomCode || temperature === undefined) {
            return res.status(400).json({ success: false, error: 'Missing required parameters: roomCode, temperature' });
        }

        const dynamicBaseUrl = `${req.protocol}://${req.get('host')}`;
        const result = await aiService.processTemperatureAlert({ ...req.body, dynamicBaseUrl });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Temperature Alert API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/analyze
 * Manual Analysis
 * Body: { type: 'asset'|'room', target: {...}, question?, fileId }
 */
router.post('/analyze', async (req, res) => {
    try {
        const { type, target } = req.body;
        if (!type || !target) {
            return res.status(400).json({ success: false, error: 'Missing required parameters: type, target' });
        }

        const result = await aiService.processManualAnalysis(req.body);

        res.json({
            success: result.success,
            data: result.result
        });
    } catch (error) {
        console.error('❌ Manual Analysis API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ai/context
 * Context Data for N8N or Debgging
 * Query: { roomCode, roomName, fileId }
 */
const handleGetContext = async (req, res) => {
    try {
        // Support both GET (query) and POST (body)
        const { roomCode, roomName, fileId } = req.method === 'POST' ? req.body : req.query;

        if (!roomCode) {
            return res.status(400).json({ success: false, error: 'Missing required parameters: roomCode' });
        }

        // Get Basic Context
        const { assets, documents, searchPatterns } = await aiService.getContextData(roomCode, roomName, fileId);

        // Fetch additional KB/File IDs (Legacy logic kept here for N8N compatibility if needed)
        let kbId = null;
        let fileIds = [];

        if (fileId) {
            try {
                const kbResult = await pool.query('SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1', [fileId]);
                if (kbResult.rows.length > 0) kbId = kbResult.rows[0].openwebui_kb_id;

                // Logic to discover fileIds for context
                const fileIdsQuery = `
                    SELECT kbd.openwebui_file_id 
                    FROM kb_documents kbd
                    JOIN documents d ON kbd.document_id = d.id
                    WHERE kbd.openwebui_file_id IS NOT NULL AND kbd.sync_status = 'synced'
                    AND (d.space_code ILIKE $1 
                        ${roomName ? 'OR d.space_code ILIKE $2' : ''}
                        OR d.file_name ILIKE ANY($3))
                    LIMIT 20
                 `;
                const fileIdsResult = await pool.query(fileIdsQuery, [`%${roomCode}%`, `%${roomName || ''}%`, searchPatterns]);
                fileIds = fileIdsResult.rows.map(r => r.openwebui_file_id);
            } catch (e) { console.warn('Context API KB lookup error', e); }
        }

        res.json({
            success: true,
            assets,
            documents,
            kbId,
            fileIds
        });
    } catch (error) {
        console.error('❌ Context API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/ai/context
 * Context Data for N8N or Debugging
 */
router.get('/context', handleGetContext);
router.post('/context', handleGetContext);

/**
 * POST /api/ai/format-citations
 * Format raw analysis text (typically from N8N result)
 */
router.post('/format-citations', async (req, res) => {
    try {
        const { analysisText, sourceIndexMap, sources } = req.body;
        if (!analysisText) {
            return res.status(400).json({ success: false, error: 'Missing analysisText' });
        }

        // We use aiService.formatAnalysisResult.
        // Needs a bit of adaptation because service expects contextDocs.
        // Here we might not have contextDocs handy unless passed or queried.
        // We'll rely on what's passed or try to format best-effort.

        // This endpoint is effectively handled by aiService.formatAnalysisResult logic now.
        // But aiService needs DB access for resolving OpenWebUI IDs, which it has.
        // It accepts `contextDocs` as fallback. If not provided, it just skips that fallback.

        const { analysis: formattedText, sources: formattedSources } = await aiService.formatAnalysisResult(analysisText, sourceIndexMap, []);

        res.json({
            success: true,
            formattedText,
            sources: formattedSources
        });
    } catch (error) {
        console.error('❌ Format Citations Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai/chat
 * General Chat with AI
 */
router.post('/chat', async (req, res) => {
    try {
        const { message, context, fileId, history } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: 'Missing message' });
        }

        const result = await aiService.processChat(req.body);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Chat API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
