import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    name: 'Landing',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomeDashboardView.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/facilities',
    name: 'Facilities',
    component: () => import('../views/FacilitiesView.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/manage',
    name: 'Manage',
    component: () => import('../views/ManageView.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/viewer',
    name: 'Viewer',
    component: () => import('../AppViewer.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/assets',
    name: 'Assets',
    component: () => import('../AppViewer.vue'),
    meta: {
      requiresAuth: true
    }
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

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.path === '/' && authStore.isAuthenticated) {
    return '/home'
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return '/'
  }

  return true
})

export default router
