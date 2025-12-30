/**
 * 资产 API 服务
 */
import http from '../http';
import type { Asset, AssetSpec, AssetCreateRequest, AssetUpdateRequest } from '@/types/asset';
import type { BatchOperationResponse } from '@/types/api';

const BASE_PATH = '/api';

/**
 * 获取所有资产
 */
export async function getAssets(fileId?: number): Promise<Asset[]> {
    const response = await http.get<Asset[]>(`${BASE_PATH}/assets`, { fileId });
    return response.data || [];
}

/**
 * 根据编码获取资产
 */
export async function getAssetByCode(code: string): Promise<Asset | null> {
    const response = await http.get<Asset>(`${BASE_PATH}/assets/${code}`);
    return response.data || null;
}

/**
 * 根据文件 ID 获取资产
 */
export async function getAssetsByFileId(fileId: number): Promise<Asset[]> {
    const response = await http.get<Asset[]>(`${BASE_PATH}/assets`, { fileId });
    return response.data || [];
}

/**
 * 创建资产
 */
export async function createAsset(data: AssetCreateRequest): Promise<Asset> {
    const response = await http.post<Asset>(`${BASE_PATH}/assets`, data);
    if (!response.success || !response.data) {
        throw new Error(response.error || '创建资产失败');
    }
    return response.data;
}

/**
 * 更新资产
 */
export async function updateAsset(code: string, data: AssetUpdateRequest): Promise<Asset> {
    const response = await http.put<Asset>(`${BASE_PATH}/assets/${code}`, data);
    if (!response.success || !response.data) {
        throw new Error(response.error || '更新资产失败');
    }
    return response.data;
}

/**
 * 删除资产
 */
export async function deleteAsset(code: string): Promise<void> {
    const response = await http.delete(`${BASE_PATH}/assets/${code}`);
    if (!response.success) {
        throw new Error(response.error || '删除资产失败');
    }
}

/**
 * 批量导入资产
 */
export async function batchImportAssets(
    assets: AssetCreateRequest[]
): Promise<BatchOperationResponse> {
    const response = await http.post<BatchOperationResponse>(`${BASE_PATH}/assets/batch`, { assets });
    if (!response.success) {
        throw new Error(response.error || '批量导入失败');
    }
    return response.data!;
}

// === 资产规格 API ===

/**
 * 获取所有资产规格
 */
export async function getAssetSpecs(fileId?: number): Promise<AssetSpec[]> {
    const response = await http.get<AssetSpec[]>(`${BASE_PATH}/asset-specs`, { fileId });
    return response.data || [];
}

/**
 * 根据编码获取资产规格
 */
export async function getAssetSpecByCode(code: string): Promise<AssetSpec | null> {
    const response = await http.get<AssetSpec>(`${BASE_PATH}/asset-specs/${code}`);
    return response.data || null;
}

export const assetApi = {
    getAssets,
    getAssetByCode,
    getAssetsByFileId,
    createAsset,
    updateAsset,
    deleteAsset,
    batchImportAssets,
    getAssetSpecs,
    getAssetSpecByCode,
};
