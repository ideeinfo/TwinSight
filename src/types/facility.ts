/**
 * 设施相关类型定义
 */

export type FacilityStatus = 'active' | 'archived';
export type FacilityListMode = 'list' | 'grid';

export interface FacilitySummary {
    id: number;
    facilityCode: string;
    name: string;
    description: string | null;
    address: string | null;
    coverImagePath: string | null;
    status: FacilityStatus;
    metadata: Record<string, unknown>;
    modelCount: number;
    viewCount: number;
    assetCount: number;
    spaceCount: number;
    iotCount: number;
    documentCount: number;
    defaultModelId: number | null;
    createdAt: string;
    updatedAt: string;
    previewThumbnail?: string | null;
}

export interface FacilityModelView {
    id: number;
    fileId: number;
    name: string;
    thumbnail: string | null;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FacilityModelSummary {
    id: number;
    fileCode: string;
    title: string;
    originalName: string | null;
    filePath: string;
    status: string;
    isActive: boolean;
    facilityId: number | null;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
    viewCount: number;
    defaultViewId: number | null;
    views: FacilityModelView[];
}

export interface FacilityDetail extends FacilitySummary {
    dashboardCount: number;
    models: FacilityModelSummary[];
}

export interface FacilityPayload {
    facilityCode?: string;
    name: string;
    description?: string | null;
    address?: string | null;
    coverImagePath?: string | null;
    status?: FacilityStatus;
}
