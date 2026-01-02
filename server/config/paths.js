/**
 * 数据存储路径配置
 * 根据环境变量自动切换本地开发和生产环境路径
 * 
 * 本地开发：DATA_PATH=./public (默认)
 * 生产环境：DATA_PATH=/app/uploads (Railway Volume)
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据根路径（可通过环境变量配置）
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../public');

// 导出各类数据的路径
export const paths = {
    // 根路径
    root: DATA_PATH,

    // 3D 模型文件
    models: path.join(DATA_PATH, 'models'),

    // 上传的文件（压缩包等）
    files: path.join(DATA_PATH, 'files'),

    // 文档文件
    docs: path.join(DATA_PATH, 'docs'),

    // 其他数据
    data: path.join(DATA_PATH, 'data'),
};

// 获取相对于 DATA_PATH 的路径
export function getRelativePath(absolutePath) {
    return path.relative(DATA_PATH, absolutePath);
}

// 获取绝对路径
export function getAbsolutePath(relativePath) {
    return path.join(DATA_PATH, relativePath);
}

export default paths;
