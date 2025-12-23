/**
 * 主题状态管理
 * 管理深色/浅色主题切换
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

export const useThemeStore = defineStore('theme', () => {
    // 主题模式：light, dark, system
    const mode = ref<ThemeMode>(
        (localStorage.getItem('theme-mode') as ThemeMode) || 'dark'
    );

    // 系统是否偏好深色模式
    const systemPrefersDark = ref(
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );

    // 实际使用的主题（考虑 system 模式）
    const isDark = computed(() => {
        if (mode.value === 'system') {
            return systemPrefersDark.value;
        }
        return mode.value === 'dark';
    });

    // 当前主题名称
    const currentTheme = computed(() => isDark.value ? 'dark' : 'light');

    // 设置主题模式
    function setMode(newMode: ThemeMode) {
        mode.value = newMode;
        localStorage.setItem('theme-mode', newMode);
        applyTheme();
    }

    // 切换主题（在 light 和 dark 之间）
    function toggleTheme() {
        if (mode.value === 'system') {
            // 从 system 切换时，根据当前实际主题切换到相反主题
            setMode(isDark.value ? 'light' : 'dark');
        } else {
            setMode(mode.value === 'dark' ? 'light' : 'dark');
        }
    }

    // 应用主题到 DOM
    function applyTheme() {
        const root = document.documentElement;
        if (isDark.value) {
            root.classList.remove('light');
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
            root.classList.add('light');
        }
    }

    // 监听系统主题变化
    function initSystemThemeListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            systemPrefersDark.value = e.matches;
            if (mode.value === 'system') {
                applyTheme();
            }
        });
    }

    // 初始化
    function init() {
        initSystemThemeListener();
        applyTheme();
    }

    // 监听 isDark 变化时自动应用
    watch(isDark, () => {
        applyTheme();
    });

    return {
        mode,
        isDark,
        currentTheme,
        setMode,
        toggleTheme,
        applyTheme,
        init,
    };
});
