/**
 * 格式化工具函数
 */

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date | string | number, locale = 'zh-CN'): string {
    const d = new Date(date);
    return d.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | string | number, locale = 'zh-CN'): string {
    const d = new Date(date);
    return d.toLocaleDateString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

/**
 * 格式化时间
 */
export function formatTime(date: Date | string | number, locale = 'zh-CN'): string {
    const d = new Date(date);
    return d.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

/**
 * 格式化温度
 */
export function formatTemperature(value: number, unit: 'C' | 'F' = 'C'): string {
    if (unit === 'F') {
        return `${((value * 9) / 5 + 32).toFixed(1)}°F`;
    }
    return `${value.toFixed(1)}°C`;
}

/**
 * 格式化数字（带千分位）
 */
export function formatNumber(value: number, decimals = 0): string {
    return value.toLocaleString('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/**
 * 截断文本
 */
export function truncate(text: string, maxLength: number, suffix = '...'): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 首字母大写
 */
export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * 格式化 AI 分析文本（Markdown 转 HTML）
 * 将简单的 Markdown 语法转换为 HTML 用于显示
 */
export function formatAnalysisText(text: string): string {
    if (!text) return '';

    // 预处理：移除多余的空行和孤立的 #
    const processed = text
        .replace(/^#\s*$/gm, '')           // 移除孤立的 #
        .replace(/\n{3,}/g, '\n\n')        // 多个换行合并为两个
        .replace(/^\s+|\s+$/g, '')         // 去掉首尾空白
        .trim();

    // Markdown 转 HTML
    return processed
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')      // ## 标题
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')     // ### 标题
        .replace(/^# (.+)$/gm, '<h3>$1</h3>')       // # 标题也转为 h3
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // 粗体
        .replace(/^- (.+)$/gm, '<li>$1</li>')       // 列表项
        .replace(/^(\d+)\. (.+)$/gm, '<div class="numbered-item"><span class="num">$1.</span> $2</div>')  // 编号列表
        .replace(/\n\n/g, '</p><p>')               // 段落
        .replace(/\n/g, '<br>')                    // 换行
        .replace(/^/, '<p>')                       // 开头加 p
        .replace(/$/, '</p>')                      // 结尾加 p
        .replace(/<p><h/g, '<h')                   // 清理标题前的 p
        .replace(/<\/h(\d)><\/p>/g, '</h$1>')      // 清理标题后的 p
        .replace(/<p><\/p>/g, '');                 // 移除空段落
}
