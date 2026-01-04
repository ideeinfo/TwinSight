import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './style.css'
import './theme.css'  // M3 主题变量
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'

// 创建 Vue 应用
const app = createApp(App)

// 创建 Pinia 实例
const pinia = createPinia()

// 注册插件
app.use(pinia)
app.use(router)
app.use(i18n)
app.use(ElementPlus)

// 初始化 Auth Store（尝试从 localStorage 恢复登录状态）
const authStore = useAuthStore()
const savedToken = localStorage.getItem('accessToken')
if (savedToken) {
    // TODO: 验证 token 有效性
    // authStore.setAuth(...) 应该在调用 /me 接口验证后设置
}
// 不再自动启用访客模式，要求用户登录
// authStore.enableGuestMode()

// 初始化主题
const themeStore = useThemeStore()
themeStore.init()

// 挂载应用
app.mount('#app')

