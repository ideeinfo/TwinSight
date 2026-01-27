/**
 * 文档智能服务 - Phase 2: 智能增强
 * 功能:
 *   1. 缩略图生成
 *   2. 业务类型自动识别 (全景图检测等)
 *   3. 自动关联识别 (基于文件名规则)
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { query } from '../db/index.js';
import appConfig from '../config/index.js';

// 缩略图配置
const THUMBNAIL_CONFIG = {
    width: 300,
    height: 200,
    fit: 'cover',
    format: 'webp',
    quality: 80
};

// 支持的图像格式
const SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'bmp'];

// 全景图检测阈值 (宽高比)
// 严格按照 2:1 等距柱状投影判定，允许 ±2.5% 误差
const EQUIRECTANGULAR_RATIO = 2.0;
const EQUIRECTANGULAR_TOLERANCE = 0.05; // 允许 1.95 - 2.05

/**
 * 辅助函数：解析绝对路径
 */
function resolveAbsolutePath(filePath) {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    // 如果是相对路径，默认相对于 dataPath (public 目录)
    return path.join(appConfig.upload.dataPath, filePath);
}

/**
 * 生成缩略图
 * @param {string} filePath - 源文件路径
 * @param {number} documentId - 文档ID
 * @returns {Promise<string|null>} 缩略图相对路径
 */
async function generateThumbnail(filePath, documentId) {
    const ext = path.extname(filePath).slice(1).toLowerCase();

    if (!SUPPORTED_IMAGE_FORMATS.includes(ext)) {
        return null;
    }

    // 构建绝对路径
    const absolutePath = resolveAbsolutePath(filePath);

    if (!fs.existsSync(absolutePath)) {
        console.error(`[Thumbnail] Source file not found: ${absolutePath}`);
        return null;
    }

    try {
        // 创建缩略图目录
        const thumbnailDir = path.join(appConfig.upload.dataDir, 'thumbnails');
        if (!fs.existsSync(thumbnailDir)) {
            fs.mkdirSync(thumbnailDir, { recursive: true });
        }

        const thumbnailFileName = `thumb_${documentId}.webp`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailFileName);

        await sharp(absolutePath)
            .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
                fit: THUMBNAIL_CONFIG.fit,
                position: 'center'
            })
            .webp({ quality: THUMBNAIL_CONFIG.quality })
            .toFile(thumbnailPath);

        // 返回相对路径
        const relativePath = `/data/thumbnails/${thumbnailFileName}`;

        // 更新数据库
        await query(
            'UPDATE documents SET thumbnail_path = $1 WHERE id = $2',
            [relativePath, documentId]
        );

        console.log(`[Thumbnail] Generated: ${relativePath}`);
        return relativePath;
    } catch (error) {
        console.error(`[Thumbnail] Error generating thumbnail for ${filePath}:`, error);
        return null;
    }
}

/**
 * 检测图像类型 (全景图、普通照片等)
 * @param {string} filePath - 源文件路径
 * @returns {Promise<{type: string, metadata: object}|null>}
 */
async function detectImageType(filePath) {
    const ext = path.extname(filePath).slice(1).toLowerCase();

    if (!SUPPORTED_IMAGE_FORMATS.includes(ext)) {
        return null;
    }

    const absolutePath = resolveAbsolutePath(filePath);

    if (!fs.existsSync(absolutePath)) {
        return null;
    }

    try {
        const metadata = await sharp(absolutePath).metadata();
        const { width, height } = metadata;

        if (!width || !height) {
            return null;
        }

        const aspectRatio = width / height;
        let detectedType = 'photo';

        // 全景图检测逻辑 - 严格按照 2:1 等距柱状投影判定
        if (aspectRatio >= EQUIRECTANGULAR_RATIO - EQUIRECTANGULAR_TOLERANCE &&
            aspectRatio <= EQUIRECTANGULAR_RATIO + EQUIRECTANGULAR_TOLERANCE) {
            // 严格 2:1 等距柱状投影全景图 (1.95 - 2.05)
            detectedType = 'panorama_equirectangular';
        }
        // 移除了宽松的全景图判定条件，避免误判

        return {
            type: detectedType,
            metadata: {
                width,
                height,
                aspectRatio: Math.round(aspectRatio * 100) / 100,
                format: metadata.format,
                space: metadata.space,
                hasAlpha: metadata.hasAlpha
            }
        };
    } catch (error) {
        console.error(`[ImageType] Error detecting image type for ${filePath}:`, error);
        return null;
    }
}

