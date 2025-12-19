/**
 * 模型文件 API 服务
 */
import http, { uploadFile } from '../http';
import type { ModelFile, ModelUploadResponse } from '@/types/model';

const BASE_PATH = '/api/files';

/**
 * 获取所有模型文件
 */
export async function getModelFiles(): Promise<ModelFile[]> {
    const response = await http.get<ModelFile[]>(BASE_PATH);
    return response.data || [];
}

/**
 * 根据 ID 获取模型文件
 */
export async function getModelFileById(id: number): Promise<ModelFile | null> {
    const response = await http.get<ModelFile>(`${BASE_PATH}/${id}`);
    return response.data || null;
}

/**
 * 上传模型文件
 */
export async function uploadModelFile(
    file: File,
    displayName?: string,
    facilityId?: number
): Promise<ModelUploadResponse> {
    const response = await uploadFile<ModelUploadResponse>(
        `${BASE_PATH}/upload`,
        file,
        'model',
        { displayName, facilityId }
    );
    if (!response.success || !response.data) {
        throw new Error(response.error || '上传失败');
    }
    return response.data;
}

/**
 * 更新模型文件信息
 */
export async function updateModelFile(
    id: number,
    data: Partial<ModelFile>
): Promise<ModelFile> {
    const response = await http.put<ModelFile>(`${BASE_PATH}/${id}`, data);
    if (!response.success || !response.data) {
        throw new Error(response.error || '更新失败');
    }
    return response.data;
}

/**
 * 删除模型文件
 */
export async function deleteModelFile(id: number): Promise<void> {
    const response = await http.delete(`${BASE_PATH}/${id}`);
    if (!response.success) {
        throw new Error(response.error || '删除失败');
    }
}

/**
 * 激活模型文件
 */
export async function activateModelFile(id: number): Promise<ModelFile> {
    const response = await http.post<ModelFile>(`${BASE_PATH}/${id}/activate`);
    if (!response.success || !response.data) {
        throw new Error(response.error || '激活失败');
    }
    return response.data;
}

export const modelApi = {
    getModelFiles,
    getModelFileById,
    uploadModelFile,
    updateModelFile,
    deleteModelFile,
    activateModelFile,
};
