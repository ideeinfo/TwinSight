/**
 * PostgreSQL 数据库服务
 * 提供与后端 API 的通信功能
 */

// 后端 API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// API v1 路径
const API_V1 = `${API_BASE_URL}/api/v1`;

import { useAuthStore } from '../stores/auth';

const getHeaders = (contentType = null) => {
    const authStore = useAuthStore();
    const headers = {};
    if (authStore.token) {
        headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    return headers;
};

/**
 * 检查 API 服务是否可用
 */
export async function checkApiHealth() {
    try {
        const response = await fetch(`${API_V1}/health`, { headers: getHeaders() });
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

    const response = await fetch(url, { headers: getHeaders() });
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
    const response = await fetch(`${API_V1}/assets/specs`, { headers: getHeaders() });
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
    const response = await fetch(`${API_V1}/assets`, { headers: getHeaders() });
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
    const response = await fetch(`${API_BASE_URL}/api/assets/floor/${encodeURIComponent(floor)}`, { headers: getHeaders() });
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
    const response = await fetch(`${API_BASE_URL}/api/assets/room/${encodeURIComponent(room)}`, { headers: getHeaders() });
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
    const response = await fetch(`${API_V1}/spaces`, { headers: getHeaders() });
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
    const response = await fetch(`${API_BASE_URL}/api/spaces/floor/${encodeURIComponent(floor)}`, { headers: getHeaders() });
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
        headers: getHeaders('application/json'),
        body: JSON.stringify(modelData),
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '导入数据失败');
    }

    return data;
}

/**
 * 检查文件是否已有导出的数据
 * @param {number|string} fileId - 文件ID
 * @returns {boolean} - 是否已有数据
 */
export async function checkExistingData(fileId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/check-existing-data/${fileId}`, { headers: getHeaders() });
        const data = await response.json();
        return data.success && data.hasData;
    } catch {
        return false;
    }
}

/**
 * 批量导入分类编码
 */
export async function importClassifications(classifications) {
    const response = await fetch(`${API_BASE_URL}/api/classifications/batch`, {
        method: 'POST',
        headers: getHeaders('application/json'),
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
        headers: getHeaders('application/json'),
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
        headers: getHeaders('application/json'),
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
        headers: getHeaders('application/json'),
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
    checkExistingData,
    importClassifications,
    importAssetSpecs,
    importAssets,
    importSpaces,
};
