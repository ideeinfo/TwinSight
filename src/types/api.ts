/**
 * API 响应类型定义
 */

/**
 * 通用 API 响应格式
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * 分页请求参数
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
}

/**
 * 批量操作响应
 */
export interface BatchOperationResponse {
    success: boolean;
    total: number;
    succeeded: number;
    failed: number;
    errors?: { index: number; error: string }[];
}

/**
 * 文件上传响应
 */
export interface FileUploadResponse {
    id: number;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
}
