/**
 * 请求验证中间件
 * 使用 express-validator 进行请求参数验证
 */
import { validationResult } from 'express-validator';

/**
 * 验证请求参数
 * 如果验证失败，返回 400 错误
 */
export const validateRequest = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '请求参数验证失败',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value,
            })),
        });
    }

    next();
};

/**
 * 通用验证规则
 */
export const commonValidators = {
    // 分页参数
    pagination: {
        page: {
            in: ['query'],
            optional: true,
            isInt: { options: { min: 1 } },
            toInt: true,
            errorMessage: '页码必须是大于 0 的整数',
        },
        limit: {
            in: ['query'],
            optional: true,
            isInt: { options: { min: 1, max: 100 } },
            toInt: true,
            errorMessage: '每页数量必须在 1-100 之间',
        },
    },

    // ID 参数
    id: {
        in: ['params'],
        isInt: { options: { min: 1 } },
        toInt: true,
        errorMessage: 'ID 必须是正整数',
    },

    // 编码参数
    code: {
        in: ['params'],
        notEmpty: true,
        trim: true,
        errorMessage: '编码不能为空',
    },
};

export default {
    validateRequest,
    commonValidators,
};
