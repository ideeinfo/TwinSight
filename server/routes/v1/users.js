/**
 * 用户管理路由（管理员）
 */
import { Router } from 'express';
import * as userModel from '../../models/user.js'; // path fixed for deployment
import { authenticate, authorize } from '../../middleware/auth.js';
import { PERMISSIONS, ROLES } from '../../config/auth.js';

const router = Router();

// 所有路由需要认证
router.use(authenticate);

/**
 * 获取用户列表
 * GET /api/v1/users
 */
router.get('/', authorize(PERMISSIONS.USER_READ), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await userModel.getAllUsers({
            page: parseInt(page),
            limit: parseInt(limit),
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('获取用户列表失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 获取用户详情
 * GET /api/v1/users/:id
 */
router.get('/:id', authorize(PERMISSIONS.USER_READ), async (req, res) => {
    try {
        const user = await userModel.findById(parseInt(req.params.id));
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在',
            });
        }

        const roles = await userModel.getUserRoles(user.id);

        res.json({
            success: true,
            data: { ...user, roles },
        });
    } catch (error) {
        console.error('获取用户详情失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 更新用户
 * PUT /api/v1/users/:id
 */
router.put('/:id', authorize(PERMISSIONS.USER_UPDATE), async (req, res) => {
    try {
        const { name, avatarUrl, isActive } = req.body;
        const userId = parseInt(req.params.id);

        // 更新基本信息
        if (name || avatarUrl) {
            await userModel.updateUser(userId, { name, avatarUrl });
        }

        // 更新状态
        if (isActive !== undefined) {
            await userModel.setUserActive(userId, isActive);
        }

        const user = await userModel.findById(userId);
        const roles = await userModel.getUserRoles(userId);

        res.json({
            success: true,
            data: { ...user, roles },
            message: '用户更新成功',
        });
    } catch (error) {
        console.error('更新用户失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 设置用户角色
 * PUT /api/v1/users/:id/roles
 */
router.put('/:id/roles', authorize(PERMISSIONS.SYSTEM_ADMIN), async (req, res) => {
    try {
        const { roles } = req.body;
        const userId = parseInt(req.params.id);

        if (!roles || !Array.isArray(roles)) {
            return res.status(400).json({
                success: false,
                error: '请提供角色数组',
            });
        }

        // 验证角色有效性
        const validRoles = Object.values(ROLES);
        const invalidRoles = roles.filter(r => !validRoles.includes(r));
        if (invalidRoles.length > 0) {
            return res.status(400).json({
                success: false,
                error: `无效的角色: ${invalidRoles.join(', ')}`,
            });
        }

        await userModel.setUserRoles(userId, roles);

        res.json({
            success: true,
            data: { roles },
            message: '角色设置成功',
        });
    } catch (error) {
        console.error('设置用户角色失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 删除用户
 * DELETE /api/v1/users/:id
 */
router.delete('/:id', authorize(PERMISSIONS.USER_DELETE), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // 不允许删除自己
        if (userId === req.user.sub) {
            return res.status(400).json({
                success: false,
                error: '不能删除自己',
            });
        }

        await userModel.deleteUser(userId);

        res.json({
            success: true,
            message: '用户删除成功',
        });
    } catch (error) {
        console.error('删除用户失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
