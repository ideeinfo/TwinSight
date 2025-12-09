/**
 * API 路由模块
 * 提供 RESTful API 接口
 */
import { Router } from 'express';
import classificationModel from '../models/classification.js';
import assetSpecModel from '../models/asset-spec.js';
import assetModel from '../models/asset.js';
import spaceModel from '../models/space.js';

const router = Router();

// ========================================
// 分类编码 API
// ========================================

/**
 * 获取所有分类编码
 * GET /api/classifications?type=asset|space
 */
router.get('/classifications', async (req, res) => {
    try {
        const { type } = req.query;
        const classifications = await classificationModel.getAllClassifications(type);
        res.json({ success: true, data: classifications });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量导入分类编码
 * POST /api/classifications/batch
 */
router.post('/classifications/batch', async (req, res) => {
    try {
        const { classifications } = req.body;
        if (!Array.isArray(classifications)) {
            return res.status(400).json({ success: false, error: '请提供 classifications 数组' });
        }
        await classificationModel.batchUpsertClassifications(classifications);
        res.json({ success: true, message: `成功导入 ${classifications.length} 条分类编码` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// 资产规格 API
// ========================================

/**
 * 获取所有资产规格
 * GET /api/asset-specs
 */
router.get('/asset-specs', async (req, res) => {
    try {
        const specs = await assetSpecModel.getAllAssetSpecs();
        res.json({ success: true, data: specs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 根据规格编码获取资产规格
 * GET /api/asset-specs/:code
 */
router.get('/asset-specs/:code', async (req, res) => {
    try {
        const spec = await assetSpecModel.getAssetSpecByCode(req.params.code);
        if (!spec) {
            return res.status(404).json({ success: false, error: '规格不存在' });
        }
        res.json({ success: true, data: spec });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量导入资产规格
 * POST /api/asset-specs/batch
 */
router.post('/asset-specs/batch', async (req, res) => {
    try {
        const { specs } = req.body;
        if (!Array.isArray(specs)) {
            return res.status(400).json({ success: false, error: '请提供 specs 数组' });
        }
        await assetSpecModel.batchUpsertAssetSpecs(specs);
        res.json({ success: true, message: `成功导入 ${specs.length} 条资产规格` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// 资产 API
// ========================================

/**
 * 获取所有资产
 * GET /api/assets
 */
router.get('/assets', async (req, res) => {
    try {
        const assets = await assetModel.getAllAssets();
        res.json({ success: true, data: assets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 根据资产编码获取资产
 * GET /api/assets/:code
 */
router.get('/assets/:code', async (req, res) => {
    try {
        const asset = await assetModel.getAssetByCode(req.params.code);
        if (!asset) {
            return res.status(404).json({ success: false, error: '资产不存在' });
        }
        res.json({ success: true, data: asset });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 根据楼层获取资产
 * GET /api/assets/floor/:floor
 */
router.get('/assets/floor/:floor', async (req, res) => {
    try {
        const assets = await assetModel.getAssetsByFloor(req.params.floor);
        res.json({ success: true, data: assets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 根据房间获取资产
 * GET /api/assets/room/:room
 */
router.get('/assets/room/:room', async (req, res) => {
    try {
        const assets = await assetModel.getAssetsByRoom(req.params.room);
        res.json({ success: true, data: assets });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量导入资产
 * POST /api/assets/batch
 */
router.post('/assets/batch', async (req, res) => {
    try {
        const { assets } = req.body;
        if (!Array.isArray(assets)) {
            return res.status(400).json({ success: false, error: '请提供 assets 数组' });
        }
        await assetModel.batchUpsertAssets(assets);
        res.json({ success: true, message: `成功导入 ${assets.length} 条资产` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// 空间 API
// ========================================

/**
 * 获取所有空间
 * GET /api/spaces
 */
router.get('/spaces', async (req, res) => {
    try {
        const spaces = await spaceModel.getAllSpaces();
        res.json({ success: true, data: spaces });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 根据空间编码获取空间
 * GET /api/spaces/:code
 */
router.get('/spaces/:code', async (req, res) => {
    try {
        const space = await spaceModel.getSpaceByCode(req.params.code);
        if (!space) {
            return res.status(404).json({ success: false, error: '空间不存在' });
        }
        res.json({ success: true, data: space });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 根据楼层获取空间
 * GET /api/spaces/floor/:floor
 */
router.get('/spaces/floor/:floor', async (req, res) => {
    try {
        const spaces = await spaceModel.getSpacesByFloor(req.params.floor);
        res.json({ success: true, data: spaces });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 批量导入空间
 * POST /api/spaces/batch
 */
router.post('/spaces/batch', async (req, res) => {
    try {
        const { spaces } = req.body;
        if (!Array.isArray(spaces)) {
            return res.status(400).json({ success: false, error: '请提供 spaces 数组' });
        }
        await spaceModel.batchUpsertSpaces(spaces);
        res.json({ success: true, message: `成功导入 ${spaces.length} 条空间` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// 综合导入 API（从模型提取的数据）
// ========================================

/**
 * 从模型导入所有数据
 * POST /api/import/model-data
 * 请求体: { fileId: number, assets: [...], spaces: [...] }
 */
router.post('/import/model-data', async (req, res) => {
    try {
        const { fileId, assets = [], spaces = [] } = req.body;

        console.log(`📥 收到导入请求: fileId=${fileId}, assets=${assets.length}, spaces=${spaces.length}`);

        // 1. 提取并保存分类编码
        const classifications = [];
        const specsMap = new Map();

        // 从资产提取分类和规格
        for (const asset of assets) {
            // 分类编码
            if (asset.omniClass21Number) {
                classifications.push({
                    classificationCode: asset.omniClass21Number,
                    classificationDesc: asset.omniClass21Description || '',
                    classificationType: 'asset'
                });
            }

            // 资产规格（按类型注释去重）
            if (asset.typeComments && !specsMap.has(asset.typeComments)) {
                specsMap.set(asset.typeComments, {
                    specCode: asset.typeComments,
                    specName: asset.typeName || '',
                    classificationCode: asset.omniClass21Number || '',
                    classificationDesc: asset.omniClass21Description || '',
                    category: asset.category || '',
                    family: asset.family || '',
                    type: asset.type || '',
                    manufacturer: asset.manufacturer || '',
                    address: asset.address || '',
                    phone: asset.phone || ''
                });
            }
        }

        // 从空间提取分类
        for (const space of spaces) {
            if (space.classificationCode) {
                classifications.push({
                    classificationCode: space.classificationCode,
                    classificationDesc: space.classificationDesc || '',
                    classificationType: 'space'
                });
            }
        }

        // 2. 批量保存分类编码
        if (classifications.length > 0) {
            await classificationModel.batchUpsertClassifications(classifications);
        }

        // 3. 批量保存资产规格（如果有 fileId，则关联）
        const specs = Array.from(specsMap.values());
        if (specs.length > 0) {
            if (fileId) {
                await assetSpecModel.batchUpsertAssetSpecsWithFile(specs, fileId);
            } else {
                await assetSpecModel.batchUpsertAssetSpecs(specs);
            }
        }

        // 4. 批量保存资产（如果有 fileId，则关联）
        const assetRecords = assets.map(a => ({
            assetCode: a.mcCode,
            specCode: a.typeComments || null,
            name: a.name || '',
            floor: a.floor || '',
            room: a.room || '',
            dbId: a.dbId
        })).filter(a => a.assetCode);

        if (assetRecords.length > 0) {
            if (fileId) {
                await assetModel.batchUpsertAssetsWithFile(assetRecords, fileId);
            } else {
                await assetModel.batchUpsertAssets(assetRecords);
            }
        }

        // 5. 批量保存空间（如果有 fileId，则关联）
        const spaceRecords = spaces.map(s => ({
            spaceCode: s.spaceCode,
            name: s.name || '',
            classificationCode: s.classificationCode || '',
            classificationDesc: s.classificationDesc || '',
            floor: s.floor || '',
            area: s.area ? parseFloat(s.area) : null,
            perimeter: s.perimeter ? parseFloat(s.perimeter) : null,
            dbId: s.dbId
        })).filter(s => s.spaceCode);

        if (spaceRecords.length > 0) {
            if (fileId) {
                await spaceModel.batchUpsertSpacesWithFile(spaceRecords, fileId);
            } else {
                await spaceModel.batchUpsertSpaces(spaceRecords);
            }
        }

        res.json({
            success: true,
            message: '数据导入成功',
            summary: {
                classifications: classifications.length,
                specs: specs.length,
                assets: assetRecords.length,
                spaces: spaceRecords.length
            }
        });

    } catch (error) {
        console.error('导入数据失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
