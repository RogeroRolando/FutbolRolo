<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import type { PlayerRow } from '@/types/database'
import { POSITIONS } from '@/lib/positions'

const route = useRoute()
const router = useRouter()

const id = computed(() => (route.params.id as string) || '')
const isEdit = computed(() => Boolean(id.value))

const full_name = ref('')
const birth_date = ref('')
const phone = ref('')
const primary_position = ref('DEF')
const secondary_positions = ref<string[]>([])
const foot = ref<'derecha' | 'izquierda' | 'ambas' | ''>('')
const strengths = ref('')
const weaknesses = ref('')
const fitness_status = ref<'ok' | 'molestias' | 'lesionado'>('ok')
const rating = ref<number | null>(null)
const shirt_number = ref<number | null>(null)
const archived = ref(false)
const saving = ref(false)
const err = ref('')

onMounted(async () => {
  if (!isEdit.value) return
  const { data, error } = await supabase.from('players').select('*').eq('id', id.value).single()
  if (error || !data) {
    err.value = error?.message ?? 'No encontrado'
    return
  }
  apply(data)
})

function apply(p: PlayerRow) {
  full_name.value = p.full_name
  birth_date.value = p.birth_date ?? ''
  phone.value = p.phone ?? ''
  primary_position.value = p.primary_position
  secondary_positions.value = [...(p.secondary_positions ?? [])].filter(
    (c) => c !== p.primary_position && c !== 'OTRO',
  )
  foot.value = p.foot ?? ''
  strengths.value = p.strengths ?? ''
  weaknesses.value = p.weaknesses ?? ''
  fitness_status.value = p.fitness_status
  rating.value = p.rating
  shirt_number.value = p.shirt_number
  archived.value = p.archived
}

watch(primary_position, (pos) => {
  secondary_positions.value = secondary_positions.value.filter((c) => c !== pos)
})

async function save() {
  err.value = ''
  if (!full_name.value.trim()) {
    err.value = 'El nombre es obligatorio'
    return
  }
  saving.value = true
  const payload = {
    full_name: full_name.value.trim(),
    birth_date: birth_date.value || null,
    phone: phone.value.trim() || null,
    primary_position: primary_position.value,
    secondary_positions: secondary_positions.value.filter(
      (c) => c !== primary_position.value && ['ARQ', 'DEF', 'VOL', 'DEL'].includes(c),
    ),
    foot: foot.value === '' ? null : foot.value,
    strengths: strengths.value.trim() || null,
    weaknesses: weaknesses.value.trim() || null,
    fitness_status: fitness_status.value,
    rating: rating.value,
    rating_updated_at: rating.value != null ? new Date().toISOString() : null,
    shirt_number: shirt_number.value,
    ...(isEdit.value ? { archived: archived.value } : { archived: false }),
  }
  if (isEdit.value) {
    const { error } = await supabase.from('players').update(payload).eq('id', id.value)
    saving.value = false
    if (error) err.value = error.message
    else await router.replace({ name: 'player-detail', params: { id: id.value } })
  } else {
    const { data, error } = await supabase.from('players').insert(payload).select('id').single()
    saving.value = false
    if (error) err.value = error.message
    else if (data) await router.replace({ name: 'player-detail', params: { id: data.id } })
  }
}
</script>

<template>
  <form class="form" @submit.prevent="save">
    <div class="field">
      <label for="fn">Nombre completo *</label>
      <input id="fn" v-model="full_name" required autocomplete="name" />
    </div>
    <div class="field">
      <label for="bd">Fecha de nacimiento</label>
      <input id="bd" v-model="birth_date" type="date" />
    </div>
    <div class="field">
      <label for="ph">Teléfono</label>
      <input id="ph" v-model="phone" type="tel" autocomplete="tel" />
    </div>
    <div class="field">
      <label for="pos">Posición principal</label>
      <select id="pos" v-model="primary_position">
        <option v-for="p in POSITIONS" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>
    <fieldset class="field sec-pos">
      <legend>Posiciones alternativas</legend>
      <p class="hint">En la pizarra suman menos que la posición natural si coinciden con la zona.</p>
      <div class="pos-chips">
        <label v-for="c in ['ARQ', 'DEF', 'VOL', 'DEL']" :key="c" class="chk">
          <input v-model="secondary_positions" type="checkbox" :value="c" />
          {{ c }}
        </label>
      </div>
    </fieldset>
    <div class="field">
      <label for="foot">Pierna hábil</label>
      <select id="foot" v-model="foot">
        <option value="">—</option>
        <option value="derecha">Derecha</option>
        <option value="izquierda">Izquierda</option>
        <option value="ambas">Ambas</option>
      </select>
    </div>
    <div class="field">
      <label for="st">Fortalezas</label>
      <textarea id="st" v-model="strengths" rows="2" />
    </div>
    <div class="field">
      <label for="wk">Debilidades</label>
      <textarea id="wk" v-model="weaknesses" rows="2" />
    </div>
    <div class="field">
      <label for="fit">Estado físico</label>
      <select id="fit" v-model="fitness_status">
        <option value="ok">OK</option>
        <option value="molestias">Molestias</option>
        <option value="lesionado">Lesionado</option>
      </select>
    </div>
    <div class="field">
      <label for="rate">Valoración (1–10)</label>
      <input id="rate" v-model.number="rating" type="number" min="1" max="10" step="0.1" />
    </div>
    <div class="field">
      <label for="sh">Número de camiseta</label>
      <input id="sh" v-model.number="shirt_number" type="number" min="0" max="99" />
    </div>
    <div v-if="isEdit" class="field row-field">
      <label class="check">
        <input v-model="archived" type="checkbox" />
        Jugador archivado (oculto en la lista principal)
      </label>
    </div>
    <p v-if="err" class="err">{{ err }}</p>
    <button type="submit" class="btn btn-primary full" :disabled="saving">
      {{ saving ? 'Guardando…' : 'Guardar' }}
    </button>
  </form>
</template>

<style scoped>
.form {
  max-width: 480px;
}

.full {
  width: 100%;
  margin-top: 0.25rem;
}

.row-field {
  margin-bottom: 0;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 0.9rem;
  color: var(--muted);
  cursor: pointer;
}

.check input {
  margin-top: 0.2rem;
}

.sec-pos {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  margin: 0;
}

.sec-pos legend {
  font-size: 0.85rem;
  padding: 0 0.35rem;
}

.hint {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  color: var(--muted);
}

.pos-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.chk {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  cursor: pointer;
}
</style>
