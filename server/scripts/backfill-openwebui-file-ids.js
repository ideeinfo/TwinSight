/**
 * 回填已同步文档的 Open WebUI 文件 ID
 * 
 * 逻辑：
 * 1. 从 Open WebUI 获取所有上传的文件列表（包含 id 和 filename）
 * 2. 从本地 documents 表获取所有文档（通过文件名匹配）
 * 3. 根据文件名匹配，更新 kb_documents 表的 openwebui_file_id 字段
 */

import pool from '../db/index.js';
import openwebuiConfig from '../config/openwebui-config.js';

const { baseUrl, apiKey } = openwebuiConfig;

/**
 * 从 Open WebUI 获取所有文件列表
 */
async function getOpenWebUIFiles() {
    console.log('📥 从 Open WebUI 获取文件列表...');

    const response = await fetch(`${baseUrl}/api/v1/files/`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        throw new Error(`获取文件列表失败: HTTP ${response.status}`);
    }

    const files = await response.json();
    console.log(`✅ 获取到 ${files.length} 个文件\n`);
    return files;
}

/**
 * 主函数：回填 Open WebUI 文件 ID
 */
async function backfillOpenWebUIFileIds() {
    console.log('🔄 开始回填 Open WebUI 文件 ID...\n');
    console.log(`📡 Open WebUI 地址: ${baseUrl}\n`);

    try {
        // 1. 获取 Open WebUI 中的所有文件
        const openwebuiFiles = await getOpenWebUIFiles();

        // 创建文件名到 ID 的映射（使用原始文件名）
        const fileNameToId = new Map();
        for (const file of openwebuiFiles) {
            // Open WebUI 文件对象可能有 filename 或 meta.name 字段
            const fileName = file.filename || file.meta?.name || file.name;
            if (fileName && file.id) {
                fileNameToId.set(fileName, file.id);
                // 也尝试不带扩展名的匹配
                const baseName = fileName.replace(/\.[^/.]+$/, '');
                if (!fileNameToId.has(baseName)) {
                    fileNameToId.set(baseName, file.id);
                }
            }
        }

        console.log(`📋 已建立 ${fileNameToId.size} 个文件名映射\n`);

        // 2. 查询需要回填的 kb_documents 记录
        const kbDocsResult = await pool.query(`
            SELECT kbd.id, kbd.document_id, kbd.openwebui_file_id, d.file_name
            FROM kb_documents kbd
            JOIN documents d ON kbd.document_id = d.id
            WHERE kbd.sync_status = 'synced'
              AND (kbd.openwebui_file_id IS NULL OR kbd.openwebui_file_id = '')
        `);

        const kbDocs = kbDocsResult.rows;
        console.log(`📋 找到 ${kbDocs.length} 个需要回填的记录\n`);

        if (kbDocs.length === 0) {
            console.log('✅ 没有需要回填的记录');
            return;
        }

        // 3. 逐个匹配并更新
        let successCount = 0;
        let notFoundCount = 0;

        for (const doc of kbDocs) {
            const fileName = doc.file_name;

            // 尝试多种匹配方式
            let openwebuiFileId = fileNameToId.get(fileName);

            // 如果没找到，尝试去掉路径只用文件名
            if (!openwebuiFileId) {
                const baseName = fileName.split('/').pop().split('\\').pop();
                openwebuiFileId = fileNameToId.get(baseName);
            }

            // 如果还没找到，尝试不区分大小写匹配
            if (!openwebuiFileId) {
                for (const [key, value] of fileNameToId) {
                    if (key.toLowerCase() === fileName.toLowerCase()) {
                        openwebuiFileId = value;
                        break;
                    }
                }
            }

            if (openwebuiFileId) {
                await pool.query(
                    'UPDATE kb_documents SET openwebui_file_id = $1 WHERE id = $2',
                    [openwebuiFileId, doc.id]
                );
                console.log(`✅ 已更新: ${fileName} -> ${openwebuiFileId}`);
                successCount++;
            } else {
                console.log(`⚠️ 未找到匹配: ${fileName}`);
                notFoundCount++;
            }
        }

        console.log(`\n📊 回填完成: 成功 ${successCount}, 未匹配 ${notFoundCount}`);

    } catch (error) {
        console.error('❌ 回填过程出错:', error.message);
        throw error;
    }
}

// 执行回填
backfillOpenWebUIFileIds()
    .then(() => {
        console.log('\n✅ 脚本执行完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ 脚本执行失败:', error);
        process.exit(1);
    });
