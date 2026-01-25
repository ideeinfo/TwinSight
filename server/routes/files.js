/**
 * 文件上传路由
 * 支持断点续传
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import modelFileModel from '../models/model-file.js';
import assetModel from '../models/asset.js';
import spaceModel from '../models/space.js';
import assetSpecModel from '../models/asset-spec.js';
import { deleteKnowledgeBase } from '../services/openwebui-service.js';
import pg from 'pg';
import config from '../config/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/auth.js';


const { Pool } = pg;
// 懒加载数据库连接池，确保在首次使用时才读取配置（此时环境变量已加载）
let _dbPool = null;
function getDbPool() {
    if (!_dbPool) {
        console.log('📦 初始化知识库数据库连接池...');
        console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '已配置' : '未配置'}`);
        console.log(`   PGHOST: ${process.env.PGHOST || '未配置'}`);
        _dbPool = new Pool(config.database);
    }
    return _dbPool;
}

/**
 * 为模型文件自动创建 Open WebUI 知识库
 */
async function createKnowledgeBaseForModel(modelFile) {
    console.log('\n========== 知识库创建钩子触发 ==========');
    console.log('🔍 模型文件信息:', JSON.stringify(modelFile, null, 2));

    // 运行时读取环境变量（确保 dotenv 已加载）
    const OPENWEBUI_URL = process.env.OPENWEBUI_URL || 'http://localhost:3080';
    const OPENWEBUI_API_KEY = process.env.OPENWEBUI_API_KEY || '';

    console.log('🔑 API Key 状态:', OPENWEBUI_API_KEY ? `已配置 (${OPENWEBUI_API_KEY.substring(0, 10)}...)` : '未配置');
    console.log('🌐 Open WebUI URL:', OPENWEBUI_URL);

    if (!OPENWEBUI_API_KEY) {
        console.log('⚠️ 未配置 OPENWEBUI_API_KEY，跳过知识库创建');
        return null;
    }

    try {
        const kbName = `TwinSight-${modelFile.title}`;
        const kbDescription = `知识库关联模型文件: ${modelFile.title} (${modelFile.original_name})`;

        console.log(`📚 为模型 ${modelFile.title} 创建知识库...`);

        const response = await fetch(`${OPENWEBUI_URL}/api/v1/knowledge/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENWEBUI_API_KEY}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({ name: kbName, description: kbDescription }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`❌ 知识库创建失败: HTTP ${response.status}: ${text}`);
            return null;
        }

        const kb = await response.json();
        console.log(`✅ 知识库创建成功: ${kb.id}`);

        // 保存映射关系到数据库
        try {
            console.log(`📝 准备写入 knowledge_bases 表: file_id=${modelFile.id}, kb_id=${kb.id}`);
            const insertResult = await getDbPool().query(`
                INSERT INTO knowledge_bases (file_id, openwebui_kb_id, kb_name)
                VALUES ($1, $2, $3)
                ON CONFLICT (file_id) DO UPDATE SET
                    openwebui_kb_id = EXCLUDED.openwebui_kb_id,
                    kb_name = EXCLUDED.kb_name,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [modelFile.id, kb.id, kbName]);
            console.log(`💾 知识库映射已保存: ${modelFile.id} -> ${kb.id}, rowCount: ${insertResult.rowCount}`);
        } catch (dbError) {
            console.error(`❌ 数据库写入失败: ${dbError.message}`);
            console.error(`   SQL 参数: file_id=${modelFile.id}, kb_id=${kb.id}, kb_name=${kbName}`);
        }

        return kb;
    } catch (error) {
        console.error(`❌ 创建知识库异常: ${error.message}`);
        return null;
    }
}

const router = Router();

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文件存储目录 - 使用配置路径
import appConfig from '../config/index.js';

