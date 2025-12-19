/**
 * 颜色处理工具函数
 */

/**
 * HSL 转 RGB
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number): number => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * RGB 转 Hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Hex 转 RGB
 */
export function hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : null;
}

/**
 * 根据温度值生成热力图颜色
 * @param temp 温度值
 * @param minTemp 最低温度
 * @param maxTemp 最高温度
 * @returns RGB 颜色数组
 */
export function temperatureToColor(
    temp: number,
    minTemp = 18,
    maxTemp = 30
): [number, number, number] {
    // 归一化到 0-1
    const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

    // 从蓝色 (240°) 到红色 (0°)
    const hue = (1 - normalized) * 240;

    return hslToRgb(hue, 80, 50);
}

/**
 * 根据值生成渐变颜色
 * @param value 值 (0-1)
 * @param colors 颜色数组 (从低到高)
 */
export function valueToGradientColor(
    value: number,
    colors: string[] = ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c']
): string {
    const normalized = Math.max(0, Math.min(1, value));
    const index = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
    return colors[index];
}

/**
 * 生成随机颜色
 */
export function randomColor(): string {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

/**
 * 判断颜色是否较暗
 */
export function isDarkColor(hex: string): boolean {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    const [r, g, b] = rgb;
    // 计算相对亮度
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}