/**
 * 根据文件名自动识别业务类型
 * @param {string} fileName - 文件名
 * @returns {string|null}
 */
function detectBusinessTypeByFileName(fileName) {
    const name = fileName.toLowerCase();

    // 全景图关键词
    if (/pano|panorama|360|vr|全景/.test(name)) {
        return 'panorama';
    }

    // CAD图纸
    if (/dwg|dxf|cad|图纸/.test(name)) {
        return 'cad';
    }

    // BIM模型
    if (/rvt|ifc|nwd|nwc|bim|模型/.test(name)) {
        return 'bim';
    }

    // 设备手册
    if (/manual|handbook|说明书|手册|操作指南/.test(name)) {
        return 'manual';
    }

    // 维护记录
    if (/maintenance|repair|维护|保养|检修|维修/.test(name)) {
        return 'maintenance';
    }

    // 合同文档
    if (/contract|agreement|合同|协议/.test(name)) {
        return 'contract';
    }

    // 竣工图
    if (/as-built|竣工|completion/.test(name)) {
        return 'as-built';
    }

    return null;
}

/**
 * 从文件名中提取可能的关联编码
 * @param {string} fileName - 文件名
 * @returns {Array<{type: string, code: string}>}
 */
function extractAssociationCodes(fileName) {
    const associations = [];
    const name = fileName.replace(/\.[^.]+$/, ''); // 移除扩展名

    // 资产编码模式 (如: AHU-01, PUMP-001, CT-1)
    const assetPatterns = [
        /\b([A-Z]{2,6}[-_]?\d{1,4})\b/g,  // AHU-01, PUMP001
        /\b(设备[-_]?\d{4,})\b/g,          // 设备-0001
    ];

    for (const pattern of assetPatterns) {
        let match;
        while ((match = pattern.exec(name)) !== null) {
            associations.push({
                type: 'asset',
                code: match[1].toUpperCase()
            });
        }
    }

    // 空间编码模式 (如: B1-01-001, 1F-A区)
    const spacePatterns = [
        /\b([B]?\d+[-_]?\d{2}[-_]?\d{3})\b/gi,  // B1-01-001
        /\b(\d+[F楼层][-_]?[A-Z区]?\d*)\b/gi,   // 1F-A区
    ];

    for (const pattern of spacePatterns) {
        let match;
        while ((match = pattern.exec(name)) !== null) {
            associations.push({
                type: 'space',
                code: match[1].toUpperCase()
            });
        }
    }

    // 去重
    const seen = new Set();
    return associations.filter(a => {
        const key = `${a.type}:${a.code}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// 自动标签映射配置
const AUTO_TAG_MAPPING = {
    // 业务类型 -> 标签名称
    panorama: '全景',
    photo: '照片',
    cad: '图纸',
    bim: 'BIM',
    manual: '运维手册',
    contract: '合同'
};

// 标签默认颜色 (低饱和度)
const AUTO_TAG_COLORS = {
    '全景': '#6B8E9F',
    '照片': '#7A9F6B',
    '图纸': '#8B6B9F',
    'BIM': '#9F6B8E',
    '运维手册': '#6B9F9A',
    '合同': '#9F8B6B'
};

// 同义词/近义词映射 (用于模糊匹配)
const TAG_SYNONYMS = {
    '全景': ['全景图', '全景照片', '360', '360度', 'panorama', 'pano', 'vr'],
    '照片': ['图片', '相片', '照', 'photo', 'picture', 'image', '原片'],
    '图纸': ['图', '平面图', '设计图', 'cad', 'dwg', 'drawing'],
    '合同': ['协议', '契约', 'contract', 'agreement'],
    '运维手册': ['手册', '说明书', '操作手册', '使用手册', 'manual', 'handbook'],
    'BIM': ['模型', 'bim模型', 'revit', 'ifc']
};

/**
 * 计算字符串相似度 (简单的包含匹配)
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} 0-1 之间的相似度
 */
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // 完全相等
    if (s1 === s2) return 1.0;

    // 包含关系
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // 检查同义词
    for (const [key, synonyms] of Object.entries(TAG_SYNONYMS)) {
        const allTerms = [key.toLowerCase(), ...synonyms.map(s => s.toLowerCase())];
        const s1Match = allTerms.some(t => s1.includes(t) || t.includes(s1));
        const s2Match = allTerms.some(t => s2.includes(t) || t.includes(s2));
        if (s1Match && s2Match) return 0.7;
    }

    return 0;
}

/**
 * 在现有标签中查找最匹配的标签
 * @param {string} targetName - 目标标签名
 * @param {Array} existingTags - 现有标签列表 [{id, name}]
 * @returns {{id: number, name: string, similarity: number}|null}
 */
function findBestMatchingTag(targetName, existingTags) {
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const tag of existingTags) {
        const similarity = calculateSimilarity(targetName, tag.name);
        if (similarity > bestSimilarity && similarity >= 0.7) {
            bestSimilarity = similarity;
            bestMatch = { ...tag, similarity };
        }
    }

    return bestMatch;
}

/**
 * 获取或创建标签 (支持模糊匹配)
 * @param {string} tagName - 标签名称
 * @returns {Promise<number|null>} 标签ID
 */
async function getOrCreateTag(tagName) {
    try {
        // 检查标签表是否存在
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'document_tags'
            ) as has_table
        `);

        if (!tableCheck.rows[0]?.has_table) {
            console.log(`[AutoTag] Tags table does not exist`);
            return null;
        }

        // 1. 精确匹配
        const exactMatch = await query(
            'SELECT id FROM document_tags WHERE name = $1',
            [tagName]
        );

        if (exactMatch.rows.length > 0) {
            console.log(`[AutoTag] Exact match found for "${tagName}": id=${exactMatch.rows[0].id}`);
            return exactMatch.rows[0].id;
        }

        // 2. 模糊匹配 - 获取所有现有标签
        const allTags = await query('SELECT id, name FROM document_tags');
        console.log(`[AutoTag] Looking for fuzzy match for "${tagName}" among ${allTags.rows.length} tags:`, allTags.rows.map(t => t.name));

        const bestMatch = findBestMatchingTag(tagName, allTags.rows);

        if (bestMatch) {
            console.log(`[AutoTag] Fuzzy matched "${tagName}" -> "${bestMatch.name}" (similarity: ${bestMatch.similarity})`);
            return bestMatch.id;
        }

        // 3. 没有匹配到，创建新标签
        console.log(`[AutoTag] No match found for "${tagName}", creating new tag`);
        const color = AUTO_TAG_COLORS[tagName] || '#6B8E9F';
        const result = await query(
            'INSERT INTO document_tags (name, color) VALUES ($1, $2) RETURNING id',
            [tagName, color]
        );

        console.log(`[AutoTag] Created new tag "${tagName}" with id ${result.rows[0].id}`);
        return result.rows[0].id;
        return result.rows[0].id;
    } catch (error) {
        console.error(`[AutoTag] Error getting/creating tag "${tagName}":`, error);
        return null;
    }
}

