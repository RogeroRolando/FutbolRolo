<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { EventRow } from '@/types/database'

const auth = useAuthStore()
const router = useRouter()
const events = ref<EventRow[]>([])
const loading = ref(true)
const err = ref('')

const showForm = ref(false)
const editingId = ref<string | null>(null)

const kind = ref<'entrenamiento' | 'partido'>('entrenamiento')
const starts_at = ref('')
const title = ref('')
const desc = ref('')
const saving = ref(false)

function toLocalInput(iso: string) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

onMounted(load)

async function load() {
  loading.value = true
  err.value = ''
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: false })
  loading.value = false
  if (error) {
    err.value = error.message
    return
  }
  events.value = data ?? []
}

function openNew() {
  editingId.value = null
  showForm.value = true
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  starts_at.value = d.toISOString().slice(0, 16)
  kind.value = 'entrenamiento'
  title.value = ''
  desc.value = ''
}

function openEdit(e: EventRow) {
  editingId.value = e.id
  showForm.value = true
  kind.value = e.kind
  starts_at.value = toLocalInput(e.starts_at)
  title.value = e.title ?? ''
  desc.value = e.description ?? ''
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

async function saveEvent() {
  saving.value = true
  err.value = ''
  const payload = {
    kind: kind.value,
    starts_at: new Date(starts_at.value).toISOString(),
    title: title.value.trim() || null,
    description: desc.value.trim() || null,
  }

  if (editingId.value) {
    const { error } = await supabase.from('events').update(payload).eq('id', editingId.value)
    saving.value = false
    if (error) {
      err.value = error.message
      return
    }
    closeForm()
    await load()
    return
  }

  const { data, error } = await supabase.from('events').insert(payload).select('id').single()
  saving.value = false
  if (error) {
    err.value = error.message
    return
  }
  closeForm()
  await load()
  if (data?.id) await router.push({ name: 'event-detail', params: { id: data.id } })
}

async function removeEvent(e: EventRow) {
  if (!auth.isAdmin) return
  if (
    !confirm(
      `¿Eliminar este evento? Se borran convocados y asistencias vinculadas.\n\n${e.title || e.kind}`,
    )
  ) {
    return
  }
  const { error } = await supabase.from('events').delete().eq('id', e.id)
  if (error) {
    err.value = error.message
    return
  }
  await load()
}
</script>

<template>
  <div class="head">
    <p class="muted">
      Acá administrás <strong>eventos del equipo</strong> (entrenos y partidos). En cada uno registrás
      convocados y asistencia.
    </p>
    <button v-if="auth.isAdmin" type="button" class="btn btn-primary" @click="openNew">
      + Evento
    </button>
  </div>

  <div v-if="showForm && auth.isAdmin" class="card form card-box">
    <h2 class="h3">{{ editingId ? 'Editar evento' : 'Nuevo evento' }}</h2>
    <div class="field">
      <label>Tipo</label>
      <select v-model="kind">
        <option value="entrenamiento">Entrenamiento</option>
        <option value="partido">Partido</option>
      </select>
    </div>
    <div class="field">
      <label>Fecha y hora</label>
      <input v-model="starts_at" type="datetime-local" required />
    </div>
    <div class="field">
      <label>Título</label>
      <input v-model="title" type="text" placeholder="Opcional" />
    </div>
    <div class="field">
      <label>Nota</label>
      <textarea v-model="desc" rows="2" />
    </div>
    <p v-if="err" class="err">{{ err }}</p>
    <div class="row-btns">
      <button type="button" class="btn" :disabled="saving" @click="closeForm">Cancelar</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="saveEvent">
        {{ editingId ? 'Guardar cambios' : 'Crear' }}
      </button>
    </div>
  </div>

  <p v-if="loading" class="muted">Cargando…</p>
  <p v-else-if="err && !showForm" class="err">{{ err }}</p>
  <p v-else-if="events.length === 0" class="muted card slim">
    No hay eventos. {{ auth.isAdmin ? 'Creá uno con «+ Evento».' : '' }}
  </p>
  <ul v-else class="list">
    <li v-for="e in events" :key="e.id" class="card event-row">
      <RouterLink class="event-main" :to="{ name: 'event-detail', params: { id: e.id } }">
        <div>
          <div class="badge">{{ e.kind === 'partido' ? 'Partido' : 'Entreno' }}</div>
          <div class="t">{{ e.title || 'Sin título' }}</div>
          <div class="muted sm">{{ new Date(e.starts_at).toLocaleString() }}</div>
        </div>
        <span class="chev">›</span>
      </RouterLink>
      <div v-if="auth.isAdmin" class="event-actions">
        <button type="button" class="btn btn-mini" @click.stop="openEdit(e)">Editar</button>
        <button type="button" class="btn btn-mini danger" @click.stop="removeEvent(e)">
          Eliminar
        </button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.form {
  margin-bottom: 1rem;
}

.card-box {
  padding: 1rem;
}

.row-btns {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.slim {
  padding: 0.85rem;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.event-row {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.event-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  color: inherit;
  text-decoration: none;
}

.event-main:hover,
.event-main:focus-visible {
  background: var(--surface-2);
  outline: none;
}

.badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
  background: var(--surface-2);
  margin-bottom: 0.25rem;
}

.t {
  font-weight: 600;
}

.sm {
  font-size: 0.8rem;
}

.chev {
  color: var(--muted);
  font-size: 1.25rem;
}

.event-actions {
  display: flex;
  gap: 0.4rem;
  padding: 0 0.75rem 0.75rem;
  border-top: 1px solid var(--border);
}

.btn-mini {
  padding: 0.35rem 0.55rem;
  font-size: 0.8rem;
  border-radius: 8px;
}

.btn-mini.danger {
  border-color: var(--danger);
  color: var(--danger);
  background: transparent;
}
</style>
