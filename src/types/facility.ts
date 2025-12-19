/**
 * 设施相关类型定义
 * 为设施层架构预留
 */

/**
 * 设施层级类型
 * 支持：园区 > 建筑 > 楼层 > 区域
 */
export type FacilityLevel = 'campus' | 'building' | 'floor' | 'zone';

export interface Facility {
    id: number;
    code: string;
    name: string;
    description?: string;
    level: FacilityLevel;
    parentId?: number;

    // 地理信息
    location?: {
        lat: number;
        lng: number;
        address?: string;
    };

    // 关联模型
    models?: FacilityModel[];

    // 子设施
    children?: Facility[];

    // 元数据
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt?: string;
}

export interface FacilityModel {
    id: number;
    facilityId: number;
    modelFileId: number;
    displayOrder: number;

    // 模型定位
    globalOffset?: { x: number; y: number; z: number };
    transform?: number[]; // 4x4 变换矩阵

    // 可见性
    visible: boolean;
}

/**
 * 设施树节点（用于树形展示）
 */
export interface FacilityTreeNode extends Facility {
    children: FacilityTreeNode[];
    expanded?: boolean;
    selected?: boolean;
}

/**
 * 设施访问权限
 */
export interface FacilityAccess {
    facilityId: number;
    userId: number;
    accessLevel: 'viewer' | 'editor' | 'admin';
}
