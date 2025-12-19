/**
 * 空间 API 服务
 */
import http from '../http';
import type { Space, SpaceCreateRequest, SpaceUpdateRequest } from '@/types/space';
import type { BatchOperationResponse } from '@/types/api';

const BASE_PATH = '/api';

/**
 * 获取所有空间
 */
export async function getSpaces(fileId?: number): Promise<Space[]> {
    const response = await http.get<Space[]>(`${BASE_PATH}/spaces`, { fileId });
    return response.data || [];
}

/**
 * 根据编码获取空间
 */
export async function getSpaceByCode(code: string): Promise<Space | null> {
    const response = await http.get<Space>(`${BASE_PATH}/spaces/${code}`);
    return response.data || null;
}

/**
 * 根据文件 ID 获取空间
 */
export async function getSpacesByFileId(fileId: number): Promise<Space[]> {
    const response = await http.get<Space[]>(`${BASE_PATH}/spaces`, { fileId });
    return response.data || [];
}

/**
 * 创建空间
 */
export async function createSpace(data: SpaceCreateRequest): Promise<Space> {
    const response = await http.post<Space>(`${BASE_PATH}/spaces`, data);
    if (!response.success || !response.data) {
        throw new Error(response.error || '创建空间失败');
    }
    return response.data;
}

/**
 * 更新空间
 */
export async function updateSpace(code: string, data: SpaceUpdateRequest): Promise<Space> {
    const response = await http.put<Space>(`${BASE_PATH}/spaces/${code}`, data);
    if (!response.success || !response.data) {
        throw new Error(response.error || '更新空间失败');
    }
    return response.data;
}

/**
 * 删除空间
 */
export async function deleteSpace(code: string): Promise<void> {
    const response = await http.delete(`${BASE_PATH}/spaces/${code}`);
    if (!response.success) {
        throw new Error(response.error || '删除空间失败');
    }
}

/**
 * 批量导入空间
 */
export async function batchImportSpaces(
    spaces: SpaceCreateRequest[]
): Promise<BatchOperationResponse> {
    const response = await http.post<BatchOperationResponse>(`${BASE_PATH}/spaces/batch`, { spaces });
    if (!response.success) {
        throw new Error(response.error || '批量导入失败');
    }
    return response.data!;
}

export const spaceApi = {
    getSpaces,
    getSpaceByCode,
    getSpacesByFileId,
    createSpace,
    updateSpace,
    deleteSpace,
    batchImportSpaces,
};
