/**
 * 文档智能关联匹配服务
 * 根据文件名自动匹配资产、空间、资产规格
 * 采用严格匹配策略，减少误判
 */

import { query } from '../db/index.js';

// 编码匹配正则 - 平衡模式
const CODE_PATTERNS = {
    // 资产编码：2-6个大写字母 + 可选分隔符 + 1-4位数字 + 可选后缀
    // 支持: CP01, AHU-01, FCU001, CP0101, GK1-1
    asset: /\b([A-Z]{2,6}[-_]?[0-9]{1,4}(?:[-_]?[0-9A-Z]{1,2})?)\b/gi,
    // 空间编码：楼层标识 + 区域/房间号
    // 支持: BF02US02, B1-01-001, 1F-A-001
    space: /\b([BF]\d{1,2}[-_]?[A-Z]{0,2}\d{0,2}[-_]?[A-Z]{0,2}\d{2,4})\b/gi,
};

// 停用词（不参与匹配）- 扩展列表
const STOP_WORDS = new Set([
    '的', '了', '和', '与', '及', '或', '在', '是', '有', '为', '图', '版',
    'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'with', 'by', 'at',
    '照片', '图片', '文档', '文件', '资料', '记录', '报告', '图纸', '副本', '备份',
    'photo', 'image', 'file', 'doc', 'pdf', 'jpg', 'png', 'copy', 'backup',
    'img', 'pic', 'screenshot', '截图', '扫描', 'scan', '新建', 'new', 'old', '旧',
    '修改', '更新', 'update', 'edit', 'final', '最终', '草稿', 'draft'
]);

/**
 * 计算 Levenshtein 编辑距离
 */
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}

/**
 * 计算字符串相似度 (0-1)
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    if (s1 === s2) return 1;
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;
    const distance = levenshteinDistance(s1, s2);
    return 1 - distance / maxLen;
}

/**
 * 预处理文件名，提取关键词
 */
function preprocessFileName(fileName) {
    // 移除扩展名
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

    // 按分隔符拆分 (-, _, 空格, 中文字符边界)
    const tokens = nameWithoutExt
        .split(/[-_\s]+/)
        .flatMap(part => {
            // 进一步按中英文边界拆分
            return part.split(/(?<=[a-zA-Z])(?=[\u4e00-\u9fa5])|(?<=[\u4e00-\u9fa5])(?=[a-zA-Z])/);
        })
        .map(t => t.trim())
        .filter(t => t.length > 0);

    // 过滤停用词
    const keywords = tokens.filter(t => !STOP_WORDS.has(t.toLowerCase()));

    return {
        original: fileName,
        nameWithoutExt,
        tokens,
        keywords
    };
}

/**
 * 从文件名提取可能的编码
 */
function extractCodes(fileName) {
    const codes = [];

    for (const [type, pattern] of Object.entries(CODE_PATTERNS)) {
        const matches = fileName.matchAll(new RegExp(pattern));
        for (const match of matches) {
            codes.push({
                type,
                code: match[1].toUpperCase(),
                position: match.index,
                length: match[1].length
            });
        }
    }

    return codes;
}

/**
 * 精确匹配编码 - 用所有提取的编码查询数据库
 */
