import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, hideNav: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppShell.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: { name: 'players' },
        },
        {
          path: 'jugadores',
          name: 'players',
          component: () => import('@/views/PlayersView.vue'),
        },
        {
          path: 'jugadores/nuevo',
          name: 'player-new',
          component: () => import('@/views/PlayerFormView.vue'),
          meta: { admin: true },
        },
        {
          path: 'jugadores/:id',
          name: 'player-detail',
          component: () => import('@/views/PlayerDetailView.vue'),
          props: true,
        },
        {
          path: 'jugadores/:id/editar',
          name: 'player-edit',
          component: () => import('@/views/PlayerFormView.vue'),
          props: true,
          meta: { admin: true },
        },
        {
          path: 'equipo',
          name: 'events',
          component: () => import('@/views/EventsView.vue'),
        },
        {
          path: 'equipo/:id',
          name: 'event-detail',
          component: () => import('@/views/EventDetailView.vue'),
          props: true,
        },
        {
          path: 'pizarra',
          name: 'board-list',
          component: () => import('@/views/PizarraListView.vue'),
        },
        {
          path: 'pizarra/:id',
          name: 'board-editor',
          component: () => import('@/views/PizarraEditorView.vue'),
          props: true,
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()

  if (to.meta.public) {
    if (auth.user && to.name === 'login') {
      return { name: 'players' }
    }
    return true
  }

  if (!auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.admin && !auth.isAdmin) {
    return { name: 'players' }
  }

  return true
})

export default router
