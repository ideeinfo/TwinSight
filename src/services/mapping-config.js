/**
 * 映射配置 API 服务
 * 用于获取和保存文件的字段映射配置
 */

// 生产环境使用同源 API（空字符串），开发环境使用 localhost
const API_HOST = import.meta.env.VITE_API_URL || '';
const API_BASE = `${API_HOST}/api`;

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
 * 获取文件的映射配置
 * @param {number} fileId - 文件ID
 * @returns {Promise<Object>} 包含 assetMapping, assetSpecMapping, spaceMapping
 */
export async function getMappingConfig(fileId) {
    try {
        const response = await fetch(`${API_BASE}/mapping-config/${fileId}`, { headers: getHeaders() });
        const data = await response.json();

        if (data.success) {
            return data.data;
        }

        throw new Error(data.error || '获取映射配置失败');
    } catch (error) {
        console.error('获取映射配置失败:', error);
        // 返回空配置，让调用者使用默认值
        return {
            assetMapping: {},
            assetSpecMapping: {},
            spaceMapping: {}
        };
    }
}

/**
 * 保存文件的映射配置
 * @param {number} fileId - 文件ID
 * @param {Object} config - 配置对象
 * @param {Object} config.assetMapping - 资产映射
 * @param {Object} config.assetSpecMapping - 资产规格映射
 * @param {Object} config.spaceMapping - 空间映射
 * @returns {Promise<Object>}
 */
export async function saveMappingConfig(fileId, config) {
    try {
        const response = await fetch(`${API_BASE}/mapping-config/${fileId}`, {
            method: 'POST',
            headers: getHeaders('application/json'),
            body: JSON.stringify(config)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || '保存映射配置失败');
        }

        return data;
    } catch (error) {
        console.error('保存映射配置失败:', error);
        throw error;
    }
}

/**
 * 获取默认映射配置
 * 当数据库中没有配置时使用
 */
export function getDefaultMapping() {
    return {
        assetMapping: {
            assetCode: { category: '文字', property: 'MC编码' },
            specCode: { category: '标识数据', property: '类型注释' },
            name: { category: '标识数据', property: '名称' },
            floor: { category: '约束', property: '标高' },
            room: { category: '房间', property: '名称' }
        },
        assetSpecMapping: {
            specCode: { category: '标识数据', property: '类型注释' },
            specName: { category: '标识数据', property: '类型名称' },
            classificationCode: { category: '数据', property: 'Classification.OmniClass.21.Number' },
            classificationDesc: { category: '数据', property: 'Classification.OmniClass.21.Description' },
            category: { category: '其他', property: '类别' },
            family: { category: '其他', property: '族' },
            type: { category: '其他', property: '类型' },
            manufacturer: { category: '标识数据', property: '制造商' },
            address: { category: '标识数据', property: '地址' },
            phone: { category: '标识数据', property: '联系人电话' }
        },
        spaceMapping: {
            spaceCode: { category: '标识数据', property: '编号' },
            name: { category: '标识数据', property: '名称' },
            area: { category: '尺寸标注', property: '面积' },
            perimeter: { category: '尺寸标注', property: '周长' },
            floor: { category: '约束', property: '标高' },
            classificationCode: { category: '数据', property: 'Classification.OmniClass.21.Number' },
            classificationDesc: { category: '数据', property: 'Classification.OmniClass.21.Description' }
        }
    };
}
