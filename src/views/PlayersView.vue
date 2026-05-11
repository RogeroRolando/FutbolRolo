<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { PlayerRow } from '@/types/database'
import { POSITIONS, initials } from '@/lib/positions'
import PositionBadge from '@/components/PositionBadge.vue'

const auth = useAuthStore()
const players = ref<PlayerRow[]>([])
const loading = ref(true)
const loadErr = ref('')
const q = ref('')
const pos = ref<string>('')
const showArchived = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  loadErr.value = ''
  let query = supabase.from('players').select('*').order('full_name')
  if (!showArchived.value) {
    query = query.eq('archived', false)
  }
  const { data, error } = await query
  loading.value = false
  if (error) {
    console.error(error)
    loadErr.value = error.message
    return
  }
  players.value = data ?? []
}

const filtered = computed(() => {
  const qq = q.value.trim().toLowerCase()
  return players.value.filter((p) => {
    const nameOk = !qq || p.full_name.toLowerCase().includes(qq)
    const posOk = !pos.value || p.primary_position === pos.value
    return nameOk && posOk
  })
})
</script>

<template>
  <div v-if="auth.isAdmin" class="toolbar-top">
    <RouterLink class="btn btn-primary add-link" :to="{ name: 'player-new' }">
      Agregar jugador
    </RouterLink>
  </div>

  <p v-if="loadErr" class="err">{{ loadErr }}</p>

  <div class="toolbar">
    <input
      v-model="q"
      class="search"
      type="search"
      placeholder="Buscar jugador…"
      aria-label="Buscar jugador"
    />
    <select v-model="pos" class="filter" aria-label="Filtrar posición">
      <option value="">Todas</option>
      <option v-for="p in POSITIONS" :key="p" :value="p">{{ p }}</option>
    </select>
  </div>

  <label class="row-check">
    <input v-model="showArchived" type="checkbox" @change="load" />
    Mostrar archivados
  </label>

  <p v-if="loading" class="muted">Cargando…</p>
  <p v-if="!loading && !loadErr && filtered.length === 0" class="muted empty-msg">
    No hay jugadores con estos filtros. {{ auth.isAdmin ? 'Creá uno con «Agregar jugador».' : '' }}
  </p>

  <ul v-if="!loading && !loadErr" class="list">
    <li v-for="(p, idx) in filtered" :key="p.id">
      <RouterLink class="row" :to="{ name: 'player-detail', params: { id: p.id } }">
        <span class="num">{{ idx + 1 }}</span>
        <div class="avatar" aria-hidden="true">{{ initials(p.full_name) }}</div>
        <div class="grow">
          <div class="name">{{ p.full_name }}</div>
          <div class="muted sm">{{ p.archived ? 'Archivado · ' : '' }}{{ p.phone || 'Sin teléfono' }}</div>
        </div>
        <PositionBadge :code="p.primary_position" />
        <span class="chev">›</span>
      </RouterLink>
    </li>
  </ul>

  <RouterLink
    v-if="auth.isAdmin"
    class="fab btn btn-primary"
    :to="{ name: 'player-new' }"
  >
    +
  </RouterLink>
</template>

<style scoped>
.toolbar-top {
  margin-bottom: 0.6rem;
}

.add-link {
  display: inline-flex;
  justify-content: center;
  width: 100%;
  text-decoration: none;
}

.empty-msg {
  margin: 0.5rem 0 1rem;
}

.toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.search {
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.filter {
  padding: 0.55rem 0.4rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}

.row-check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 0.75rem;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.25rem;
  border-bottom: 1px solid var(--border);
  color: inherit;
}

.num {
  width: 1.2rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 700;
}

.grow {
  flex: 1;
  min-width: 0;
}

.name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sm {
  font-size: 0.78rem;
}

.chev {
  color: var(--muted);
  font-size: 1.25rem;
}

.fab {
  position: fixed;
  right: 1rem;
  bottom: calc(4.5rem + var(--safe-bottom));
  width: 52px;
  height: 52px;
  border-radius: 999px;
  font-size: 1.75rem;
  line-height: 1;
  padding: 0;
  z-index: 15;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
</style>
