/**
 * 资产相关类型定义
 */

export interface Asset {
    id: number;
    assetCode: string;
    specCode?: string;
    name: string;
    floor?: string;
    room?: string;
    dbId?: number;
    fileId?: number;

    // 动态属性（预留）
    properties?: Record<string, any>;

    createdAt?: string;
    updatedAt?: string;
}

export interface AssetSpec {
    id: number;
    specCode: string;
    specName: string;
    classificationCode?: string;
    classificationName?: string;
    manufacturer?: string;
    address?: string;
    phone?: string;

    // 动态属性（预留）
    properties?: Record<string, any>;

    // 关联的属性模板（预留）
    propertyTemplateId?: number;
}

export interface Classification {
    id: number;
    classificationCode: string;
    description?: string;
    parentCode?: string;
    level: number;
}

export interface AssetCreateRequest {
    assetCode: string;
    specCode?: string;
    name: string;
    floor?: string;
    room?: string;
    dbId?: number;
    fileId?: number;
    properties?: Record<string, any>;
}

export interface AssetUpdateRequest {
    name?: string;
    floor?: string;
    room?: string;
    specCode?: string;
    properties?: Record<string, any>;
}
