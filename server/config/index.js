/**
 * 应用配置
 * 统一管理所有配置项
 */
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const config = {
    // 服务器配置
    server: {
        port: parseInt(process.env.PORT || '3001', 10),
        host: process.env.HOST || '0.0.0.0',
        env: process.env.NODE_ENV || 'development',
    },

    // 数据库配置
    database: {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE || 'tandem',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
    },

    // InfluxDB 配置
    influx: {
        url: process.env.INFLUX_URL || 'http://localhost:8086',
        org: process.env.INFLUX_ORG || 'tandem',
        bucket: process.env.INFLUX_BUCKET || 'sensor_data',
        token: process.env.INFLUX_TOKEN || '',
    },

    // JWT 配置（预留）
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    // 文件上传配置
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000', 10), // 默认 500MB
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        modelsDir: process.env.MODELS_DIR || './public/models',
        documentsDir: process.env.DOCUMENTS_DIR || './public/documents',
    },

    // 跨域配置
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
    },

    // API 配置
    api: {
        prefix: '/api',
        version: 'v1',
    },

    // AI 服务配置
    ai: {
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678',
    },
};

export default config;

// 便捷导出
export const { server, database, influx, jwt, upload, cors, api, ai } = config;
