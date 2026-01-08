/**
 * API 路由模块
 * 提供 RESTful API 接口
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import classificationModel from '../models/classification.js';
import assetSpecModel from '../models/asset-spec.js';
import assetModel from '../models/asset.js';
import spaceModel from '../models/space.js';
import { getMappingConfig, saveMappingConfig } from '../models/mapping-config.js';
import appConfig from '../config/index.js';

const router = Router();

// ========================================
// 调试 API（临时，用于检查文件结构）
// ========================================

/**
 * 检查服务器文件结构
 * GET /api/debug/files?path=/models
 */
router.get('/debug/files', async (req, res) => {
    try {
        const relativePath = req.query.path || '';
        const basePath = appConfig.upload.dataPath;
        const targetPath = path.join(basePath, relativePath);

        // 安全检查：确保路径在 dataPath 内
        const realPath = path.resolve(targetPath);
        if (!realPath.startsWith(path.resolve(basePath))) {
            return res.status(403).json({ success: false, error: '路径不允许' });
        }

        const result = {
            basePath,
            targetPath,
            exists: fs.existsSync(targetPath),
            files: [],
            env: {
                DATA_PATH: process.env.DATA_PATH,
                NODE_ENV: process.env.NODE_ENV
            }
        };

        if (result.exists) {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
                result.files = fs.readdirSync(targetPath).map(name => {
                    const filePath = path.join(targetPath, name);
                    const fileStat = fs.statSync(filePath);
                    return {
                        name,
                        isDir: fileStat.isDirectory(),
                        size: fileStat.size
                    };
                });
            } else {
                result.isFile = true;
                result.size = stat.size;
            }
        }

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// 检查现有数据 API
// ========================================

/**
 * 检查文件是否已有导出的数据
 * GET /api/check-existing-data/:fileId
 */
router.get('/check-existing-data/:fileId', async (req, res) => {
    try {
        const fileId = parseInt(req.params.fileId);
        if (isNaN(fileId)) {
            return res.status(400).json({ success: false, error: '无效的文件ID' });
        }

        // Check if there are any assets or spaces for this file
        const assets = await assetModel.getAssetsByFileId(fileId);
        const spaces = await spaceModel.getSpacesByFileId(fileId);

        const hasData = (assets && assets.length > 0) || (spaces && spaces.length > 0);

        res.json({ success: true, hasData, counts: { assets: assets?.length || 0, spaces: spaces?.length || 0 } });
    } catch (error) {
        console.error('检查现有数据失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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

/**
 * 更新资产规格
 * PATCH /api/asset-specs/:code
 */
router.patch('/asset-specs/:code', async (req, res) => {
    try {
        const code = req.params.code;
        const updates = req.body;

        // 验证更新字段
        const allowedFields = [
            'spec_name', 'classification_code', 'classification_desc',
            'category', 'family', 'type', 'manufacturer', 'address', 'phone'
        ];

        const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: '没有有效的更新字段' });
        }

        const spec = await assetSpecModel.updateAssetSpec(code, updates);
        if (!spec) {
            return res.status(404).json({ success: false, error: '规格不存在' });
        }
        res.json({ success: true, message: '规格更新成功', data: spec });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新资产规格(兼容路由 - 支持前端 /api/assets/specs/:code 调用)
 * PATCH /api/assets/specs/:code
 */
router.patch('/assets/specs/:code', async (req, res) => {
    try {
        const code = req.params.code;
        const updates = req.body;

        // 验证更新字段
        const allowedFields = [
            'spec_name', 'classification_code', 'classification_desc',
            'category', 'family', 'type', 'manufacturer', 'address', 'phone'
        ];

        const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: '没有有效的更新字段' });
        }

        const spec = await assetSpecModel.updateAssetSpec(code, updates);
        if (!spec) {
            return res.status(404).json({ success: false, error: '规格不存在' });
        }
        res.json({ success: true, message: '规格更新成功', data: spec });
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

/**
 * 更新资产属性
 * PATCH /api/assets/:code
 */
router.patch('/assets/:code', async (req, res) => {
    try {
        const code = req.params.code;
        const updates = req.body;

        // 验证更新字段
        const allowedFields = [
            'spec_code', 'spec_name', 'name', 'floor', 'room',
            'classification_code', 'classification_desc',
            'category', 'family', 'type', 'manufacturer', 'address', 'phone'
        ];

        const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: '没有有效的更新字段' });
        }

        await assetModel.updateAsset(code, updates);
        res.json({ success: true, message: '资产更新成功' });
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

/**
 * 更新空间属性
 * PATCH /api/spaces/:code
 */
router.patch('/spaces/:code', async (req, res) => {
    try {
        const code = req.params.code;
        const updates = req.body;

        // 验证更新字段
        const allowedFields = [
            'name', 'classification_code', 'classification_desc',
            'floor', 'area', 'perimeter'
        ];

        const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: '没有有效的更新字段' });
        }

        await spaceModel.updateSpace(code, updates);
        res.json({ success: true, message: '空间更新成功' });
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
        const { fileId, assets = [], spaces = [], clearExisting = false } = req.body;

        console.log(`📥 收到导入请求: fileId=${fileId}, assets=${assets.length}, spaces=${spaces.length}, clearExisting=${clearExisting}`);

        // 0. 如果请求清空旧数据，且提供了 fileId
        if (clearExisting && fileId) {
            console.log(`🧹 根据 fileId=${fileId} 清除旧数据...`);
            // 为了保证事务完整性，最好将这些操作放在一个事务中。
            // 简单起见，我们逐个清理，因为下面的插入也是独立的。
            // 理想情况下，整个流程应该是一个大事务。
            // 但由于 Model 方法是分别开启事务的，我们先简单处理。

            // 注意：删除顺序很重要（由于外键约束）
            // 依赖关系: assets -> asset_specs (通常无外键，或软关联), spaces
            // 但我们的 schema 里 assets 和 spaces 引用 model_files，并未相互强引用。

            // 使用统一的清理逻辑（需确保 models 支持）
            // 目前 models 里的 batchUpsert...WithFile 其实已经包含了一定的清理逻辑（DELETE WHERE file_id = ...）
            // 让我们检查一下 models...
            // spaceModel.batchUpsertSpacesWithFile -> 会先 DELETE
            // assetModel.batchUpsertAssetsWithFile -> 只是 ON CONFLICT UPDATE

            // 所以我们需要显式清理 assets 和 asset_specs（如果是基于 file_id 的）

            // 为了安全，我们可以在这里直接调用 DB 删除，或者给 model 添加 deleteByFileId 方法
            // 简单起见，我们假设 batchUpsert...WithFile 会被修改为先删除，或者我们在下面修改 models。
            // 让我们先在这里做一次性清理。

            const client = await import('../db/index.js').then(m => m.getClient());
            try {
                await client.query('BEGIN');
                // 先删子表/关联表（如果有）
                await client.query('DELETE FROM assets WHERE file_id = $1', [fileId]);
                await client.query('DELETE FROM spaces WHERE file_id = $1', [fileId]);
                // asset_specs 是共享的吗？看 schema 也是有 file_id 的。
                await client.query('DELETE FROM asset_specs WHERE file_id = $1', [fileId]);
                // classifications 也是有 file_id 的
                await client.query('DELETE FROM classifications WHERE file_id = $1', [fileId]);
                await client.query('COMMIT');
                console.log('✅ 旧数据清理完成');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('❌ 清理旧数据失败:', err);
                throw err;
            } finally {
                client.release();
            }
        }

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
            await classificationModel.batchUpsertClassifications(classifications, fileId);
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

// ========================================
// 映射配置 API
// ========================================

/**
 * 获取文件的映射配置
 * GET /api/mapping-config/:fileId
 */
router.get('/mapping-config/:fileId', async (req, res) => {
    try {
        const fileId = parseInt(req.params.fileId);
        if (isNaN(fileId)) {
            return res.status(400).json({ success: false, error: '无效的文件ID' });
        }

        const config = await getMappingConfig(fileId);
        res.json({ success: true, data: config });
    } catch (error) {
        console.error('获取映射配置失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 保存文件的映射配置
 * POST /api/mapping-config/:fileId
 * 请求体: { assetMapping: {...}, assetSpecMapping: {...}, spaceMapping: {...} }
 */
router.post('/mapping-config/:fileId', async (req, res) => {
    try {
        const fileId = parseInt(req.params.fileId);
        if (isNaN(fileId)) {
            return res.status(400).json({ success: false, error: '无效的文件ID' });
        }

        const { assetMapping, assetSpecMapping, spaceMapping } = req.body;

        await saveMappingConfig(fileId, {
            assetMapping,
            assetSpecMapping,
            spaceMapping
        });

        res.json({ success: true, message: '映射配置保存成功' });
    } catch (error) {
        console.error('保存映射配置失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
