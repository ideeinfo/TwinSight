/**
 * 用户模型
 * 用户 CRUD 和身份关联操作
 */
import { query } from '../db/index.js';

/**
 * 创建用户
 */
export async function createUser({ email, passwordHash, name, avatarUrl = null }) {
    const result = await query(`
        INSERT INTO users (email, password_hash, name, avatar_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, avatar_url, is_active, created_at
    `, [email, passwordHash, name, avatarUrl]);
    return result.rows[0];
}

/**
 * 根据邮箱查找用户
 */
export async function findByEmail(email) {
    const result = await query(`
        SELECT id, email, password_hash, name, avatar_url, is_active, last_login_at, created_at
        FROM users WHERE email = $1
    `, [email]);
    return result.rows[0] || null;
}

/**
 * 根据 ID 查找用户
 */
export async function findById(id) {
    const result = await query(`
        SELECT id, email, name, avatar_url, is_active, last_login_at, created_at
        FROM users WHERE id = $1
    `, [id]);
    return result.rows[0] || null;
}

/**
 * 根据第三方身份查找用户
 */
export async function findByIdentity(provider, providerId) {
    const result = await query(`
        SELECT u.id, u.email, u.name, u.avatar_url, u.is_active, u.last_login_at, u.created_at
        FROM users u
        JOIN user_identities ui ON u.id = ui.user_id
        WHERE ui.provider = $1 AND ui.provider_id = $2
    `, [provider, providerId]);
    return result.rows[0] || null;
}

/**
 * 获取用户角色列表
 */
export async function getUserRoles(userId) {
    const result = await query(`
        SELECT role FROM user_roles WHERE user_id = $1
    `, [userId]);
    return result.rows.map(r => r.role);
}

/**
 * 设置用户角色
 */
export async function setUserRoles(userId, roles) {
    // 先删除现有角色
    await query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);

    // 添加新角色
    for (const role of roles) {
        await query(`
            INSERT INTO user_roles (user_id, role) VALUES ($1, $2)
            ON CONFLICT (user_id, role) DO NOTHING
        `, [userId, role]);
    }

    return roles;
}

/**
 * 添加用户角色
 */
export async function addUserRole(userId, role) {
    await query(`
        INSERT INTO user_roles (user_id, role) VALUES ($1, $2)
        ON CONFLICT (user_id, role) DO NOTHING
    `, [userId, role]);
}

/**
 * 关联第三方身份
 */
export async function linkIdentity(userId, provider, providerId, providerData = null) {
    const result = await query(`
        INSERT INTO user_identities (user_id, provider, provider_id, provider_data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (provider, provider_id) DO UPDATE SET
            provider_data = EXCLUDED.provider_data
        RETURNING id
    `, [userId, provider, providerId, providerData ? JSON.stringify(providerData) : null]);
    return result.rows[0];
}

/**
 * 更新用户信息
 */
export async function updateUser(id, { name, avatarUrl }) {
    const result = await query(`
        UPDATE users SET
            name = COALESCE($2, name),
            avatar_url = COALESCE($3, avatar_url),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, email, name, avatar_url, is_active
    `, [id, name, avatarUrl]);
    return result.rows[0];
}

/**
 * 更新最后登录时间
 */
export async function updateLastLogin(id) {
    await query(`
        UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [id]);
}

/**
 * 更新密码
 */
export async function updatePassword(id, passwordHash) {
    await query(`
        UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [id, passwordHash]);
}

/**
 * 禁用/启用用户
 */
export async function setUserActive(id, isActive) {
    await query(`
        UPDATE users SET is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [id, isActive]);
}

/**
 * 获取所有用户（分页）
 */
export async function getAllUsers({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) FROM users`);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
        SELECT u.id, u.email, u.name, u.avatar_url, u.is_active, u.last_login_at, u.created_at,
               ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return {
        users: result.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
}

/**
 * 删除用户
 */
export async function deleteUser(id) {
    await query(`DELETE FROM users WHERE id = $1`, [id]);
}

// ========================================
// 刷新令牌相关
// ========================================

/**
 * 保存刷新令牌
 */
export async function saveRefreshToken(userId, tokenHash, expiresAt) {
    await query(`
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
    `, [userId, tokenHash, expiresAt]);
}

/**
 * 验证刷新令牌
 */
export async function findRefreshToken(tokenHash) {
    const result = await query(`
        SELECT rt.*, u.email, u.name, u.is_active
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token_hash = $1 AND rt.expires_at > CURRENT_TIMESTAMP
    `, [tokenHash]);
    return result.rows[0] || null;
}

/**
 * 删除刷新令牌
 */
export async function deleteRefreshToken(tokenHash) {
    await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
}

/**
 * 清理用户的所有刷新令牌（用于登出）
 */
export async function clearUserRefreshTokens(userId) {
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
}

/**
 * 清理过期的刷新令牌
 */
export async function cleanExpiredRefreshTokens() {
    await query(`DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP`);
}

export default {
    createUser,
    findByEmail,
    findById,
    findByIdentity,
    getUserRoles,
    setUserRoles,
    addUserRole,
    linkIdentity,
    updateUser,
    updateLastLogin,
    updatePassword,
    setUserActive,
    getAllUsers,
    deleteUser,
    saveRefreshToken,
    findRefreshToken,
    deleteRefreshToken,
    clearUserRefreshTokens,
    cleanExpiredRefreshTokens,
};
