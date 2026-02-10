import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import ExifParser from 'exif-parser';
import documentModel from '../models/document.js';
import documentExifModel from '../models/document-exif.js';
import openwebuiService from '../services/openwebui-service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/auth.js';
import appConfig from '../config/index.js';
import { processNewDocument } from '../services/document-intelligence-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 配置文件上传
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = appConfig.upload.docsDir;
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        // 使用更安全的唯一文件名
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const ext = path.extname(file.originalname);
        // 唯一编码：时间戳_随机字符串.扩展名
        const uniqueName = `${timestamp}_${random}${ext}`;
        cb(null, uniqueName);
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/svg+xml',
        'video/mp4'
    ];

    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.svg', '.mp4'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型。仅支持 PDF, JPG, PNG, SVG, MP4 格式'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 200 * 1024 * 1024 // 200MB 限制
    }
});

/**
 * 提取图像 EXIF 信息
 * @param {string} filePath - 文件路径
 * @param {string} fileType - 文件类型
 * @returns {Object|null} EXIF 数据
 */
/**
 * 提取图像 EXIF 信息
 * @param {string} filePath - 文件路径
 * @param {string} fileType - 文件类型
 * @returns {Object|null} EXIF 数据
 */
async function extractExif(filePath, fileType) {
    // 只处理 JPG/JPEG 文件（PNG 通常不包含 EXIF）
    if (!['jpg', 'jpeg'].includes(fileType.toLowerCase())) {
        return null;
    }

    let fileHandle = null;
    try {
        // 优化：只读取文件头部 64KB (通常 EXIF 信息都在头部)
        // 避免读取整个文件导致内存飙升
        fileHandle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(65536); // 64KB
        const { bytesRead } = await fileHandle.read(buffer, 0, 65536, 0);

        // 如果文件小于 64KB，切片为实际大小
        const dataToParse = bytesRead < 65536 ? buffer.subarray(0, bytesRead) : buffer;

        const parser = ExifParser.create(dataToParse);
        const result = parser.parse();

        if (!result || !result.tags) {
            return null;
        }

        const tags = result.tags;
        const imageSize = result.imageSize || {};

        // 处理日期时间
        let dateTime = null;
        if (tags.DateTimeOriginal) {
            // EXIF 日期格式通常是 Unix 时间戳
            dateTime = new Date(tags.DateTimeOriginal * 1000);
        } else if (tags.CreateDate) {
            dateTime = new Date(tags.CreateDate * 1000);
        }

        // 处理 GPS 坐标
        let gpsLongitude = null;
        let gpsLatitude = null;
        if (tags.GPSLongitude !== undefined && tags.GPSLatitude !== undefined) {
            gpsLongitude = tags.GPSLongitude;
            gpsLatitude = tags.GPSLatitude;
        }

        // 处理曝光时间（转换为分数形式）
        let exposureTime = null;
        if (tags.ExposureTime) {
            if (tags.ExposureTime < 1) {
                exposureTime = `1/${Math.round(1 / tags.ExposureTime)}s`;
            } else {
                exposureTime = `${tags.ExposureTime}s`;
            }
        }

        return {
            // 文件组
            dateTime,
            imageWidth: imageSize.width || tags.ImageWidth || tags.ExifImageWidth,
            imageHeight: imageSize.height || tags.ImageHeight || tags.ExifImageHeight,

            // 照相机组
            equipModel: tags.Model || tags.Make,
            fNumber: tags.FNumber,
            exposureTime,
            isoSpeed: tags.ISO,
            focalLength: tags.FocalLength,

            // GPS组
            gpsLongitude,
            gpsLatitude,
            gpsAltitude: tags.GPSAltitude
        };
    } catch (error) {
        // 只有当错误不是"Buffer is too small"时才记录错误
        // ExifParser 有时在数据不完整时会抛出错误，这是预期行为
        if (error.message !== 'Buffer is too small') {
            console.error('提取 EXIF 信息失败:', error.message);
        }
        return null;
    } finally {
        if (fileHandle) {
            await fileHandle.close();
        }
    }
}

/**
 * 上传文档
 * POST /api/documents/upload
 * 表单数据: file, assetCode/spaceCode/specCode, title (可选)
 */
router.post('/upload', authenticate, authorize(PERMISSIONS.DOCUMENT_CREATE), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '没有上传文件' });
        }

        const { assetCode, spaceCode, specCode, viewId, title } = req.body;

        // 验证必须有一个关联对象
        if (!assetCode && !spaceCode && !specCode && !viewId) {
            // 删除已上传的文件
            await fs.unlink(req.file.path);
            return res.status(400).json({
                success: false,
                error: '必须指定 assetCode, spaceCode, specCode 或 viewId'
            });
        }

        // 修复中文文件名编码问题：multer 会将 UTF-8 编码的文件名以 latin1 方式存储
        // 需要将其转换回 UTF-8
        let originalName = req.file.originalname;
        try {
            // 尝试将 latin1 编码转换为 UTF-8
            originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        } catch (e) {
            // 如果转换失败，使用原始文件名
            console.warn('文件名编码转换失败，使用原始文件名:', e.message);
        }

        const doc = {
            title: title || originalName, // 默认使用文件名
            fileName: originalName,
            filePath: `/docs/${req.file.filename}`,
            fileSize: req.file.size,
            fileType: path.extname(originalName).substring(1).toLowerCase(),
            mimeType: req.file.mimetype,
            assetCode: assetCode || null,
            spaceCode: spaceCode || null,
            specCode: specCode || null,
            viewId: viewId || null
        };

        const result = await documentModel.createDocument(doc);

        // 提取并保存 EXIF 信息（仅 JPG/JPEG）
        let exifData = null;
        if (['jpg', 'jpeg'].includes(doc.fileType)) {
            const exif = await extractExif(req.file.path, doc.fileType);
            if (exif) {
                exifData = await documentExifModel.createExif({
                    documentId: result.id,
                    ...exif
                });
                console.log(`EXIF 信息已保存: 文档ID ${result.id}`);
            }
        }

        // 异步触发智能分析 (缩略图生成、类型检测、自动打标签等)
        processNewDocument(result.id, doc.filePath, doc.fileName).catch(err => {
            console.error('[Documents] Intelligence processing error:', err);
        });

        res.json({ success: true, data: result, exif: exifData });

        // 文档同步由后台服务 (document-sync-service.js) 统一处理
        // 不在这里进行即时同步，避免重复处理
    } catch (error) {
        console.error('文档上传失败:', error);
        // 如果创建记录失败，删除已上传的文件
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('删除文件失败:', unlinkError);
            }
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取文档列表（包含 EXIF 信息）
 * GET /api/documents?assetCode=xxx 或 ?spaceCode=xxx 或 ?specCode=xxx
 */
