/**
 * 为现有模型文件创建 Open WebUI 知识库 (简化版)
 * 运行: node scripts/create-model-knowledge-bases-simple.js
 */

import pg from 'pg';
import config from '../config/index.js';

const { Pool } = pg;
const pool = new Pool(config.database);

const OPENWEBUI_URL = 'http://localhost:3080';
const API_KEY = process.env.OPENWEBUI_API_KEY || 'sk-3988363558a645ca8f7a5dfe0ca137e0';

async function createKnowledgeBase(name, description) {
    const response = await fetch(`${OPENWEBUI_URL}/api/v1/knowledge/create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return await response.json();
}

async function main() {
    console.log('🚀 开始为模型文件创建知识库...\n');

    try {
        // 获取所有模型文件
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

        // 为每个模型创建知识库
        for (const model of modelsResult.rows) {
            console.log(`📦 处理模型: ${model.title} (ID: ${model.id})`);

            // 检查是否已有知识库
            if (model.openwebui_kb_id) {
                console.log(`   └─ ✅ 已存在知识库: ${model.openwebui_kb_id}`);
                continue;
            }

            try {
                const kbName = `Tandem-${model.title}`;
                const kbDescription = `知识库关联模型文件: ${model.title} (${model.original_name})`;

                const kb = await createKnowledgeBase(kbName, kbDescription);
                console.log(`   └─ 📚 已创建 Open WebUI 知识库: ${kb.id}`);

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

        // 显示最终状态
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
