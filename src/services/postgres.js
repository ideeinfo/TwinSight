/**
 * PostgreSQL 数据库服务
 * 提供与后端 API 的通信功能
 */

// 后端 API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// API v1 路径
const API_V1 = `${API_BASE_URL}/api/v1`;

/**
 * 检查 API 服务是否可用
 */
export async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * 获取所有分类编码
 * @param {string} type - 可选，'asset' 或 'space'
 */
export async function getClassifications(type = null) {
    const url = type
        ? `${API_BASE_URL}/api/classifications?type=${type}`
        : `${API_BASE_URL}/api/classifications`;

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
    const response = await fetch(`${API_V1}/assets/specs`);
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
    const response = await fetch(`${API_V1}/assets`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取资产失败');
    }

    return data.data;
}

/**
 * 根据楼层获取资产
 */
export async function getAssetsByFloor(floor) {
    const response = await fetch(`${API_BASE_URL}/api/assets/floor/${encodeURIComponent(floor)}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取资产失败');
    }

    return data.data;
}

/**
 * 根据房间获取资产
 */
export async function getAssetsByRoom(room) {
    const response = await fetch(`${API_BASE_URL}/api/assets/room/${encodeURIComponent(room)}`);
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
    const response = await fetch(`${API_V1}/spaces`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取空间失败');
    }

    return data.data;
}

/**
 * 根据楼层获取空间
 */
export async function getSpacesByFloor(floor) {
    const response = await fetch(`${API_BASE_URL}/api/spaces/floor/${encodeURIComponent(floor)}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取空间失败');
    }

    return data.data;
}

/**
 * 从模型导入数据到数据库
 * @param {Object} modelData - 模型数据 { assets: [...], spaces: [...] }
 */
export async function importModelData(modelData) {
    const response = await fetch(`${API_BASE_URL}/api/import/model-data`, {
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
 */
export async function importClassifications(classifications) {
    const response = await fetch(`${API_BASE_URL}/api/classifications/batch`, {
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
 */
export async function importAssetSpecs(specs) {
    const response = await fetch(`${API_BASE_URL}/api/asset-specs/batch`, {
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
    const response = await fetch(`${API_V1}/assets/batch`, {
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
    const response = await fetch(`${API_V1}/spaces/batch`, {
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
    getAssetsByFloor,
    getAssetsByRoom,
    getSpaces,
    getSpacesByFloor,
    importModelData,
    importClassifications,
    importAssetSpecs,
    importAssets,
    importSpaces,
};
