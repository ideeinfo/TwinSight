/**
 * 文档同步后台服务
 * 自动将文档同步到 Open WebUI 知识库
 */

import { query as dbQuery } from '../db/index.js';
import openwebuiService from './openwebui-service.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 同步状态
let isSyncing = false;

/**
 * 获取未同步的文档列表（包含失败的，只有成功的才算完成）
 * @returns {Promise<Array>} 未同步的文档
 */
async function getUnsyncedDocuments() {
    const result = await dbQuery(`
        SELECT d.id, d.file_path, d.file_name, d.file_type, d.asset_code, d.space_code, d.spec_code
        FROM documents d
        LEFT JOIN kb_documents kbd ON d.id = kbd.document_id AND kbd.sync_status = 'synced'
        WHERE kbd.id IS NULL
          AND d.file_type IN ('pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'md', 'txt', 'csv', 'json')
        ORDER BY d.created_at ASC
        LIMIT 50
    `);
    return result.rows;
}

/**
 * 根据文档信息查找对应的知识库 ID
 * @param {Object} doc - 文档信息
 * @returns {Promise<string|null>} 知识库 ID
 */
async function findKnowledgeBaseId(doc) {
    let fileId = null;

    // 通过 assetCode 查找模型文件
    if (doc.asset_code) {
        const assetResult = await dbQuery(
            'SELECT file_id FROM assets WHERE asset_code = $1 LIMIT 1',
            [doc.asset_code]
        );
        if (assetResult.rows.length > 0) {
            fileId = assetResult.rows[0].file_id;
        }
    }

    // 通过 spaceCode 查找模型文件
    if (!fileId && doc.space_code) {
        const spaceResult = await dbQuery(
            'SELECT file_id FROM spaces WHERE space_code = $1 LIMIT 1',
            [doc.space_code]
        );
        if (spaceResult.rows.length > 0) {
            fileId = spaceResult.rows[0].file_id;
        }
    }

    // 如果没有找到关联的模型文件，尝试使用当前激活的模型
    if (!fileId) {
        const activeResult = await dbQuery(
            'SELECT id FROM model_files WHERE is_active = true LIMIT 1'
        );
        if (activeResult.rows.length > 0) {
            fileId = activeResult.rows[0].id;
        }
    }

    if (!fileId) {
        return null;
    }

    // 查找模型文件对应的知识库
    const kbResult = await dbQuery(
        'SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1',
        [fileId]
    );

    if (kbResult.rows.length === 0) {
        return null;
    }

    return kbResult.rows[0].openwebui_kb_id;
}

/**
 * 同步单个文档到知识库
 * @param {Object} doc - 文档信息
 * @param {string} kbId - 知识库 ID
 * @returns {Promise<boolean>} 是否成功
 */
async function syncDocument(doc, kbId) {
    try {
        const filePath = path.join(__dirname, '../../public', doc.file_path);

        // 检查文件格式是否支持
        if (!openwebuiService.isSupportedFormat(filePath)) {
            console.log(`⏭️ 跳过不支持的格式: ${doc.file_path}`);
            return false;
        }

        // 上传到 Open WebUI，使用原始文件名
        const originalFileName = doc.file_name || path.basename(doc.file_path);
        const uploadResult = await openwebuiService.uploadDocument(kbId, filePath, originalFileName);

        // 记录同步状态
        await dbQuery(
            `INSERT INTO kb_documents (kb_id, document_id, openwebui_doc_id, sync_status, synced_at)
             SELECT kb.id, $2, $3, 'synced', NOW()
             FROM knowledge_bases kb WHERE kb.openwebui_kb_id = $1
             ON CONFLICT (kb_id, document_id) DO UPDATE SET
             openwebui_doc_id = $3, sync_status = 'synced', synced_at = NOW()`,
            [kbId, doc.id, uploadResult.id || 'unknown']
        );

        return true;
    } catch (error) {
        console.error(`❌ 同步文档失败 [${doc.id}]:`, error.message);
        // 失败时不记录，让它下次可以重试
        return false;
    }
}

/**
 * 执行批量同步
 * @returns {Promise<{synced: number, failed: number, skipped: number}>}
 */
async function runBatchSync() {
    if (isSyncing) {
        console.log('⏳ 同步任务正在进行中，跳过本次执行');
        return { synced: 0, failed: 0, skipped: 0 };
    }

    isSyncing = true;
    const stats = { synced: 0, failed: 0, skipped: 0 };

    try {
        // 检查 Open WebUI 服务是否可用
        console.log('🔍 检查 Open WebUI 服务...');
        const isHealthy = await openwebuiService.checkHealth();
        if (!isHealthy) {
            console.log('⚠️ Open WebUI 服务不可用，跳过同步');
            return stats;
        }
        console.log('✅ Open WebUI 服务正常');

        console.log('🔍 查询未同步的文档...');
        const documents = await getUnsyncedDocuments();
        console.log(`📋 找到 ${documents.length} 个未同步的文档`);

        if (documents.length === 0) {
            console.log('✅ 没有需要同步的文档');
            return stats;
        }

        console.log(`\n📚 开始同步 ${documents.length} 个文档到知识库...`);

        for (const doc of documents) {
            const kbId = await findKnowledgeBaseId(doc);

            if (!kbId) {
                stats.skipped++;
                continue;
            }

            const success = await syncDocument(doc, kbId);
            if (success) {
                stats.synced++;
            } else {
                stats.failed++;
            }

            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (stats.synced > 0 || stats.failed > 0) {
            console.log(`📊 同步完成: 成功=${stats.synced}, 失败=${stats.failed}, 跳过=${stats.skipped}`);
        }

        return stats;
    } catch (error) {
        console.error('❌ 批量同步出错:', error.message);
        return stats;
    } finally {
        isSyncing = false;
    }
}

/**
 * 启动后台同步服务
 * @param {number} intervalMs - 同步间隔（毫秒），默认 5 分钟
 */
export function startSyncService(intervalMs = 5 * 60 * 1000) {
    console.log('🔄 文档同步服务已启动');

    // 延迟 30 秒后执行首次同步（等待数据库连接稳定）
    setTimeout(async () => {
        console.log('📋 执行首次文档同步检查...');
        await runBatchSync();
    }, 30000);

    // 定期执行同步
    setInterval(async () => {
        await runBatchSync();
    }, intervalMs);
}

/**
 * 手动触发同步
 */
export async function triggerSync() {
    return await runBatchSync();
}

export default {
    startSyncService,
    triggerSync,
    runBatchSync
};
