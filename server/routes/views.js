/**
 * 视图管理API路由
 */
import express from 'express';
import viewModel from '../models/view.js';

const router = express.Router();

/**
 * GET /api/views
 * 获取文件的所有视图
 * Query: fileId, sortBy, sortOrder, search
 */
router.get('/', async (req, res) => {
    try {
        const { fileId, sortBy, sortOrder, search } = req.query;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                error: '缺少fileId参数'
            });
        }

        let views;
        if (search) {
            views = await viewModel.searchViews(parseInt(fileId), search);
        } else {
            views = await viewModel.getViewsByFileId(
                parseInt(fileId),
                sortBy,
                sortOrder
            );
        }

        res.json({ success: true, data: views });
    } catch (error) {
        console.error('获取视图列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/views/default
 * 获取文件的默认视图
 * Query: fileId
 */
router.get('/default', async (req, res) => {
    try {
        const { fileId } = req.query;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                error: '缺少fileId参数'
            });
        }

        const view = await viewModel.getDefaultView(parseInt(fileId));

        if (!view) {
            return res.json({ success: true, data: null });
        }

        res.json({ success: true, data: view });
    } catch (error) {
        console.error('获取默认视图失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/views/:id
 * 获取单个视图（包含完整状态数据）
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const view = await viewModel.getViewById(parseInt(id));

        if (!view) {
            return res.status(404).json({
                success: false,
                error: '视图不存在'
            });
        }

        res.json({ success: true, data: view });
    } catch (error) {
        console.error('获取视图失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/views
 * 创建新视图
 */
router.post('/', async (req, res) => {
    try {
        const {
            fileId, name, thumbnail,
            viewer_state, viewerState,
            other_settings, otherSettings
        } = req.body;

        if (!fileId || !name) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: fileId, name'
            });
        }

        // 检查名称是否已存在
        const exists = await viewModel.isNameExists(fileId, name);
        if (exists) {
            return res.status(409).json({
                success: false,
                error: '视图名称已存在'
            });
        }

        const view = await viewModel.createView({
            fileId,
            name,
            thumbnail,
            viewer_state,
            viewerState,
            other_settings,
            otherSettings
        });

        console.log(`✅ 创建视图: ${name} (文件ID: ${fileId})`);
        res.status(201).json({ success: true, data: view });
    } catch (error) {
        console.error('创建视图失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/views/:id
 * 更新视图
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // 如果更新名称，检查是否重复
        if (updates.name) {
            const existingView = await viewModel.getViewById(parseInt(id));
            if (existingView) {
                const exists = await viewModel.isNameExists(
                    existingView.file_id,
                    updates.name,
                    parseInt(id)
                );
                if (exists) {
                    return res.status(409).json({
                        success: false,
                        error: '视图名称已存在'
                    });
                }
            }
        }

        const view = await viewModel.updateView(parseInt(id), updates);

        if (!view) {
            return res.status(404).json({
                success: false,
                error: '视图不存在'
            });
        }

        console.log(`✅ 更新视图: ${view.name}`);
        res.json({ success: true, data: view });
    } catch (error) {
        console.error('更新视图失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/views/:id
 * 删除视图
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const view = await viewModel.deleteView(parseInt(id));

        if (!view) {
            return res.status(404).json({
                success: false,
                error: '视图不存在'
            });
        }

        console.log(`🗑️ 删除视图: ${view.name}`);
        res.json({ success: true, data: view });
    } catch (error) {
        console.error('删除视图失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


/**
 * PUT /api/views/:id/set-default
 * 设置视图为默认视图
 */
router.put('/:id/set-default', async (req, res) => {
    try {
        const { id } = req.params;
        const { isDefault } = req.body;

        const view = await viewModel.setDefaultView(parseInt(id), isDefault !== false);

        if (!view) {
            return res.status(404).json({
                success: false,
                error: '视图不存在'
            });
        }

        console.log(`🏠 ${isDefault !== false ? '设置' : '取消'}默认视图: ${view.name}`);
        res.json({ success: true, data: view });
    } catch (error) {
        console.error('设置默认视图失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

