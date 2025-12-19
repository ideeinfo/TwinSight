/**
 * 动态属性模板类型定义
 * 为属性模板系统预留
 */

/**
 * 属性字段类型
 */
export type PropertyFieldType =
    | 'text'      // 文本
    | 'number'    // 数字
    | 'date'      // 日期
    | 'datetime'  // 日期时间
    | 'boolean'   // 布尔
    | 'select'    // 单选
    | 'multiselect' // 多选
    | 'file'      // 文件
    | 'url'       // 链接
    | 'email'     // 邮箱
    | 'phone';    // 电话

/**
 * 属性模板
 */
export interface PropertyTemplate {
    id: number;
    name: string;
    description?: string;
    classificationCode?: string;
    parentId?: number;
    inheritFromParent: boolean;
    version: number;

    // 模板字段
    fields: PropertyField[];

    createdAt: string;
    updatedAt?: string;
}

/**
 * 属性字段定义
 */
export interface PropertyField {
    id: number;
    templateId: number;
    fieldName: string;
    fieldKey: string;
    fieldType: PropertyFieldType;
    isRequired: boolean;
    defaultValue?: string;
    placeholder?: string;

    // 验证规则
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        message?: string;
    };

    // 选项（用于 select/multiselect）
    options?: { value: string; label: string }[];

    // 显示顺序
    displayOrder: number;

    // 是否继承自父模板
    inherited?: boolean;
}

/**
 * 属性值
 */
export interface PropertyValue {
    id: number;
    entityType: 'asset' | 'space' | 'asset_spec';
    entityId: number;
    fieldId: number;
    value: string;
    version: number;
    createdAt: string;
    updatedAt?: string;
}

/**
 * 属性值历史记录
 */
export interface PropertyValueHistory {
    id: number;
    propertyValueId: number;
    previousValue: string;
    newValue: string;
    changedBy: number;
    changedAt: string;
    reason?: string;
}

/**
 * 模板版本历史
 */
export interface PropertyTemplateVersion {
    id: number;
    templateId: number;
    version: number;
    snapshot: PropertyTemplate;
    createdBy: number;
    createdAt: string;
    changeLog?: string;
}
