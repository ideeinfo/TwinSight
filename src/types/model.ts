/**
 * 模型相关类型定义
 */

export type ModelStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface ModelFile {
    id: number;
    fileName: string;
    displayName: string;
    filePath: string;
    urn?: string;
    status: ModelStatus;
    fileSize?: number;
    uploadedAt: string;

    // 设施关联（预留）
    facilityId?: number;
    displayOrder?: number;
}

export interface ModelUploadRequest {
    file: File;
    displayName?: string;
    facilityId?: number;
}

export interface ModelUploadResponse {
    id: number;
    fileName: string;
    status: ModelStatus;
    message: string;
}
