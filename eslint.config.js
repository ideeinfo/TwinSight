import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default [
    // JavaScript 基础规则
    js.configs.recommended,

    // TypeScript 规则
    ...tseslint.configs.recommended,

    // Vue 规则
    ...pluginVue.configs['flat/recommended'],

    // 全局配置
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                Autodesk: 'readonly',
                THREE: 'readonly'
            }
        }
    },

    // Vue 文件特定配置
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser
            }
        },
        rules: {
            // Vue 规则调整
            'vue/multi-word-component-names': 'off',
            'vue/no-v-html': 'off',
            'vue/require-default-prop': 'off',
            'vue/no-unused-vars': 'warn',
            'vue/html-self-closing': ['warn', {
                html: { void: 'always', normal: 'never', component: 'always' }
            }],
            'vue/max-attributes-per-line': 'off',
            'vue/singleline-html-element-content-newline': 'off'
        }
    },

    // TypeScript 文件配置
    {
        files: ['**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
        }
    },

    // JavaScript 文件配置
    {
        files: ['**/*.js'],
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
        }
    },

    // 忽略文件
    {
        ignores: [
            'node_modules/',
            'dist/',
            'public/',
            'server/node_modules/',
            '*.min.js'
        ]
    }
]
