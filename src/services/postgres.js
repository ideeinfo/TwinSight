/**
 * PostgreSQL 数据库服务
 * 提供与后端 API 的通信功能
 * 
 * 注意：API 路径已迁移到 v1 版本
 */

// 后端 API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// API v1 基础路径
const API_V1_URL = `${API_BASE_URL}/api/v1`;

// 旧版 API 路径（逐步废弃，部分功能仍需使用）
const API_LEGACY_URL = `${API_BASE_URL}/api`;

/**
 * 检查 API 服务是否可用
 */
export async function checkApiHealth() {
    try {
        const response = await fetch(`${API_V1_URL}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * 获取所有分类编码
 * @param {string} type - 可选，'asset' 或 'space'
 * 注意：分类编码 API 尚未迁移到 v1，暂时使用旧版
 */
export async function getClassifications(type = null) {
    const url = type
        ? `${API_LEGACY_URL}/classifications?type=${type}`
        : `${API_LEGACY_URL}/classifications`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取分类编码失败');
    }

    return data.data;
}

/**
 * 获取所有资产规格
 */
export async function getAssetSpecs() {
    const response = await fetch(`${API_V1_URL}/assets/specs`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取资产规格失败');
    }

    return data.data;
}

/**
 * 获取所有资产
 */
export async function getAssets() {
    const response = await fetch(`${API_V1_URL}/assets`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取资产失败');
    }

    return data.data;
}

/**
 * 根据文件ID获取资产
 */
export async function getAssetsByFileId(fileId) {
    const response = await fetch(`${API_V1_URL}/assets?fileId=${fileId}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取资产失败');
    }

    return data.data;
}

/**
 * 根据楼层获取资产
 * 注意：v1 API 需要通过 query 参数实现楼层筛选，暂用旧版
 */
export async function getAssetsByFloor(floor) {
    const response = await fetch(`${API_LEGACY_URL}/assets/floor/${encodeURIComponent(floor)}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取资产失败');
    }

    return data.data;
}

/**
 * 根据房间获取资产
 * 注意：v1 API 需要通过 query 参数实现房间筛选，暂用旧版
 */
export async function getAssetsByRoom(room) {
    const response = await fetch(`${API_LEGACY_URL}/assets/room/${encodeURIComponent(room)}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取资产失败');
    }

    return data.data;
}

/**
 * 获取所有空间
 */
export async function getSpaces() {
    const response = await fetch(`${API_V1_URL}/spaces`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取空间失败');
    }

    return data.data;
}

/**
 * 根据文件ID获取空间
 */
export async function getSpacesByFileId(fileId) {
    const response = await fetch(`${API_V1_URL}/spaces?fileId=${fileId}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取空间失败');
    }

    return data.data;
}

/**
 * 根据楼层获取空间
 * 注意：v1 API 使用 query 参数实现楼层筛选
 */
export async function getSpacesByFloor(floor) {
    const response = await fetch(`${API_V1_URL}/spaces?floor=${encodeURIComponent(floor)}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取空间失败');
    }

    return data.data;
}

/**
 * 从模型导入数据到数据库
 * @param {Object} modelData - 模型数据 { assets: [...], spaces: [...] }
 * 注意：导入 API 尚未迁移到 v1，暂时使用旧版
 */
export async function importModelData(modelData) {
    const response = await fetch(`${API_LEGACY_URL}/import/model-data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(modelData),
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '导入数据失败');
    }

    return data;
}

/**
 * 批量导入分类编码
 * 注意：尚未迁移到 v1，暂时使用旧版
 */
export async function importClassifications(classifications) {
    const response = await fetch(`${API_LEGACY_URL}/classifications/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classifications }),
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '导入分类编码失败');
    }

    return data;
}

/**
 * 批量导入资产规格
 * 注意：尚未迁移到 v1，暂时使用旧版
 */
export async function importAssetSpecs(specs) {
    const response = await fetch(`${API_LEGACY_URL}/asset-specs/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ specs }),
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '导入资产规格失败');
    }

    return data;
}

/**
 * 批量导入资产
 */
export async function importAssets(assets) {
    const response = await fetch(`${API_V1_URL}/assets/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assets }),
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '导入资产失败');
    }

    return data;
}

/**
 * 批量导入空间
 */
export async function importSpaces(spaces) {
    const response = await fetch(`${API_V1_URL}/spaces/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spaces }),
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '导入空间失败');
    }

    return data;
}

export default {
    checkApiHealth,
    getClassifications,
    getAssetSpecs,
    getAssets,
    getAssetsByFileId,
    getAssetsByFloor,
    getAssetsByRoom,
    getSpaces,
    getSpacesByFileId,
    getSpacesByFloor,
    importModelData,
    importClassifications,
    importAssetSpecs,
    importAssets,
    importSpaces,
};