const UPLOAD_DIR = appConfig.upload.uploadDir;
const MODELS_DIR = appConfig.upload.modelsDir;
// 临时目录必须和上传目录在同一文件系统，否则 fs.renameSync 会失败 (EXDEV 错误)
const TEMP_DIR = path.join(appConfig.upload.dataPath, 'temp');

// 确保目录存在
[UPLOAD_DIR, MODELS_DIR, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 配置 multer 存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        // 使用临时文件名
        const tempName = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        cb(null, tempName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        // 只允许 zip 文件
        if (file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            file.originalname.endsWith('.zip') ||
            file.originalname.endsWith('.svfzip')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传 SVF ZIP 文件'), false);
        }
    },
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB 限制
    }
});

// ========================================
// 文件上传 API
// ========================================

/**
 * 上传模型文件
 * POST /api/files/upload
 */
router.post('/upload', authenticate, authorize(PERMISSIONS.MODEL_UPLOAD), upload.single('file'), async (req, res) => {
    try {
        const { title } = req.body;
        const file = req.file;

        if (!title) {
            // 删除临时文件
            if (file) fs.unlinkSync(file.path);
            return res.status(400).json({ success: false, error: '请提供文件标题' });
        }

        if (!file) {
            return res.status(400).json({ success: false, error: '请选择要上传的文件' });
        }

        // 生成唯一文件编码
        const fileCode = modelFileModel.generateFileCode();
        const ext = path.extname(file.originalname) || '.zip';
        const newFileName = `${fileCode}${ext}`;
        const newFilePath = path.join(UPLOAD_DIR, newFileName);

        // 移动文件到正式目录
        fs.renameSync(file.path, newFilePath);

        // 创建数据库记录
        const modelFile = await modelFileModel.createModelFile({
            fileCode,
            title,
            originalName: file.originalname,
            filePath: `/files/${newFileName}`,
            fileSize: file.size,
            status: 'uploaded'
        });

        // 异步创建 Open WebUI 知识库（不阻塞响应）
        console.log('\n🚀 模型上传成功，准备创建知识库...');
        console.log('📝 模型 ID:', modelFile.id, '标题:', modelFile.title);
        setImmediate(() => {
            console.log('⏰ setImmediate 执行，开始创建知识库');
            createKnowledgeBaseForModel(modelFile).catch(err => {
                console.error('❌ 知识库创建失败:', err);
            });
        });

        res.json({
            success: true,
            data: modelFile,
            message: '文件上传成功'
        });

    } catch (error) {
        console.error('文件上传失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 断点续传 - 检查已上传的分片
 * GET /api/files/upload/check/:fileCode
 */
router.get('/upload/check/:identifier', authenticate, authorize(PERMISSIONS.MODEL_UPLOAD), async (req, res) => {
    try {
        const { identifier } = req.params;
        const chunkDir = path.join(TEMP_DIR, identifier);

        if (!fs.existsSync(chunkDir)) {
            return res.json({ success: true, uploadedChunks: [] });
        }

        const chunks = fs.readdirSync(chunkDir).map(name => parseInt(name.replace('chunk_', '')));
        res.json({ success: true, uploadedChunks: chunks.sort((a, b) => a - b) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 断点续传 - 上传分片
 * POST /api/files/upload/chunk
 */
router.post('/upload/chunk', authenticate, authorize(PERMISSIONS.MODEL_UPLOAD), upload.single('chunk'), async (req, res) => {
    try {
        const { identifier, chunkIndex, totalChunks, fileName, title } = req.body;
        const chunk = req.file;

        if (!chunk || !identifier || chunkIndex === undefined) {
            if (chunk) fs.unlinkSync(chunk.path);
            return res.status(400).json({ success: false, error: '缺少必要参数' });
        }

        // 创建分片目录
        const chunkDir = path.join(TEMP_DIR, identifier);
        if (!fs.existsSync(chunkDir)) {
            fs.mkdirSync(chunkDir, { recursive: true });
        }

        // 移动分片到分片目录
        const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
        fs.renameSync(chunk.path, chunkPath);

        // 检查是否所有分片都已上传
        const uploadedChunks = fs.readdirSync(chunkDir).length;
        const allUploaded = uploadedChunks >= parseInt(totalChunks);

        if (allUploaded) {
            // 合并分片
            const fileCode = modelFileModel.generateFileCode();
            const ext = path.extname(fileName) || '.zip';
            const newFileName = `${fileCode}${ext}`;
            const newFilePath = path.join(UPLOAD_DIR, newFileName);

            const writeStream = fs.createWriteStream(newFilePath);

            for (let i = 0; i < parseInt(totalChunks); i++) {
                const chunkFile = path.join(chunkDir, `chunk_${i}`);
                const data = fs.readFileSync(chunkFile);
                writeStream.write(data);
            }
            writeStream.end();

            // 等待写入完成
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            // 获取文件大小
            const stats = fs.statSync(newFilePath);

            // 清理分片目录
            fs.rmSync(chunkDir, { recursive: true });

            // 创建数据库记录
            const modelFile = await modelFileModel.createModelFile({
                fileCode,
                title: title || fileName,
                originalName: fileName,
                filePath: `/files/${newFileName}`,
                fileSize: stats.size,
                status: 'uploaded'
            });

            // 异步创建 Open WebUI 知识库（不阻塞响应）
            setImmediate(() => createKnowledgeBaseForModel(modelFile));

            return res.json({
                success: true,
                completed: true,
                data: modelFile,
                message: '文件上传完成'
            });
        }

        res.json({
            success: true,
            completed: false,
            uploadedChunks,
            totalChunks: parseInt(totalChunks)
        });

    } catch (error) {
        console.error('分片上传失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// 文件管理 API
// ========================================

/**
 * 获取所有模型文件
 * GET /api/files
 */
router.get('/', authenticate, authorize(PERMISSIONS.MODEL_READ), async (req, res) => {
    try {
        const files = await modelFileModel.getAllModelFiles();
        res.json({ success: true, data: files });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取当前激活的文件
 * GET /api/files/active
 */
router.get('/active', authenticate, authorize(PERMISSIONS.MODEL_READ), async (req, res) => {
    try {
        const file = await modelFileModel.getActiveModelFile();
        res.json({ success: true, data: file });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取单个文件信息
 * GET /api/files/:id
 */
router.get('/:id', authenticate, authorize(PERMISSIONS.MODEL_READ), async (req, res) => {
    try {
        const file = await modelFileModel.getModelFileById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        res.json({ success: true, data: file });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新文件标题
 * PUT /api/files/:id
 */
router.put('/:id', authenticate, authorize(PERMISSIONS.MODEL_UPLOAD), async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, error: '请提供文件标题' });
        }

        const file = await modelFileModel.getModelFileById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        const updatedFile = await modelFileModel.updateModelFileTitle(req.params.id, title);

        res.json({
            success: true,
            data: updatedFile,
            message: '标题更新成功'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除文件
 * DELETE /api/files/:id
 */
router.delete('/:id', authenticate, authorize(PERMISSIONS.MODEL_DELETE), async (req, res) => {
    try {
        const { deleteKB } = req.query;  // 是否同时删除知识库
        console.log('\n========== 删除文件请求 ==========');
        console.log('📋 文件 ID:', req.params.id);
        console.log('🗑️ deleteKB 参数:', deleteKB);

        const file = await modelFileModel.getModelFileById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        console.log('📁 文件信息:', file.title);

        // 如果需要删除知识库
        if (deleteKB === 'true') {
            console.log('✅ 需要删除知识库');

            // 检查环境变量配置状态
            const openwebuiUrl = process.env.OPENWEBUI_URL || 'http://localhost:3080';
            const openwebuiApiKey = process.env.OPENWEBUI_API_KEY || '';
            console.log(`🔧 环境变量检查: OPENWEBUI_URL=${openwebuiUrl}`);
            console.log(`🔧 环境变量检查: OPENWEBUI_API_KEY=${openwebuiApiKey ? `已配置(${openwebuiApiKey.substring(0, 10)}...)` : '未配置'}`);

            if (!openwebuiApiKey) {
                console.warn('⚠️ OPENWEBUI_API_KEY 未配置，无法删除 Open WebUI 知识库');
            }

            try {
                // 查询关联的知识库
                const kbResult = await getDbPool().query(
                    'SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1',
                    [req.params.id]
                );

                console.log(`📊 查询到 ${kbResult.rows.length} 个知识库记录`);

                if (kbResult.rows.length > 0) {
                    const kbId = kbResult.rows[0].openwebui_kb_id;
                    console.log(`📋 知识库 ID: ${kbId || '空'}`);

                    if (kbId) {
                        console.log(`🗑️ 开始删除 Open WebUI 知识库: ${kbId}`);
                        try {
                            await deleteKnowledgeBase(kbId);
                            console.log(`✅ 知识库删除成功: ${kbId}`);
                        } catch (deleteError) {
                            console.error(`❌ 知识库删除失败: ${kbId}`);
                            console.error(`   错误详情: ${deleteError.message}`);
                            console.error(`   完整错误:`, deleteError);
                        }
                    } else {
                        console.log('⚠️ 知识库 ID 为空，跳过删除');
                    }
                } else {
                    console.log('⚠️ 未找到关联的知识库记录');
                }
            } catch (kbError) {
                console.error('❌ 查询/删除知识库时出错:', kbError.message);
                console.error('   完整错误:', kbError);
                // 继续删除文件，不阻塞
            }
        }


        // 删除物理文件（使用配置路径）
        const filePath = path.join(appConfig.upload.dataPath, file.file_path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 删除解压目录
        if (file.extracted_path) {
            const extractedDir = path.join(appConfig.upload.dataPath, file.extracted_path);
            if (fs.existsSync(extractedDir)) {
                fs.rmSync(extractedDir, { recursive: true });
            }
        }

        // 删除数据库记录（关联的资产、空间、知识库映射等会通过外键级联删除）
        await modelFileModel.deleteModelFile(req.params.id);

        res.json({ success: true, message: '文件删除成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 解压文件
 * POST /api/files/:id/extract
 */
router.post('/:id/extract', authenticate, authorize(PERMISSIONS.MODEL_UPLOAD), async (req, res) => {
    try {
        const file = await modelFileModel.getModelFileById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        // 更新状态为解压中
        await modelFileModel.updateModelFileStatus(file.id, 'extracting');

        // 使用配置路径而非硬编码（生产环境用 /app/uploads，本地用 ./public）
        const zipPath = path.join(appConfig.upload.dataPath, file.file_path);
        const extractDir = path.join(MODELS_DIR, file.file_code);

        // 确保解压目录存在
        if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir, { recursive: true });
        }

        try {
            // 解压文件
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractDir, true);

            // 更新状态为就绪（路径必须与实际解压目录一致）
            const extractedPath = `/models/${file.file_code}`;
            await modelFileModel.updateModelFileStatus(file.id, 'ready', extractedPath);

            res.json({
                success: true,
                message: '解压完成',
                extractedPath
            });
        } catch (extractError) {
            await modelFileModel.updateModelFileStatus(file.id, 'error');
            throw extractError;
        }

    } catch (error) {
        console.error('解压失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 激活文件
 * POST /api/files/:id/activate
 */
router.post('/:id/activate', authenticate, authorize(PERMISSIONS.MODEL_ACTIVATE), async (req, res) => {
    try {
        const file = await modelFileModel.getModelFileById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        if (file.status !== 'ready') {
            return res.status(400).json({ success: false, error: '请先解压文件并提取数据' });
        }

        const activatedFile = await modelFileModel.activateModelFile(file.id);

        res.json({
            success: true,
            data: activatedFile,
            message: '文件已激活'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取文件关联的资产
 * GET /api/files/:id/assets
 */
router.get('/:id/assets', authenticate, authorize(PERMISSIONS.MODEL_READ), async (req, res) => {
    try {
        const assets = await assetModel.getAssetsByFileId(req.params.id);
        res.json({ success: true, data: assets });
    } catch (error) {
        console.error('获取资产失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取文件关联的空间
 * GET /api/files/:id/spaces
 */
router.get('/:id/spaces', authenticate, authorize(PERMISSIONS.MODEL_READ), async (req, res) => {
    try {
        const spaces = await spaceModel.getSpacesByFileId(req.params.id);
        res.json({ success: true, data: spaces });
    } catch (error) {
        console.error('获取空间失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 手动创建知识库
 * POST /api/files/:id/create-kb?force=true
 */
router.post('/:id/create-kb', authenticate, authorize(PERMISSIONS.MODEL_UPLOAD), async (req, res) => {
    try {
        const { force } = req.query;  // 是否强制删除并重建

        const file = await modelFileModel.getModelFileById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        // 检查是否已有知识库
        const existingKb = await getDbPool().query(
            'SELECT id, openwebui_kb_id, kb_name FROM knowledge_bases WHERE file_id = $1',
            [file.id]
        );

        if (existingKb.rows.length > 0 && existingKb.rows[0].openwebui_kb_id) {
            const kbId = existingKb.rows[0].openwebui_kb_id;
            const kbName = existingKb.rows[0].kb_name;

            // 如果已有知识库但未设置force参数，返回提示需要确认
            if (force !== 'true') {
                return res.json({  // 改为 200 OK，避免前端控制台报错
                    success: false,
                    code: 'KB_EXISTS',
                    error: '该模型已关联知识库',
                    data: {
                        kbId: kbId,
                        kbName: kbName,
                        message: '删除现有知识库将丢失所有已上传的文件，是否继续？'
                    }
                });
            }

            // force=true，删除已有知识库
            console.log(`🗑️ 强制删除已有知识库: ${kbId}`);
            try {
                // 先检查Open WebUI中是否存在该知识库
                const { getKnowledgeBase, deleteKnowledgeBase } = await import('../services/openwebui-service.js');
                let kbExists = true;

                try {
                    await getKnowledgeBase(kbId);
                    console.log(`✅ 在Open WebUI中找到知识库: ${kbId}`);
                } catch (checkError) {
                    // 检查是否为知识库不存在的错误
                    // Open WebUI可能返回404或401，但错误消息包含"could not find"
                    const errorMsg = checkError.message || '';
                    const isNotFound = errorMsg.includes('404') ||
                        errorMsg.toLowerCase().includes('could not find') ||
                        errorMsg.toLowerCase().includes('not found');

                    if (isNotFound) {
                        console.log(`⚠️ 知识库在Open WebUI中不存在，可能已被手动删除: ${kbId}`);
                        console.log(`   错误详情: ${errorMsg}`);
                        kbExists = false;
                    } else {
                        // 其他错误（网络问题等）抛出
                        throw checkError;
                    }
                }

                // 只有当知识库存在时才尝试删除
                if (kbExists) {
                    await deleteKnowledgeBase(kbId);
                    console.log(`✅ 知识库删除成功: ${kbId}`);
                } else {
                    console.log(`⏭️ 跳过删除不存在的知识库，直接清理数据库记录`);
                }

                // 3. 显式清理本地数据库记录（即使有 CASCADE 也手动清理以确保万无一失）
                const internalKbId = existingKb.rows[0].id;

                // 3.1 清理文档同步记录 (kb_documents)
                // 按内部主键删除
                const deleteDocsResult = await getDbPool().query(
                    'DELETE FROM kb_documents WHERE kb_id = $1',
                    [internalKbId]
                );
                // 按 Open WebUI ID 删除 (清除可能的存量孤儿数据)
                const deleteOrphansResult = await getDbPool().query(
                    'DELETE FROM kb_documents WHERE openwebui_kb_id = $1',
                    [kbId]
                );
                console.log(`💾 已清理同步记录: ${deleteDocsResult.rowCount} 条关联记录, ${deleteOrphansResult.rowCount} 条孤儿记录`);

                // 3.2 删除知识库映射记录 (knowledge_bases)
                await getDbPool().query(
                    'DELETE FROM knowledge_bases WHERE id = $1',
                    [internalKbId]
                );
                console.log(`💾 knowledge_bases表记录已删除`);

            } catch (deleteError) {
                console.error(`❌ 删除知识库失败:`, deleteError);
                return res.status(500).json({
                    success: false,
                    error: `删除现有知识库失败: ${deleteError.message}`
                });
            }
        }

        // 创建新知识库
        const kb = await createKnowledgeBaseForModel(file);

        if (!kb) {
            return res.status(500).json({
                success: false,
                error: '知识库创建失败，请检查Open WebUI配置'
            });
        }

        res.json({
            success: true,
            data: kb,
            message: force === 'true' ? '知识库已重建' : '知识库创建成功'
        });

    } catch (error) {
        console.error('手动创建知识库失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 手动同步文档到知识库
 * POST /api/files/:id/sync-docs
 */
router.post('/:id/sync-docs', authenticate, authorize(PERMISSIONS.MODEL_UPLOAD), async (req, res) => {
    try {
        const file = await modelFileModel.getModelFileById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        // 检查是否已有知识库
        const kbResult = await getDbPool().query(
            'SELECT id, openwebui_kb_id FROM knowledge_bases WHERE file_id = $1',
            [file.id]
        );

        if (kbResult.rows.length === 0 || !kbResult.rows[0].openwebui_kb_id) {
            return res.status(400).json({
                success: false,
                error: '该模型尚未创建知识库，请先创建知识库'
            });
        }

        const kb = kbResult.rows[0];
        console.log(`📝 开始同步模型 ${file.id} 的文档到知识库 ${kb.openwebui_kb_id}...`);

        // 查询未同步的文档
        const docsResult = await getDbPool().query(`
            SELECT DISTINCT d.id, d.title, d.file_name as org_name, d.file_path as path, d.file_type, d.created_at
            FROM documents d
            LEFT JOIN assets a ON d.asset_code = a.asset_code AND a.file_id = $1
            LEFT JOIN spaces s ON d.space_code = s.space_code AND s.file_id = $1
            LEFT JOIN asset_specs sp ON d.spec_code = sp.spec_code AND sp.file_id = $1
            LEFT JOIN kb_documents kd ON kd.document_id = d.id AND kd.kb_id = $2
            WHERE (a.file_id = $1 OR s.file_id = $1 OR sp.file_id = $1)
              AND d.file_path IS NOT NULL
              AND (kd.id IS NULL OR kd.sync_status != 'synced')
            ORDER BY d.created_at DESC
        `, [file.id, kb.id]);

        const documents = docsResult.rows;
        console.log(`📄 找到 ${documents.length} 个待同步文档`);

        if (documents.length === 0) {
            return res.json({
                success: true,
                data: { total: 0, synced: 0, failed: 0, skipped: 0 },
                message: '没有需要同步的文档'
            });
        }

        // 调用同步函数
        const { syncDocumentsToKB } = await import('../services/openwebui-service.js');
        const syncResult = await syncDocumentsToKB(kb.openwebui_kb_id, documents);

        console.log(`✅ 同步完成: 成功 ${syncResult.success}, 失败 ${syncResult.failed}`);

        res.json({
            success: true,
            data: {
                total: documents.length,
                synced: syncResult.success,
                failed: syncResult.failed,
                skipped: 0
            },
            message: `成功同步 ${syncResult.success} 个文档${syncResult.failed > 0 ? `，${syncResult.failed} 个失败` : ''}`
        });

    } catch (error) {
        console.error('同步文档失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
