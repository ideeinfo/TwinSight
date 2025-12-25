/**
 * 创建知识库相关表的迁移脚本
 * 用于存储 Open WebUI 知识库与系统文件的映射关系
 */

import pg from 'pg';
import config from '../config/index.js';

const { Pool } = pg;
const pool = new Pool(config.database);

async function createKnowledgeBaseTables() {
    console.log('🚀 开始创建知识库相关表...');

    try {
        // 创建 knowledge_bases 表
        await pool.query(`
            CREATE TABLE IF NOT EXISTS knowledge_bases (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                file_id INTEGER NOT NULL REFERENCES model_files(id) ON DELETE CASCADE,
                openwebui_kb_id VARCHAR(255) NOT NULL,
                kb_name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(file_id)
            )
        `);
        console.log('✅ knowledge_bases 表创建成功');

        // 创建 kb_documents 表
        await pool.query(`
            CREATE TABLE IF NOT EXISTS kb_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
                document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                openwebui_doc_id VARCHAR(255),
                sync_status VARCHAR(20) DEFAULT 'pending',
                sync_error TEXT,
                synced_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ kb_documents 表创建成功');

        // 创建索引
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_knowledge_bases_file_id ON knowledge_bases(file_id);
            CREATE INDEX IF NOT EXISTS idx_kb_documents_kb_id ON kb_documents(kb_id);
            CREATE INDEX IF NOT EXISTS idx_kb_documents_document_id ON kb_documents(document_id);
            CREATE INDEX IF NOT EXISTS idx_kb_documents_sync_status ON kb_documents(sync_status);
        `);
        console.log('✅ 索引创建成功');

        // 创建更新触发器
        await pool.query(`
            DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON knowledge_bases;
            CREATE TRIGGER update_knowledge_bases_updated_at
                BEFORE UPDATE ON knowledge_bases
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `);
        console.log('✅ 更新触发器创建成功');

        // 添加注释
        await pool.query(`
            COMMENT ON TABLE knowledge_bases IS '知识库映射表：存储模型文件与 Open WebUI 知识库的对应关系';
            COMMENT ON TABLE kb_documents IS '知识库文档表：存储文档与知识库的同步状态';
            COMMENT ON COLUMN knowledge_bases.openwebui_kb_id IS 'Open WebUI 中的知识库 ID';
            COMMENT ON COLUMN kb_documents.sync_status IS '同步状态：pending=待同步, synced=已同步, failed=同步失败';
        `);
        console.log('✅ 表注释添加成功');

        console.log('🎉 知识库相关表创建完成！');
    } catch (error) {
        console.error('❌ 创建表失败:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// 执行迁移
createKnowledgeBaseTables();
