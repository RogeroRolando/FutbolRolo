<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { emptyBoard, type BoardStateV1 } from '@/types/board'
import type { Json } from '@/types/database'

const auth = useAuthStore()
const router = useRouter()
const rows = ref<
  { id: string; name: string; updated_at: string; konva_json?: unknown; schema_version?: number }[]
>([])
const loading = ref(true)
const err = ref('')
const pending = ref(false)
const deletingId = ref<string | null>(null)

onMounted(load)

async function load() {
  loading.value = true
  err.value = ''
  const { data, error } = await supabase
    .from('tactical_boards')
    .select('*')
    .order('updated_at', { ascending: false })
  loading.value = false
  if (error) {
    err.value = error.message
    return
  }
  rows.value = data ?? []
}

async function createBoard() {
  if (!auth.isAdmin) return
  pending.value = true
  err.value = ''
  const initial: BoardStateV1 = emptyBoard()
  const { data, error } = await supabase
    .from('tactical_boards')
    .insert({
      name: 'Nuevo diagrama',
      konva_json: initial as unknown as Json,
      schema_version: 1,
    })
    .select('id')
    .single()
  pending.value = false
  if (error) {
    err.value = error.message
    return
  }
  if (data?.id) await router.push({ name: 'board-editor', params: { id: data.id } })
}

async function removeBoard(id: string, name: string) {
  if (!auth.isAdmin) return
  if (!confirm(`¿Eliminar el diagrama “${name}”? No se puede deshacer.`)) return
  deletingId.value = id
  err.value = ''
  const { error } = await supabase.from('tactical_boards').delete().eq('id', id)
  deletingId.value = null
  if (error) {
    err.value = error.message
    return
  }
  const cur = router.currentRoute.value
  const curId = cur.params['id']
  if (cur.name === 'board-editor' && String(curId) === id) {
    await router.replace({ name: 'board-list' })
  }
  await load()
}
</script>

<template>
  <section class="intro card">
    <p class="intro-text muted">
      Los diagramas se guardan en la nube. <strong>Elegí uno de la lista</strong> para abrir el lienzo verde:
      marcadores, líneas y flechas.
    </p>
    <div class="pitch-preview" aria-hidden="true">
      <div class="mini-field">
        <div class="half-line" />
        <div class="center-spot" />
        <span class="dot a">1</span>
        <span class="dot b">5</span>
        <span class="dot c">9</span>
      </div>
    </div>
  </section>

  <p v-if="err" class="err">{{ err }}</p>

  <button
    v-if="auth.isAdmin"
    type="button"
    class="btn btn-primary full primary-action"
    :disabled="pending"
    @click="createBoard"
  >
    {{ pending ? 'Creando…' : '+ Crear nuevo diagrama' }}
  </button>
  <p v-else class="card muted tip">
    Con tu cuenta actual solo ves la pizarra. Para <strong>crear</strong> diagramas necesitás
    rol <strong>admin</strong> en la tabla <code>profiles</code> (consulta SQL en la migración).
  </p>

  <div v-if="loading" class="muted">Cargando lista…</div>

  <template v-else>
    <p v-if="rows.length === 0" class="card empty muted">
      <template v-if="auth.isAdmin">
        Todavía no hay diagramas. Tocá <strong>Crear nuevo diagrama</strong> para abrir el lienzo táctico.
      </template>
      <template v-else>
        No hay diagramas guardados (o tu usuario solo tiene permiso de lectura y la lista viene vacía).
      </template>
    </p>

    <ul v-if="rows.length > 0" class="list">
      <li v-for="b in rows" :key="b.id" class="card li-row">
        <RouterLink class="row-link" :to="'/pizarra/' + b.id">
          <div class="grow">
            <div class="name">{{ b.name }}</div>
            <div class="muted sm">Actualizado · {{ new Date(b.updated_at).toLocaleString() }}</div>
          </div>
          <span class="chev" aria-hidden="true">Abrir ›</span>
        </RouterLink>
        <button
          v-if="auth.isAdmin"
          type="button"
          class="btn btn-del"
          :disabled="deletingId === b.id"
          aria-label="Eliminar diagrama"
          @click="removeBoard(b.id, b.name)"
        >
          {{ deletingId === b.id ? '…' : 'Eliminar' }}
        </button>
      </li>
    </ul>
  </template>
</template>

<style scoped>
.intro {
  padding: 0.85rem;
  margin-bottom: 0.75rem;
  border-color: var(--border);
}

.intro-text {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
}

.pitch-preview {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #14532d;
}

.mini-field {
  position: relative;
  aspect-ratio: 3 / 4.6;
  max-height: 220px;
  margin: 0 auto;
  background: linear-gradient(180deg, #166534 0%, #14532d 55%, #052e16 100%);
}

.half-line {
  position: absolute;
  left: 50%;
  top: 8px;
  bottom: 8px;
  width: 2px;
  margin-left: -1px;
  background: rgba(255, 255, 255, 0.55);
}

.center-spot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-radius: 50%;
}

.dot {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 800;
  border: 2px solid #0a0a0a;
}

.dot.a {
  left: 16%;
  top: 10%;
  background: #3b82f6;
  color: #fff;
}

.dot.b {
  right: 18%;
  top: 44%;
  background: #fff;
  color: #0a0a0a;
}

.dot.c {
  left: 22%;
  bottom: 14%;
  background: #fff;
  color: #0a0a0a;
}

.full {
  width: 100%;
}

.primary-action {
  margin-bottom: 0.75rem;
}

.tip {
  padding: 0.85rem;
  margin-bottom: 0.75rem;
  font-size: 0.88rem;
}

.tip code {
  font-size: 0.8em;
  color: var(--accent);
}

.empty {
  padding: 1rem;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.li-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
}

.row-link {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 0.75rem 0.85rem 1rem;
  color: var(--text);
  text-decoration: none;
  min-width: 0;
}

.row-link:hover,
.row-link:focus-visible {
  background: var(--surface-2);
  outline: none;
}

.btn-del {
  flex-shrink: 0;
  align-self: stretch;
  padding: 0 0.65rem;
  border: none;
  border-left: 1px solid var(--border);
  border-radius: 0;
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  font-size: 0.78rem;
  font-weight: 600;
}

.btn-del:disabled {
  opacity: 0.6;
}

.grow {
  min-width: 0;
}

.name {
  font-weight: 700;
  font-size: 1rem;
}

.sm {
  font-size: 0.8rem;
  margin-top: 0.2rem;
}

.chev {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 600;
}
</style>
