import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase.js'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/input-setup',
    name: 'InputSetup',
    component: () => import('../views/InputSetupView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('../views/SetupView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/input',
    redirect: '/input-setup',
  },
  {
    path: '/summary',
    name: 'Summary',
    component: () => import('../views/SummaryView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/chart',
    name: 'Chart',
    component: () => import('../views/ChartView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/export',
    name: 'Export',
    component: () => import('../views/ExportView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard
router.beforeEach(async (to, _from, next) => {
  if (to.meta.requiresAuth) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      return next({ name: 'Login' })
    }
  }
  if (to.meta.requiresGuest) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      return next({ name: 'InputSetup' })
    }
  }
  next()
})

export default router
