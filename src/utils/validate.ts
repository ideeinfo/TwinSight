/**
 * 验证工具函数
 */

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * 验证手机号格式（中国大陆）
 */
export function isValidPhone(phone: string): boolean {
    const re = /^1[3-9]\d{9}$/;
    return re.test(phone);
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * 验证是否为非空字符串
 */
export function isNotEmpty(value: any): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 验证是否为数字
 */
export function isNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value);
}

/**
 * 验证是否在范围内
 */
export function isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}

/**
 * 验证密码强度
 * 返回: 0-弱, 1-中, 2-强
 */
export function getPasswordStrength(password: string): number {
    if (password.length < 6) return 0;

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 1) return 0;
    if (strength <= 2) return 1;
    return 2;
}

/**
 * 验证文件类型
 */
export function isValidFileType(file: File, allowedTypes: string[]): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return allowedTypes.includes(extension);
}

/**
 * 验证文件大小
 */
export function isValidFileSize(file: File, maxSizeBytes: number): boolean {
    return file.size <= maxSizeBytes;
}
