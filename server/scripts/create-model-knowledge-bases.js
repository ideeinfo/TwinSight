/**
 * 为现有模型文件创建 Open WebUI 知识库
 * 运行: node scripts/create-model-knowledge-bases.js
 */

import pg from 'pg';
import config from '../config/index.js';
import openwebuiService from '../services/openwebui-service.js';

const { Pool } = pg;
const pool = new Pool(config.database);

async function main() {
    console.log('🚀 开始为模型文件创建知识库...\n');

    try {
        // 1. 检查 Open WebUI 连接
        const isHealthy = await openwebuiService.checkHealth();
        if (!isHealthy) {
            console.error('❌ Open WebUI 服务不可用，请先启动服务');
            process.exit(1);
        }
        console.log('✅ Open WebUI 服务连接正常\n');

        // 2. 获取所有模型文件
        const modelsResult = await pool.query(`
            SELECT m.id, m.title, m.original_name,
                   kb.id as kb_id, kb.openwebui_kb_id
            FROM model_files m
            LEFT JOIN knowledge_bases kb ON m.id = kb.file_id
            ORDER BY m.id
        `);

        if (modelsResult.rows.length === 0) {
            console.log('⚠️ 没有找到模型文件');
            process.exit(0);
        }

        console.log(`📁 找到 ${modelsResult.rows.length} 个模型文件\n`);

        // 3. 为每个模型创建知识库
        for (const model of modelsResult.rows) {
            console.log(`📦 处理模型: ${model.title} (ID: ${model.id})`);

            // 检查是否已有知识库
            if (model.openwebui_kb_id) {
                console.log(`   └─ ✅ 已存在知识库: ${model.openwebui_kb_id}`);
                continue;
            }

            try {
                // 创建知识库名称
                const kbName = `Tandem-${model.title}`;
                const kbDescription = `知识库关联模型文件: ${model.title} (${model.original_name})`;

                // 在 Open WebUI 中创建知识库
                const kb = await openwebuiService.createKnowledgeBase(kbName, kbDescription);
                console.log(`   └─ 📚 已创建 Open WebUI 知识库: ${kb.id}`);

                // 保存映射关系到数据库
                await pool.query(`
                    INSERT INTO knowledge_bases (file_id, openwebui_kb_id, kb_name)
                    VALUES ($1, $2, $3)
                `, [model.id, kb.id, kbName]);
                console.log(`   └─ 💾 映射关系已保存到数据库`);

            } catch (error) {
                console.error(`   └─ ❌ 创建失败: ${error.message}`);
            }
        }

        console.log('\n🎉 知识库创建完成！');

        // 4. 显示最终状态
        const finalResult = await pool.query(`
            SELECT m.id, m.title, kb.openwebui_kb_id, kb.kb_name
            FROM model_files m
            LEFT JOIN knowledge_bases kb ON m.id = kb.file_id
            ORDER BY m.id
        `);

        console.log('\n📊 知识库映射状态:');
        console.log('─'.repeat(60));
        for (const row of finalResult.rows) {
            const status = row.openwebui_kb_id ? '✅' : '❌';
            console.log(`${status} ${row.title} => ${row.openwebui_kb_id || '未创建'}`);
        }

    } catch (error) {
        console.error('❌ 执行失败:', error);
    } finally {
        await pool.end();
    }
}

main();