async function matchByCode(codes) {
    const matches = [];
    if (codes.length === 0) return matches;

    // 提取所有编码（大写）
    const allCodes = [...new Set(codes.map(c => c.code.toUpperCase()))];

    // 批量查询资产
    const assetResult = await query(`
        SELECT asset_code as code, name, floor, room, spec_code, 'asset' as type
        FROM assets 
        WHERE UPPER(asset_code) = ANY($1::text[])
    `, [allCodes]);

    for (const row of assetResult.rows) {
        matches.push({
            type: 'asset',
            code: row.code,
            name: row.name,
            confidence: 95,
            matchType: 'code_exact',
            metadata: { floor: row.floor, room: row.room, specCode: row.spec_code }
        });
    }

    // 批量查询空间
    const spaceResult = await query(`
        SELECT space_code as code, name, floor, classification_code, 'space' as type
        FROM spaces 
        WHERE UPPER(space_code) = ANY($1::text[])
    `, [allCodes]);

    for (const row of spaceResult.rows) {
        matches.push({
            type: 'space',
            code: row.code,
            name: row.name,
            confidence: 95,
            matchType: 'code_exact',
            metadata: { floor: row.floor, classificationCode: row.classification_code }
        });
    }

    // 批量查询规格
    const specResult = await query(`
        SELECT spec_code as code, spec_name as name, category, family, 'spec' as type
        FROM asset_specs 
        WHERE UPPER(spec_code) = ANY($1::text[])
    `, [allCodes]);

    for (const row of specResult.rows) {
        matches.push({
            type: 'spec',
            code: row.code,
            name: row.name,
            confidence: 90,
            matchType: 'code_exact',
            metadata: { category: row.category, family: row.family }
        });
    }

    return matches;
}

/**
 * 名称模糊匹配 - 已禁用，仅保留精确编码匹配以减少误判
 * 如需启用，可修改 matchFileName 中的调用
 */
async function matchByName(keywords) {
    // 禁用模糊匹配以减少误判
    return [];
}

/**
 * 合并和去重匹配结果
 */
function mergeMatches(matches, maxResults = 10) {
    // 按 type + code 去重，保留最高置信度
    const uniqueMap = new Map();

    for (const match of matches) {
        const key = `${match.type}:${match.code}`;
        const existing = uniqueMap.get(key);

        if (!existing || match.confidence > existing.confidence) {
            uniqueMap.set(key, match);
        }
    }

    // 排序并截断
    return Array.from(uniqueMap.values())
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults);
}

/**
 * 匹配单个文件名 - 精确编码匹配模式
 */
async function matchFileName(fileName, options = {}) {
    const { minConfidence = 80, maxResults = 5 } = options;

    const processed = preprocessFileName(fileName);
    const extractedCodes = extractCodes(processed.nameWithoutExt);

    // 执行精确编码匹配
    const codeMatches = await matchByCode(extractedCodes);

    // 合并结果
    const merged = mergeMatches(codeMatches, maxResults);

    // 过滤低置信度
    return merged.filter(m => m.confidence >= minConfidence);
}

/**
 * 批量匹配多个文件名
 */
export async function matchFileNames(fileNames, options = {}) {
    const results = [];

    for (const fileName of fileNames) {
        try {
            const matches = await matchFileName(fileName, options);
            results.push({
                fileName,
                matches
            });
        } catch (error) {
            console.error(`[DocumentMatching] Error matching ${fileName}:`, error);
            results.push({
                fileName,
                matches: [],
                error: error.message
            });
        }
    }

    return results;
}

/**
 * 搜索对象（用于手动添加关联）
 */
export async function searchObjects(keyword, types = ['asset', 'space', 'spec'], limit = 20) {
    const results = [];
    const searchPattern = `%${keyword}%`;

    if (types.includes('space')) {
        const spaceResult = await query(`
            SELECT space_code as code, name, floor, 'space' as type
            FROM spaces 
            WHERE space_code ILIKE $1 OR name ILIKE $1
            LIMIT $2
        `, [searchPattern, limit]);
        results.push(...spaceResult.rows);
    }

    if (types.includes('asset')) {
        const assetResult = await query(`
            SELECT asset_code as code, name, floor, 'asset' as type
            FROM assets 
            WHERE asset_code ILIKE $1 OR name ILIKE $1
            LIMIT $2
        `, [searchPattern, limit]);
        results.push(...assetResult.rows);
    }

    if (types.includes('spec')) {
        const specResult = await query(`
            SELECT spec_code as code, spec_name as name, category, 'spec' as type
            FROM asset_specs 
            WHERE spec_code ILIKE $1 OR spec_name ILIKE $1
            LIMIT $2
        `, [searchPattern, limit]);
        results.push(...specResult.rows);
    }

    return results.slice(0, limit);
}

export default {
    matchFileNames,
    searchObjects
};
