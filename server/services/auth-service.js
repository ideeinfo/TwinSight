/**
 * 认证服务
 * 处理用户注册、登录、令牌管理
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';
import { ROLES } from '../config/auth.js';
import * as userModel from '../models/user.js';
import { getRolePermissions } from '../config/auth.js';

const SALT_ROUNDS = 10;
const DEFAULT_ROLE = ROLES.VIEWER;

/**
 * 用户注册
 */
export async function register({ email, password, name }) {
    // 检查邮箱是否已存在
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
        throw new Error('该邮箱已被注册');
    }

    // 验证密码强度
    validatePassword(password);

    // 加密密码
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户
    const user = await userModel.createUser({
        email,
        passwordHash,
        name,
    });

    // 分配默认角色
    await userModel.addUserRole(user.id, DEFAULT_ROLE);

    // 关联邮箱身份
    await userModel.linkIdentity(user.id, 'email', email);

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: [DEFAULT_ROLE],
    };
}

/**
 * 邮箱密码登录
 */
export async function login({ email, password }) {
    // 查找用户
    const user = await userModel.findByEmail(email);
    if (!user) {
        throw new Error('邮箱或密码错误');
    }

    // 检查账户状态
    if (!user.is_active) {
        throw new Error('账户已被禁用');
    }

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        throw new Error('邮箱或密码错误');
    }

    // 更新最后登录时间
    await userModel.updateLastLogin(user.id);

    // 获取角色和权限
    const roles = await userModel.getUserRoles(user.id);
    const permissions = getPermissionsFromRoles(roles);

    // 生成令牌
    console.log(`[AuthDebug] User: ${user.email}, Roles: ${JSON.stringify(roles)}`);
    // Check if MODEL_ACTIVATE is present
    const hasActivate = permissions.includes('model:activate');
    console.log(`[AuthDebug] Has model:activate: ${hasActivate}`);

    const tokens = await generateTokens(user, roles, permissions);

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            roles,
        },
        ...tokens,
    };
}

/**
 * OAuth 登录/注册
 */
export async function oauthLogin({ provider, providerId, email, name, avatarUrl, providerData }) {
    // 查找已关联的用户
    let user = await userModel.findByIdentity(provider, providerId);

    if (!user) {
        // 尝试通过邮箱查找用户
        if (email) {
            user = await userModel.findByEmail(email);
            if (user) {
                // 关联新的身份
                await userModel.linkIdentity(user.id, provider, providerId, providerData);
            }
        }
    }

    if (!user) {
        // 创建新用户
        user = await userModel.createUser({
            email,
            passwordHash: null, // OAuth 用户没有密码
            name,
            avatarUrl,
        });

        // 分配默认角色
        await userModel.addUserRole(user.id, DEFAULT_ROLE);

        // 关联身份
        await userModel.linkIdentity(user.id, provider, providerId, providerData);
    }

    // 检查账户状态
    if (!user.is_active) {
        throw new Error('账户已被禁用');
    }

    // 更新最后登录时间
    await userModel.updateLastLogin(user.id);

    // 获取角色和权限
    const roles = await userModel.getUserRoles(user.id);
    const permissions = getPermissionsFromRoles(roles);

    // 生成令牌
    const tokens = await generateTokens(user, roles, permissions);

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            roles,
        },
        ...tokens,
    };
}

/**
 * 刷新 Access Token
 */
export async function refreshAccessToken(refreshToken) {
    // 计算 token hash
    const tokenHash = hashToken(refreshToken);

    // 查找刷新令牌
    const tokenRecord = await userModel.findRefreshToken(tokenHash);
    if (!tokenRecord) {
        throw new Error('无效的刷新令牌');
    }

    // 检查用户状态
    if (!tokenRecord.is_active) {
        throw new Error('账户已被禁用');
    }

    // 获取用户完整信息
    const user = await userModel.findById(tokenRecord.user_id);
    const roles = await userModel.getUserRoles(user.id);
    const permissions = getPermissionsFromRoles(roles);

    // 生成新的 Access Token
    const accessToken = generateAccessToken(user, roles, permissions);

    return {
        accessToken,
        expiresIn: config.jwt.expiresIn,
    };
}

/**
 * 登出（清除刷新令牌）
 */
export async function logout(userId, refreshToken = null) {
    if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await userModel.deleteRefreshToken(tokenHash);
    } else {
        // 清除所有刷新令牌
        await userModel.clearUserRefreshTokens(userId);
    }
}

/**
 * 修改密码
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
    const user = await userModel.findById(userId);
    if (!user) {
        throw new Error('用户不存在');
    }

    // 获取带密码的用户信息
    const userWithPassword = await userModel.findByEmail(user.email);

    // 验证当前密码
    if (userWithPassword.password_hash) {
        const validPassword = await bcrypt.compare(currentPassword, userWithPassword.password_hash);
        if (!validPassword) {
            throw new Error('当前密码错误');
        }
    }

    // 验证新密码强度
    validatePassword(newPassword);

    // 更新密码
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userModel.updatePassword(userId, newPasswordHash);

    // 清除所有刷新令牌（强制重新登录）
    await userModel.clearUserRefreshTokens(userId);
}

// ========================================
// 辅助函数
// ========================================

/**
 * 验证密码强度
 */
function validatePassword(password) {
    if (!password || password.length < 8) {
        throw new Error('密码长度至少 8 位');
    }
    if (!/[a-zA-Z]/.test(password)) {
        throw new Error('密码必须包含字母');
    }
    if (!/[0-9]/.test(password)) {
        throw new Error('密码必须包含数字');
    }
}

/**
 * 从角色列表获取权限
 */
function getPermissionsFromRoles(roles) {
    const permissionSet = new Set();
    for (const role of roles) {
        const rolePerms = getRolePermissions(role);
        rolePerms.forEach(p => permissionSet.add(p));
    }
    return Array.from(permissionSet);
}

/**
 * 生成 Access Token
 */
function generateAccessToken(user, roles, permissions) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            name: user.name,
            roles,
            permissions,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
}

/**
 * 生成令牌对（Access + Refresh）
 */
async function generateTokens(user, roles, permissions) {
    const accessToken = generateAccessToken(user, roles, permissions);

    // 生成刷新令牌
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(refreshToken);

    // 计算过期时间
    const expiresAt = new Date();
    const refreshDays = parseInt(config.jwt.refreshExpiresIn) || 7;
    expiresAt.setDate(expiresAt.getDate() + refreshDays);

    // 保存刷新令牌
    await userModel.saveRefreshToken(user.id, tokenHash, expiresAt);

    return {
        accessToken,
        refreshToken,
        expiresIn: config.jwt.expiresIn,
        refreshExpiresIn: config.jwt.refreshExpiresIn,
    };
}

/**
 * 计算令牌哈希
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export default {
    register,
    login,
    oauthLogin,
    refreshAccessToken,
    logout,
    changePassword,
};
