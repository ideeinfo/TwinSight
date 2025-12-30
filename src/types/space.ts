/**
 * 空间相关类型定义
 */

export interface Space {
    id: number;
    spaceCode: string;
    name: string;
    category?: string;
    floor?: string;
    area?: number;
    dbId?: number;
    fileId?: number;
    classificationCode?: string;

    // 动态属性（预留）
    properties?: Record<string, unknown>;

    createdAt?: string;
    updatedAt?: string;
}

export interface SpaceCreateRequest {
    spaceCode: string;
    name: string;
    category?: string;
    floor?: string;
    area?: number;
    dbId?: number;
    fileId?: number;
    classificationCode?: string;
    properties?: Record<string, unknown>;
}

export interface SpaceUpdateRequest {
    name?: string;
    category?: string;
    floor?: string;
    area?: number;
    classificationCode?: string;
    properties?: Record<string, unknown>;
}
