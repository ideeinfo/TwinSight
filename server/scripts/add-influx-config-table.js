/**
 * 数据库迁移脚本：为模型添加 InfluxDB 配置表
 */
import { query, getClient } from '../db/index.js';

async function addInfluxConfigTable() {
    const client = await getClient();

    try {
        console.log('🚀 开始创建 InfluxDB 配置表...\n');

        await client.query('BEGIN');

        // 检查表是否已存在
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'influx_configs'
            )
        `);

        if (tableExists.rows[0].exists) {
            console.log('⏭️ influx_configs 表已存在，跳过创建');
        } else {
            // 创建 InfluxDB 配置表
            await client.query(`
                CREATE TABLE influx_configs (
                    id SERIAL PRIMARY KEY,
                    file_id INTEGER UNIQUE REFERENCES model_files(id) ON DELETE CASCADE,
                    influx_url VARCHAR(500) NOT NULL,           -- InfluxDB 地址
                    influx_port INTEGER DEFAULT 8086,           -- 端口
                    influx_org VARCHAR(200) NOT NULL,           -- 组织
                    influx_bucket VARCHAR(200) NOT NULL,        -- 容器/存储桶
                    influx_token TEXT,                          -- API Token
                    influx_user VARCHAR(200),                   -- 用户名（Basic认证）
                    influx_password TEXT,                       -- 密码（Basic认证）
                    use_basic_auth BOOLEAN DEFAULT false,       -- 是否使用 Basic 认证
                    is_enabled BOOLEAN DEFAULT true,            -- 是否启用
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ 已创建 influx_configs 表');

            // 创建索引
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_influx_configs_file_id ON influx_configs(file_id)
            `);
            console.log('✅ 已创建索引');

            // 创建更新触发器
            await client.query(`
                DROP TRIGGER IF EXISTS update_influx_configs_updated_at ON influx_configs;
                CREATE TRIGGER update_influx_configs_updated_at
                    BEFORE UPDATE ON influx_configs
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
            `);
            console.log('✅ 已创建更新触发器');

            // 添加注释
            await client.query(`
                COMMENT ON TABLE influx_configs IS 'InfluxDB 配置表：存储每个模型的时序数据库连接配置';
                COMMENT ON COLUMN influx_configs.file_id IS '关联的模型文件ID，一对一关系';
                COMMENT ON COLUMN influx_configs.influx_url IS 'InfluxDB 服务器地址';
                COMMENT ON COLUMN influx_configs.influx_port IS '端口号，默认8086';
                COMMENT ON COLUMN influx_configs.influx_org IS 'InfluxDB 组织名称';
                COMMENT ON COLUMN influx_configs.influx_bucket IS 'InfluxDB 存储桶名称';
                COMMENT ON COLUMN influx_configs.influx_token IS 'API Token 用于认证';
                COMMENT ON COLUMN influx_configs.influx_user IS 'Basic 认证用户名';
                COMMENT ON COLUMN influx_configs.influx_password IS 'Basic 认证密码';
                COMMENT ON COLUMN influx_configs.use_basic_auth IS '是否使用 Basic 认证而非 Token';
            `);
            console.log('✅ 已添加表注释');
        }

        await client.query('COMMIT');
        console.log('\n🎉 迁移完成！');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 迁移失败:', error.message);
        throw error;
    } finally {
        client.release();
    }

    process.exit(0);
}

addInfluxConfigTable().catch(err => {
    console.error('脚本执行失败:', err);
    process.exit(1);
});
