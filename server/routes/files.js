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
import pg from 'pg';
import config from '../config/index.js';

const { Pool } = pg;
const dbPool = new Pool(config.database);

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
        const kbName = `Tandem-${modelFile.title}`;
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
        await dbPool.query(`
            INSERT INTO knowledge_bases (file_id, openwebui_kb_id, kb_name)
            VALUES ($1, $2, $3)
            ON CONFLICT (file_id) DO UPDATE SET
                openwebui_kb_id = EXCLUDED.openwebui_kb_id,
                kb_name = EXCLUDED.kb_name,
                updated_at = CURRENT_TIMESTAMP
        `, [modelFile.id, kb.id, kbName]);

        console.log(`💾 知识库映射已保存: ${modelFile.id} -> ${kb.id}`);
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
router.post('/upload', upload.single('file'), async (req, res) => {
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
router.get('/upload/check/:identifier', async (req, res) => {
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
router.post('/upload/chunk', upload.single('chunk'), async (req, res) => {
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
router.get('/', async (req, res) => {
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
router.get('/active', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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
            try {
                // 查询关联的知识库
                const kbResult = await dbPool.query(
                    'SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1',
                    [req.params.id]
                );

                if (kbResult.rows.length > 0) {
                    const kbId = kbResult.rows[0].openwebui_kb_id;
                    const OPENWEBUI_URL = process.env.OPENWEBUI_URL || 'http://localhost:3080';
                    const OPENWEBUI_API_KEY = process.env.OPENWEBUI_API_KEY || '';

                    if (OPENWEBUI_API_KEY && kbId) {
                        console.log(`🗑️ 删除 Open WebUI 知识库: ${kbId}`);
                        // 正确的删除端点是 /api/v1/knowledge/{id}/delete
                        const response = await fetch(`${OPENWEBUI_URL}/api/v1/knowledge/${kbId}/delete`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${OPENWEBUI_API_KEY}`,
                            },
                        });

                        if (response.ok) {
                            console.log(`✅ 知识库删除成功`);
                        } else {
                            console.error(`⚠️ 知识库删除失败: HTTP ${response.status}`);
                        }
                    }
                }
            } catch (kbError) {
                console.error('删除知识库时出错:', kbError.message);
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
router.post('/:id/extract', async (req, res) => {
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
router.post('/:id/activate', async (req, res) => {
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
router.get('/:id/assets', async (req, res) => {
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
router.get('/:id/spaces', async (req, res) => {
    try {
        const spaces = await spaceModel.getSpacesByFileId(req.params.id);
        res.json({ success: true, data: spaces });
    } catch (error) {
        console.error('获取空间失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
