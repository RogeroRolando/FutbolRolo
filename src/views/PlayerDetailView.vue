<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { PlayerRow } from '@/types/database'
import { positionLabel } from '@/lib/positions'
import PositionBadge from '@/components/PositionBadge.vue'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const player = ref<PlayerRow | null>(null)
const loading = ref(true)

const pid = computed(() => props.id || (route.params.id as string))

onMounted(load)

async function load() {
  loading.value = true
  const { data, error } = await supabase.from('players').select('*').eq('id', pid.value).single()
  loading.value = false
  if (error) {
    console.error(error)
    return
  }
  player.value = data
}

function age(d: string | null): string {
  if (!d) return '—'
  const b = new Date(d)
  const t = new Date()
  let a = t.getFullYear() - b.getFullYear()
  const m = t.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--
  return `${a} años`
}

async function archive() {
  if (!player.value || !auth.isAdmin) return
  if (!confirm('¿Archivar jugador? Podés volver a mostrarlo desde la lista.')) return
  const { error } = await supabase.from('players').update({ archived: true }).eq('id', player.value.id)
  if (error) {
    alert(error.message)
    return
  }
  router.push({ name: 'players' })
}

async function unarchive() {
  if (!player.value || !auth.isAdmin) return
  const { error } = await supabase.from('players').update({ archived: false }).eq('id', player.value.id)
  if (error) {
    alert(error.message)
    return
  }
  await load()
}

async function removeForever() {
  if (!player.value || !auth.isAdmin) return
  if (
    !confirm(
      '¿Eliminar definitivamente? Se borra el jugador y sus vínculos de asistencia/convocatorias.',
    )
  ) {
    return
  }
  const { error } = await supabase.from('players').delete().eq('id', player.value.id)
  if (error) {
    alert(error.message)
    return
  }
  router.push({ name: 'players' })
}
</script>

<template>
  <p v-if="loading" class="muted">Cargando…</p>
  <div v-else-if="player" class="detail">
    <section class="hero card">
      <div class="avatar">{{ player.full_name.split(' ').map((s) => s[0]).join('').slice(0, 3).toUpperCase() }}</div>
      <div>
        <h2 class="name">{{ player.full_name }}</h2>
        <div class="row">
          <PositionBadge :code="player.primary_position" />
          <span class="muted">{{ positionLabel(player.primary_position) }}</span>
        </div>
        <div v-if="player.shirt_number != null" class="shirt">Camiseta · {{ player.shirt_number }}</div>
      </div>
    </section>

    <section class="card block">
      <h3 class="sub">Información personal</h3>
      <dl class="grid">
        <dt>Nacimiento</dt>
        <dd>{{ player.birth_date || '—' }} <span v-if="player.birth_date" class="muted">({{ age(player.birth_date) }})</span></dd>
        <dt>Contacto</dt>
        <dd>{{ player.phone || '—' }}</dd>
      </dl>
    </section>

    <section class="card block">
      <h3 class="sub">Características de juego</h3>
      <dl class="grid">
        <dt>Posición principal</dt>
        <dd>{{ positionLabel(player.primary_position) }}</dd>
        <dt>Pierna hábil</dt>
        <dd>{{ player.foot || '—' }}</dd>
        <dt>Fortalezas</dt>
        <dd>{{ player.strengths || '—' }}</dd>
        <dt>Debilidades</dt>
        <dd>{{ player.weaknesses || '—' }}</dd>
      </dl>
    </section>

    <section class="card block">
      <h3 class="sub">Estado físico</h3>
      <p>{{ player.fitness_status }}</p>
    </section>

    <section class="card block">
      <h3 class="sub">Valoración</h3>
      <p class="rating">{{ player.rating ?? '—' }} <span class="muted">/ 10</span></p>
    </section>

    <div class="actions">
      <RouterLink
        v-if="auth.isAdmin"
        class="btn btn-primary full"
        :to="{ name: 'player-edit', params: { id: player.id } }"
      >
        Editar
      </RouterLink>
      <button v-if="auth.isAdmin && !player.archived" type="button" class="btn full danger" @click="archive">
        Archivar
      </button>
      <button v-if="auth.isAdmin && player.archived" type="button" class="btn full" @click="unarchive">
        Desarchivar (volver a lista activa)
      </button>
      <button v-if="auth.isAdmin" type="button" class="btn full danger solid" @click="removeForever">
        Eliminar del todo
      </button>
    </div>
  </div>
  <p v-else class="err">No se encontró el jugador.</p>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hero {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 2px solid var(--accent);
  display: grid;
  place-items: center;
  font-weight: 800;
  flex-shrink: 0;
}

.name {
  margin: 0 0 0.25rem;
  font-size: 1.2rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.shirt {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: var(--accent);
}

.block {
  padding: 0.85rem 1rem;
}

.sub {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  color: var(--muted);
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 0.35rem 0.75rem;
  margin: 0;
  font-size: 0.92rem;
}

.grid dt {
  color: var(--muted);
}

.grid dd {
  margin: 0;
}

.rating {
  font-size: 1.5rem;
  font-weight: 700;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.full {
  width: 100%;
  text-align: center;
}

.danger {
  border-color: var(--danger);
  color: var(--danger);
  background: transparent;
}

.danger.solid {
  background: rgba(239, 68, 68, 0.12);
}
</style>