router.get('/', authenticate, authorize(PERMISSIONS.DOCUMENT_READ), async (req, res) => {
    try {
        const { assetCode, spaceCode, specCode } = req.query;

        // 使用带有 EXIF 信息的查询
        const documents = await documentExifModel.getDocumentsWithExif({
            assetCode,
            spaceCode,
            specCode
        });

        res.json({ success: true, data: documents });
    } catch (error) {
        console.error('获取文档列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取文档详情
 * GET /api/documents/:id
 */
router.get('/:id', authenticate, authorize(PERMISSIONS.DOCUMENT_READ), async (req, res) => {
    try {
        const { id } = req.params;
        const document = await documentModel.getDocumentById(id);

        if (!document) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        res.json({ success: true, data: document });
    } catch (error) {
        console.error('获取文档详情失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取文档 EXIF 信息
 * GET /api/documents/:id/exif
 */
router.get('/:id/exif', authenticate, authorize(PERMISSIONS.DOCUMENT_READ), async (req, res) => {
    try {
        const { id } = req.params;

        // 验证文档存在
        const document = await documentModel.getDocumentById(id);
        if (!document) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        // 获取 EXIF 信息
        const exif = await documentExifModel.getExifByDocumentId(id);

        if (!exif) {
            return res.json({
                success: true,
                data: null,
                message: '该文档没有 EXIF 信息'
            });
        }

        // 格式化为分组结构
        const exifGroups = documentExifModel.formatExifGroups(exif);

        res.json({ success: true, data: exif, groups: exifGroups });
    } catch (error) {
        console.error('获取 EXIF 信息失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新文档标题
 * PUT /api/documents/:id
 * body: { title }
 */
router.put('/:id', authenticate, authorize(PERMISSIONS.DOCUMENT_UPDATE), async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ success: false, error: '标题不能为空' });
        }

        const result = await documentModel.updateDocumentTitle(id, title.trim());

        if (!result) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('更新文档标题失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除文档
 * DELETE /api/documents/:id
 */
router.delete('/:id', authenticate, authorize(PERMISSIONS.DOCUMENT_DELETE), async (req, res) => {
    try {
        const { id } = req.params;

        // 先获取文档信息以删除文件
        const document = await documentModel.getDocumentById(id);

        if (!document) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        // 删除数据库记录
        const result = await documentModel.deleteDocument(id);

        // 删除物理文件
        const filePath = path.join(appConfig.upload.dataPath, document.file_path);
        try {
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error('删除文件失败:', unlinkError);
            // 继续执行，不影响数据库删除
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('删除文档失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 下载文档
 * GET /api/documents/:id/download
 */
router.get('/:id/download', authenticate, authorize(PERMISSIONS.DOCUMENT_READ), async (req, res) => {
    try {
        const { id } = req.params;
        const document = await documentModel.getDocumentById(id);

        if (!document) {
            return res.status(404).json({ success: false, error: '文档不存在' });
        }

        const filePath = path.join(appConfig.upload.dataPath, document.file_path);

        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }

        // 设置下载头
        res.download(filePath, document.file_name);
    } catch (error) {
        console.error('下载文档失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 预览文档 (Inline)
 * GET /api/documents/:id/preview
 */
router.get('/:id/preview', authenticate, authorize(PERMISSIONS.DOCUMENT_READ), async (req, res) => {
    try {
        const { id } = req.params;
        const document = await documentModel.getDocumentById(id);

        if (!document) {
            return res.status(404).send('文档不存在');
        }

        const filePath = path.join(appConfig.upload.dataPath, document.file_path);

        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).send('文件不存在');
        }

        // 显式设置 Content-Type，防止部分浏览器无法正确识别
        if (document.mime_type) {
            res.setHeader('Content-Type', document.mime_type);
        } else if (document.file_type === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
        }

        // 设置 Content-Disposition 为 inline 以支持浏览器预览
        // 使用 encodeURIComponent 处理中文文件名
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.file_name)}"`);

        // 发送文件
        res.sendFile(filePath);
    } catch (error) {
        console.error('预览文档失败:', error);
        res.status(500).send(error.message);
    }
});

/**
 * 获取视图关联的文档
 * GET /api/documents/view/:viewId
 */
router.get('/view/:viewId', authenticate, authorize(PERMISSIONS.DOCUMENT_READ), async (req, res) => {
    try {
        const { viewId } = req.params;
        // 直接使用 documentModel.getDocuments 传入 viewId
        const documents = await documentModel.getDocuments({ viewId: parseInt(viewId) });
        res.json({ success: true, data: documents });
    } catch (error) {
        console.error('获取视图关联文档失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