/**
 * 自动为文档打标签
 * @param {number} documentId - 文档ID
 * @param {object} analysisResult - 分析结果
 */
async function autoTagDocument(documentId, analysisResult) {
    try {
        // 检查标签关联表是否存在
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'document_tag_relations'
            ) as has_table
        `);

        if (!tableCheck.rows[0]?.has_table) {
            return;
        }

        const tagsToApply = [];

        // 基于业务类型确定要打的标签
        if (analysisResult.businessType) {
            const tagName = AUTO_TAG_MAPPING[analysisResult.businessType];
            if (tagName) {
                tagsToApply.push(tagName);
            }
        }

        // 如果是图片但没有检测到特定业务类型，打上"照片"标签
        if (analysisResult.detectedType && !analysisResult.businessType) {
            if (analysisResult.detectedType === 'photo') {
                tagsToApply.push('照片');
            }
        }

        // 应用标签
        for (const tagName of tagsToApply) {
            const tagId = await getOrCreateTag(tagName);
            if (tagId) {
                await query(`
                    INSERT INTO document_tag_relations (document_id, tag_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `, [documentId, tagId]);
                console.log(`[AutoTag] Tagged document ${documentId} with "${tagName}"`);
            }
        }
    } catch (error) {
        console.error(`[AutoTag] Error auto-tagging document ${documentId}:`, error);
    }
}

/**
 * 处理新上传的文档 - 自动分析
 * @param {number} documentId - 文档ID
 * @param {string} filePath - 文件路径
 * @param {string} fileName - 文件名
 * @returns {Promise<object>} 分析结果
 */
async function processNewDocument(documentId, filePath, fileName) {
    const result = {
        thumbnail: null,
        detectedType: null,
        businessType: null,
        suggestedAssociations: [],
        metadata: null
    };

    try {
        // 1. 生成缩略图
        result.thumbnail = await generateThumbnail(filePath, documentId);

        // 2. 检测图像类型
        const imageTypeResult = await detectImageType(filePath);
        if (imageTypeResult) {
            result.detectedType = imageTypeResult.type;
            result.metadata = imageTypeResult.metadata;

            // 如果检测到全景图，设置业务类型
            if (imageTypeResult.type.startsWith('panorama')) {
                result.businessType = 'panorama';
            }
        }

        // 3. 基于文件名检测业务类型 (如果图像类型未检测到)
        if (!result.businessType) {
            result.businessType = detectBusinessTypeByFileName(fileName);
        }

        // 4. 提取可能的关联编码
        result.suggestedAssociations = extractAssociationCodes(fileName);

        // 5. 更新数据库
        const updates = [];
        const values = [];
        let idx = 1;

        if (result.detectedType) {
            updates.push(`auto_detected_type = $${idx++}`);
            values.push(result.detectedType);
        }

        if (result.businessType) {
            updates.push(`business_type = COALESCE(business_type, $${idx++})`);
            values.push(result.businessType);
        }

        if (updates.length > 0) {
            values.push(documentId);
            await query(
                `UPDATE documents SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`,
                values
            );
        }

        // 6. 更新元数据
        if (result.metadata) {
            await query(`
                INSERT INTO document_metadata (document_id, common_attrs)
                VALUES ($1, $2)
                ON CONFLICT (document_id) DO UPDATE SET
                    common_attrs = document_metadata.common_attrs || $2,
                    updated_at = CURRENT_TIMESTAMP
            `, [documentId, JSON.stringify(result.metadata)]);
        }

        // 7. 自动打标签 (基于检测结果)
        await autoTagDocument(documentId, result);

        console.log(`[DocumentIntelligence] Processed document ${documentId}:`, {
            thumbnail: !!result.thumbnail,
            detectedType: result.detectedType,
            businessType: result.businessType,
            associations: result.suggestedAssociations.length
        });

    } catch (error) {
        console.error(`[DocumentIntelligence] Error processing document ${documentId}:`, error);
    }

    return result;
}

/**
 * 批量处理现有文档 (用于迁移)
 * @param {number} limit - 每批处理数量
 * @returns {Promise<{processed: number, errors: number}>}
 */
async function processExistingDocuments(limit = 100) {
    let processed = 0;
    let errors = 0;

    try {
        // 查找未处理的图像文档
        const result = await query(`
            SELECT id, file_path, file_name 
            FROM documents 
            WHERE thumbnail_path IS NULL 
              AND file_type IN ('jpg', 'jpeg', 'png', 'gif', 'webp')
            LIMIT $1
        `, [limit]);

        for (const doc of result.rows) {
            try {
                await processNewDocument(doc.id, doc.file_path, doc.file_name);
                processed++;
            } catch (e) {
                errors++;
                console.error(`[Batch] Error processing document ${doc.id}:`, e);
            }
        }
    } catch (error) {
        console.error('[Batch] Error:', error);
    }

    return { processed, errors };
}

export {
    generateThumbnail,
    detectImageType,
    detectBusinessTypeByFileName,
    extractAssociationCodes,
    processNewDocument,
    processExistingDocuments
};

export default {
    generateThumbnail,
    detectImageType,
    detectBusinessTypeByFileName,
    extractAssociationCodes,
    processNewDocument,
    processExistingDocuments
};
