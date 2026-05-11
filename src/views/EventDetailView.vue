<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { EventRow, PlayerRow } from '@/types/database'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const eventId = computed(() => props.id || (route.params.id as string))

const ev = ref<EventRow | null>(null)
const players = ref<PlayerRow[]>([])
const attendanceMap = ref<Record<string, 'presente' | 'ausente' | 'justificado' | 'lesion'>>({})
const callSet = ref<Set<string>>(new Set())
const loading = ref(true)
const err = ref('')
const onlyCalled = ref(false)

onMounted(load)

watch(eventId, () => load())

async function load() {
  loading.value = true
  err.value = ''
  const eid = eventId.value

  const [eRes, pRes, aRes, cRes] = await Promise.all([
    supabase.from('events').select('*').eq('id', eid).single(),
    supabase.from('players').select('*').eq('archived', false).order('full_name'),
    supabase.from('attendance').select('*').eq('event_id', eid),
    supabase.from('call_ups').select('player_id').eq('event_id', eid),
  ])

  if (eRes.error || !eRes.data) {
    err.value = eRes.error?.message ?? 'Evento no encontrado'
    loading.value = false
    return
  }
  ev.value = eRes.data
  players.value = pRes.data ?? []

  const am: Record<string, 'presente' | 'ausente' | 'justificado' | 'lesion'> = {}
  for (const r of aRes.data ?? []) {
    am[r.player_id] = r.status
  }
  attendanceMap.value = am

  callSet.value = new Set((cRes.data ?? []).map((x) => x.player_id))
  loading.value = false
}

const statusOptions = ['presente', 'ausente', 'justificado', 'lesion'] as const

function onAttChange(playerId: string, ev: Event) {
  const v = (ev.target as HTMLSelectElement).value as (typeof statusOptions)[number]
  void setAttendance(playerId, v)
}

async function setAttendance(playerId: string, status: (typeof statusOptions)[number]) {
  if (!auth.isAdmin) return
  const eid = eventId.value
  attendanceMap.value = { ...attendanceMap.value, [playerId]: status }
  const { error } = await supabase.from('attendance').upsert(
    { event_id: eid, player_id: playerId, status },
    { onConflict: 'event_id,player_id' },
  )
  if (error) {
    err.value = error.message
  }
}

async function toggleCall(playerId: string) {
  if (!auth.isAdmin) return
  const eid = eventId.value
  const next = new Set(callSet.value)
  if (next.has(playerId)) {
    next.delete(playerId)
    const { error } = await supabase.from('call_ups').delete().eq('event_id', eid).eq('player_id', playerId)
    if (error) err.value = error.message
  } else {
    next.add(playerId)
    const { error } = await supabase.from('call_ups').insert({ event_id: eid, player_id: playerId })
    if (error) err.value = error.message
  }
  callSet.value = next
}

const visiblePlayers = computed(() => {
  if (!onlyCalled.value) return players.value
  return players.value.filter((p) => callSet.value.has(p.id))
})

function copyList() {
  const lines = players.value
    .filter((p) => callSet.value.has(p.id))
    .map((p) => p.full_name)
  navigator.clipboard?.writeText(lines.join('\n'))
}

async function deleteEventPerm() {
  if (!ev.value || !auth.isAdmin) return
  if (
    !confirm(
      '¿Eliminar este evento para siempre? Se borran convocados y asistencias asociadas.',
    )
  ) {
    return
  }
  const { error } = await supabase.from('events').delete().eq('id', ev.value.id)
  if (error) {
    err.value = error.message
    return
  }
  await router.replace({ name: 'events' })
}
</script>

<template>
  <p v-if="loading" class="muted">Cargando…</p>
  <div v-else-if="ev" class="page">
    <div class="card head">
      <div class="badge">{{ ev.kind === 'partido' ? 'Partido' : 'Entrenamiento' }}</div>
      <h2 class="title">{{ ev.title || 'Evento' }}</h2>
      <p class="muted">{{ new Date(ev.starts_at).toLocaleString() }}</p>
      <p v-if="ev.description" class="desc">{{ ev.description }}</p>
      <div v-if="auth.isAdmin" class="head-actions">
        <RouterLink class="btn" :to="{ name: 'events' }">Ir a equipo (editar en lista)</RouterLink>
        <button type="button" class="btn danger-outline" @click="deleteEventPerm">
          Eliminar evento
        </button>
      </div>
    </div>

    <p v-if="err" class="err">{{ err }}</p>

    <section class="card block">
      <div class="section-head">
        <h3>Convocados</h3>
        <label class="row-check">
          <input v-model="onlyCalled" type="checkbox" />
          Solo convocados
        </label>
      </div>
      <p v-if="auth.isAdmin" class="muted sm">Marcá quién está citado para este evento.</p>
      <ul class="plist">
        <li v-for="p in visiblePlayers" :key="p.id" class="prow">
          <label v-if="auth.isAdmin" class="call">
            <input type="checkbox" :checked="callSet.has(p.id)" @change="toggleCall(p.id)" />
          </label>
          <span v-else class="dot" :data-on="callSet.has(p.id)">●</span>
          <span class="pname">{{ p.full_name }}</span>
        </li>
      </ul>
      <button v-if="callSet.size > 0" type="button" class="btn subtle" @click="copyList">
        Copiar nombres al portapapeles
      </button>
    </section>

    <section class="card block">
      <h3>Asistencia</h3>
      <p v-if="!auth.isAdmin" class="muted sm">Solo lectura.</p>
      <div v-for="p in players" :key="'a-' + p.id" class="ap-row">
        <span class="pname">{{ p.full_name }}</span>
        <select
          v-if="auth.isAdmin"
          class="sel"
          :value="attendanceMap[p.id] ?? 'presente'"
          @change="onAttChange(p.id, $event)"
        >
          <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
        </select>
        <span v-else class="muted">{{ attendanceMap[p.id] ?? '—' }}</span>
      </div>
    </section>
  </div>
  <p v-else class="err">No encontrado.</p>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.head {
  padding: 1rem;
}

.badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  background: var(--surface-2);
  margin-bottom: 0.35rem;
}

.title {
  margin: 0;
  font-size: 1.15rem;
}

.desc {
  margin: 0.35rem 0 0;
  font-size: 0.95rem;
}

.head-actions {
  margin-top: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.head-actions .btn {
  text-decoration: none;
  display: inline-flex;
  justify-content: center;
}

.danger-outline {
  border-color: var(--danger);
  color: var(--danger);
  background: transparent;
}

.block {
  padding: 0.85rem 1rem;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.section-head h3 {
  margin: 0;
  font-size: 1rem;
}

.row-check {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.plist {
  list-style: none;
  padding: 0;
  margin: 0 0 0.5rem;
}

.prow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border);
}

.call input {
  width: 1.1rem;
  height: 1.1rem;
}

.dot {
  color: var(--muted);
  font-size: 0.6rem;
}

.dot[data-on='true'] {
  color: var(--accent);
}

.pname {
  flex: 1;
  min-width: 0;
}

.sm {
  font-size: 0.85rem;
}

.ap-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border);
}

.sel {
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}

.subtle {
  width: 100%;
  margin-top: 0.25rem;
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--muted);
}
</style>
