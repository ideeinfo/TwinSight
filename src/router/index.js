import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/viewer',
    name: 'Viewer',
    component: () => import('../AppViewer.vue')
  },
  {
    path: '/assets',
    name: 'Assets',
    component: () => import('../AppViewer.vue')
  },
  {
    path: '/theme-debug',
    name: 'ThemeDebug',
    component: () => import('../views/ThemeDebugPage.vue')
  },
  {
    path: '/chart-view',
    name: 'ChartView',
    component: () => import('../views/ChartView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
