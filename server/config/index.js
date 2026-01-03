/**
 * 应用配置
 * 统一管理所有配置项
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量 - 从项目根目录的 .env 文件
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
    // 服务器配置
    server: {
        port: parseInt(process.env.PORT || '3001', 10),
        host: process.env.HOST || '0.0.0.0',
        env: process.env.NODE_ENV || 'development',
    },

    // 数据库配置 - 使用 getter 确保运行时动态读取环境变量
    // 这解决了 ES Modules 静态导入时环境变量可能尚未加载的问题
    get database() {
        // 优先使用 DATABASE_URL（Railway 推荐的方式）
        if (process.env.DATABASE_URL) {
            return {
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            };
        }
        // 回退到单独的环境变量
        return {
            host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
            database: process.env.PGDATABASE || process.env.DB_NAME || 'tandem',
            user: process.env.PGUSER || process.env.DB_USER || 'postgres',
            password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
        };
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
    // DATA_PATH 环境变量用于区分本地开发(./public)和生产环境(/app/uploads)
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000', 10), // 默认 500MB
        dataPath: process.env.DATA_PATH || path.join(__dirname, '../../public'),
        get uploadDir() { return path.join(this.dataPath, 'files'); },
        get modelsDir() { return path.join(this.dataPath, 'models'); },
        get docsDir() { return path.join(this.dataPath, 'docs'); },
        get dataDir() { return path.join(this.dataPath, 'data'); },
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
