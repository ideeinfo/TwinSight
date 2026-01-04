/**
 * 认证配置
 * JWT 和权限相关配置
 */
import config from './index.js';

// 权限定义
export const PERMISSIONS = {
    // 资产权限
    ASSET_READ: 'asset:read',
    ASSET_CREATE: 'asset:create',
    ASSET_UPDATE: 'asset:update',
    ASSET_DELETE: 'asset:delete',

    // 空间权限
    SPACE_READ: 'space:read',
    SPACE_CREATE: 'space:create',
    SPACE_UPDATE: 'space:update',
    SPACE_DELETE: 'space:delete',

    // 模型权限
    MODEL_READ: 'model:read',
    MODEL_UPLOAD: 'model:upload',
    MODEL_ACTIVATE: 'model:activate',
    MODEL_DELETE: 'model:delete',

    // 设施权限（预留）
    FACILITY_READ: 'facility:read',
    FACILITY_CREATE: 'facility:create',
    FACILITY_UPDATE: 'facility:update',
    FACILITY_DELETE: 'facility:delete',
    FACILITY_MANAGE: 'facility:manage',

    // 用户管理权限（预留）
    USER_READ: 'user:read',
    USER_CREATE: 'user:create',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user:delete',

    // 系统管理权限
    SYSTEM_ADMIN: 'system:admin',

    // 文档权限
    DOCUMENT_READ: 'document:read',
    DOCUMENT_CREATE: 'document:create',
    DOCUMENT_UPDATE: 'document:update',
    DOCUMENT_DELETE: 'document:delete',

    // InfluxDB 配置权限
    INFLUX_READ: 'influx:read',
    INFLUX_MANAGE: 'influx:manage',
};

// 角色定义
export const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    EDITOR: 'editor',
    VIEWER: 'viewer',
    GUEST: 'guest',
};

// 角色-权限映射
export const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: Object.values(PERMISSIONS),

    [ROLES.MANAGER]: [
        PERMISSIONS.ASSET_READ,
        PERMISSIONS.ASSET_CREATE,
        PERMISSIONS.ASSET_UPDATE,
        PERMISSIONS.SPACE_READ,
        PERMISSIONS.SPACE_CREATE,
        PERMISSIONS.SPACE_UPDATE,
        PERMISSIONS.MODEL_READ,
        PERMISSIONS.MODEL_UPLOAD,
        PERMISSIONS.MODEL_ACTIVATE,
        PERMISSIONS.FACILITY_READ,
        PERMISSIONS.FACILITY_UPDATE,
        PERMISSIONS.DOCUMENT_READ,
        PERMISSIONS.DOCUMENT_CREATE,
        PERMISSIONS.DOCUMENT_UPDATE,
        PERMISSIONS.DOCUMENT_DELETE,
        PERMISSIONS.INFLUX_READ,
        PERMISSIONS.INFLUX_MANAGE,
    ],

    [ROLES.EDITOR]: [
        PERMISSIONS.ASSET_READ,
        PERMISSIONS.ASSET_UPDATE,
        PERMISSIONS.SPACE_READ,
        PERMISSIONS.SPACE_UPDATE,
        PERMISSIONS.MODEL_READ,
        PERMISSIONS.MODEL_ACTIVATE,
        PERMISSIONS.FACILITY_READ,
        PERMISSIONS.DOCUMENT_READ,
        PERMISSIONS.DOCUMENT_CREATE,
        PERMISSIONS.DOCUMENT_UPDATE,
        PERMISSIONS.DOCUMENT_DELETE,
        PERMISSIONS.INFLUX_READ,
    ],

    [ROLES.VIEWER]: [
        PERMISSIONS.ASSET_READ,
        PERMISSIONS.SPACE_READ,
        PERMISSIONS.MODEL_READ,
        PERMISSIONS.MODEL_ACTIVATE,
        PERMISSIONS.FACILITY_READ,
        PERMISSIONS.DOCUMENT_READ,
        PERMISSIONS.INFLUX_READ,
    ],

    [ROLES.GUEST]: [
        PERMISSIONS.ASSET_READ,
        PERMISSIONS.SPACE_READ,
        PERMISSIONS.MODEL_READ,
    ],
};

/**
 * 获取角色的所有权限
 */
export const getRolePermissions = (role) => {
    return ROLE_PERMISSIONS[role] || [];
};

/**
 * 检查角色是否有指定权限
 */
export const hasPermission = (role, permission) => {
    const permissions = getRolePermissions(role);
    return permissions.includes(permission) || permissions.includes(PERMISSIONS.SYSTEM_ADMIN);
};

export default {
    jwt: config.jwt,
    PERMISSIONS,
    ROLES,
    ROLE_PERMISSIONS,
    getRolePermissions,
    hasPermission,
};
