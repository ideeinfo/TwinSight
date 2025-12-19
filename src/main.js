import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import i18n from './i18n'
import { useAuthStore } from './stores/auth'

// 创建 Vue 应用
const app = createApp(App)

// 创建 Pinia 实例
const pinia = createPinia()

// 注册插件
app.use(pinia)
app.use(i18n)

// 初始化 Auth Store（临时启用访客模式）
const authStore = useAuthStore()
authStore.enableGuestMode()

// 挂载应用
app.mount('#app')
