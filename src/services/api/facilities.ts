/**
 * 设施 API 服务
 */
import http from '../http';
import type {
    FacilityDetail,
    FacilityPayload,
    FacilitySummary,
    FacilityModelSummary,
} from '@/types/facility';

const BASE_PATH = '/api/v1/facilities';

interface FacilityRow {
    id: number;
    facility_code: string;
    name: string;
    description: string | null;
    address: string | null;
    cover_image_path: string | null;
    status: 'active' | 'archived';
    metadata: Record<string, unknown> | null;
    model_count?: number;
    view_count?: number;
    asset_count?: number;
    space_count?: number;
    iot_count?: number;
    document_count?: number;
    default_model_id?: number | null;
    dashboard_count?: number;
    created_at: string;
    updated_at: string;
    models?: FacilityModelRow[];
}

interface FacilityModelRow {
    id: number;
    file_code: string;
    title: string;
    original_name: string | null;
    file_path: string;
    status: string;
    is_active: boolean;
    facility_id: number | null;
    display_order: number;
    view_count: number;
    default_view_id: number | null;
    created_at: string;
    updated_at: string;
    views?: FacilityViewRow[];
}

interface FacilityViewRow {
    id: number;
    file_id: number;
    name: string;
    thumbnail: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

function normalizeView(row: FacilityViewRow) {
    return {
        id: row.id,
        fileId: row.file_id,
        name: row.name,
        thumbnail: row.thumbnail,
        isDefault: row.is_default,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function normalizeModel(row: FacilityModelRow): FacilityModelSummary {
    return {
        id: row.id,
        fileCode: row.file_code,
        title: row.title,
        originalName: row.original_name,
        filePath: row.file_path,
        status: row.status,
        isActive: row.is_active,
        facilityId: row.facility_id,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        viewCount: row.view_count ?? row.views?.length ?? 0,
        defaultViewId: row.default_view_id,
        views: (row.views || []).map(normalizeView),
    };
}

function normalizeSummary(row: FacilityRow): FacilitySummary {
    const models = (row.models || []).map(normalizeModel);
    const fallbackThumbnail = models.flatMap((model) => model.views).find((view) => view.thumbnail)?.thumbnail || null;

    return {
        id: row.id,
        facilityCode: row.facility_code,
        name: row.name,
        description: row.description,
        address: row.address,
        coverImagePath: row.cover_image_path,
        status: row.status,
        metadata: row.metadata || {},
        modelCount: row.model_count ?? models.length,
        viewCount: row.view_count ?? models.reduce((total, model) => total + model.viewCount, 0),
        assetCount: row.asset_count ?? 0,
        spaceCount: row.space_count ?? 0,
        iotCount: row.iot_count ?? 0,
        documentCount: row.document_count ?? 0,
        defaultModelId: row.default_model_id ?? models[0]?.id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        previewThumbnail: row.cover_image_path || fallbackThumbnail,
    };
}

function normalizeDetail(row: FacilityRow): FacilityDetail {
    const summary = normalizeSummary(row);
    return {
        ...summary,
        dashboardCount: row.dashboard_count ?? 0,
        models: (row.models || []).map(normalizeModel),
    };
}

export async function getFacilities(): Promise<FacilitySummary[]> {
    const response = await http.get<FacilityRow[]>(BASE_PATH);
    return (response.data || []).map(normalizeSummary);
}

export async function getFacilityDetail(id: number): Promise<FacilityDetail | null> {
    const response = await http.get<FacilityRow>(`${BASE_PATH}/${id}/detail`);
    return response.data ? normalizeDetail(response.data) : null;
}

export async function createFacility(payload: FacilityPayload): Promise<FacilitySummary> {
    const response = await http.post<FacilityRow>(BASE_PATH, payload);
    if (!response.success || !response.data) {
        throw new Error(response.error || '创建设施失败');
    }
    return normalizeSummary(response.data);
}

export async function updateFacility(id: number, payload: Partial<FacilityPayload>): Promise<FacilitySummary> {
    const response = await http.patch<FacilityRow>(`${BASE_PATH}/${id}`, payload);
    if (!response.success || !response.data) {
        throw new Error(response.error || '更新设施失败');
    }
    return normalizeSummary(response.data);
}

export async function uploadFacilityCover(file: File): Promise<string> {
    const response = await http.uploadFile<{ coverImagePath: string }>(`${BASE_PATH}/cover`, file, 'cover');
    if (!response.success || !response.data?.coverImagePath) {
        throw new Error(response.error || '上传设施缩略图失败');
    }
    return response.data.coverImagePath;
}

export async function deleteFacility(id: number): Promise<void> {
    const response = await http.delete(`${BASE_PATH}/${id}`);
    if (!response.success) {
        throw new Error(response.error || '删除设施失败');
    }
}

export const facilityApi = {
    getFacilities,
    getFacilityDetail,
    createFacility,
    updateFacility,
    uploadFacilityCover,
    deleteFacility,
};
