<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const title = computed(() => {
  if (route.name === 'players') return 'Rolo Futbol'
  if (route.name === 'player-detail') return 'Ficha'
  if (route.name === 'player-new') return 'Nuevo jugador'
  if (route.name === 'player-edit') return 'Editar'
  if (route.name === 'events') return 'Equipo'
  if (route.name === 'event-detail') return 'Evento'
  if (route.name === 'board-list') return 'Pizarra'
  if (route.name === 'board-editor') return 'Pizarra táctica'
  return 'Rolo Futbol'
})

const showBack = computed(() => {
  return !['players', 'events', 'board-list'].includes(route.name as string)
})

function goBack() {
  router.back()
}

async function logout() {
  await auth.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <header class="header">
      <button
        v-if="showBack"
        type="button"
        class="icon-btn btn-ghost"
        aria-label="Volver"
        @click="goBack"
      >
        ←
      </button>
      <span v-else class="header-spacer" />
      <h1 class="brand">{{ title }}</h1>
      <button
        type="button"
        class="icon-btn btn-ghost"
        aria-label="Cerrar sesión"
        @click="logout"
      >
        Salir
      </button>
    </header>

    <div v-if="auth.user && !auth.loading" class="role-chip" role="status">
      <span v-if="auth.isAdmin" class="pill admin">Administrador · podés crear y editar</span>
      <span v-else class="pill read">Solo lectura · pedí rol admin en Supabase (profiles.role)</span>
    </div>

    <main class="main">
      <RouterView />
    </main>

    <BottomNav v-if="!route.meta.hideNav" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: calc(64px + var(--safe-bottom));
}

.header {
  display: grid;
  grid-template-columns: 64px 1fr 64px;
  align-items: center;
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(10, 10, 10, 0.92);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
}

.brand {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  text-align: center;
}

.header-spacer {
  width: 1px;
}

.icon-btn {
  padding: 0.45rem 0.5rem;
  border-radius: 8px;
}

.role-chip {
  padding: 0 0.75rem;
  margin: -0.25rem auto 0.35rem;
  max-width: 720px;
  width: 100%;
}

.pill {
  display: block;
  font-size: 0.72rem;
  line-height: 1.35;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.pill.admin {
  border-color: #166534;
  background: rgba(34, 197, 94, 0.12);
  color: #86efac;
}

.pill.read {
  border-color: #713f12;
  background: rgba(245, 158, 11, 0.1);
  color: #fcd34d;
}

.main {
  flex: 1;
  padding: 0.75rem 0.75rem 1rem;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}
</style>
