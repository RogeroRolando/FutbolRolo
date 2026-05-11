<script setup lang="ts">
import Konva from 'konva'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Json, PlayerRow } from '@/types/database'
import { initials, markerHexForPosition } from '@/lib/positions'
import {
  emptyBoard,
  parseBoard,
  type BoardMarker,
  type BoardStateV1,
} from '@/types/board'

const props = defineProps<{ id: string }>()
const route = useRoute()
const auth = useAuthStore()

const bid = computed(() => props.id || (route.params.id as string))

const containerEl = ref<HTMLDivElement | null>(null)
const boardName = ref('')
const tool = ref<'select' | 'player' | 'line' | 'arrow' | 'erase'>('select')
const zoom = ref(1)
const state = ref<BoardStateV1>(emptyBoard())
const history = ref<BoardStateV1[]>([])
const lineAwait = ref<{ x: number; y: number } | null>(null)

const loading = ref(true)
const saving = ref(false)
const err = ref('')

const roster = ref<PlayerRow[]>([])
const playerSearch = ref('')
/** null = elegí opción; 'generic' = ficha numerada; string = id de jugador */
const placementChoice = ref<null | 'generic' | string>(null)
const rosterErr = ref('')

const filteredRoster = computed(() => {
  const q = playerSearch.value.trim().toLowerCase()
  if (!q) return roster.value
  return roster.value.filter((p) => p.full_name.toLowerCase().includes(q))
})

const selectedPlayer = computed(() => {
  const id = placementChoice.value
  if (!id || id === 'generic') return null
  return roster.value.find((p) => p.id === id) ?? null
})

let stage: Konva.Stage | null = null
let layerBg: Konva.Layer | null = null
let layerDraw: Konva.Layer | null = null
let resizeObs: ResizeObserver | null = null
let fieldRect = { x: 0, y: 0, w: 0, h: 0 }
let benchRect = { x: 0, y: 0, w: 0, h: 0 }

function snapshot() {
  const copy = JSON.parse(JSON.stringify(state.value)) as BoardStateV1
  history.value.push(copy)
  if (history.value.length > 40) history.value.shift()
}

function undo() {
  const prev = history.value.pop()
  if (!prev) return
  state.value = prev
  redraw()
}

function uid() {
  return crypto.randomUUID()
}

function nextShirtNum() {
  const nums = state.value.markers.map((m) => m.num)
  return nums.length ? Math.max(...nums) + 1 : 1
}

function markerDisplayText(m: BoardMarker): string {
  if (m.label && String(m.label).trim()) return String(m.label).trim().slice(0, 2).toUpperCase()
  return String(m.num)
}

function markerLabelColor(fill: string): string {
  if (fill === '#ffffff' || fill === '#e4e4e7') return '#0a0a0a'
  return '#ffffff'
}

function setPlacement(v: null | 'generic' | string) {
  placementChoice.value = v
}

function onNativePick(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value
  if (v === '') setPlacement(null)
  else if (v === 'generic') setPlacement('generic')
  else setPlacement(v)
}

async function loadRoster() {
  rosterErr.value = ''
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('archived', false)
    .order('full_name')
  if (error) {
    rosterErr.value = error.message
    roster.value = []
    return
  }
  roster.value = data ?? []
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v))
}

function isInside(r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

function layoutBenchMarkers() {
  if (!stage) return
  const pad = 10
  const cell = 44
  const cols = Math.max(1, Math.floor((benchRect.w - pad * 2) / cell))
  let i = 0

  const nextPos = () => {
    const col = i % cols
    const row = Math.floor(i / cols)
    i++
    return {
      x: benchRect.x + pad + col * cell + 22,
      y: benchRect.y + pad + row * cell + 22,
    }
  }

  const next = state.value.markers.map((m) => {
    if (!m.player_id) return m
    const insideField = isInside(fieldRect, { x: m.x, y: m.y })
    const insideBench = isInside(benchRect, { x: m.x, y: m.y })
    if (insideField || insideBench) return m
    const p = nextPos()
    return { ...m, x: p.x, y: p.y }
  })
  state.value.markers = next
}

function ensureRosterTokens() {
  if (roster.value.length === 0) return
  const existing = new Set(state.value.markers.map((m) => m.player_id).filter(Boolean) as string[])
  const missing: BoardMarker[] = []

  for (const p of roster.value) {
    if (existing.has(p.id)) continue
    const lab = initials(p.full_name)
    const fill = markerHexForPosition(p.primary_position)
    const numVal =
      p.shirt_number != null && !Number.isNaN(Number(p.shirt_number))
        ? Number(p.shirt_number)
        : nextShirtNum()
    missing.push({
      id: uid(),
      x: 0,
      y: 0,
      num: numVal,
      fill,
      player_id: p.id,
      label: lab,
    })
  }

  if (missing.length === 0) return
  snapshot()
  state.value.markers = [...state.value.markers, ...missing]
  layoutBenchMarkers()
  redraw()
}

function redraw() {
  if (!layerDraw || !stage) return
  layerDraw.destroyChildren()

  const catcher = new Konva.Rect({
    x: fieldRect.x,
    y: fieldRect.y,
    width: Math.max(0, fieldRect.w),
    height: Math.max(0, fieldRect.h),
    fill: 'rgba(255,255,255,0.03)',
    listening: true,
    name: 'pitch-catcher',
  })
  layerDraw.add(catcher)

  // Banco (zona de fichas) — invisible, pero útil para hit tests futuros
  layerDraw.add(
    new Konva.Rect({
      x: benchRect.x,
      y: benchRect.y,
      width: benchRect.w,
      height: benchRect.h,
      fill: 'rgba(0,0,0,0.01)',
      listening: false,
      name: 'bench-zone',
    }),
  )

  for (const ln of state.value.lines) {
    const line = new Konva.Line({
      name: `line-${ln.id}`,
      points: ln.points,
      stroke: ln.stroke ?? '#ffffff',
      strokeWidth: 3,
      lineCap: 'round',
      lineJoin: 'round',
      listening: true,
    })
    layerDraw.add(line)
  }

  for (const ar of state.value.arrows) {
    const arrow = new Konva.Arrow({
      name: `arrow-${ar.id}`,
      points: ar.points,
      stroke: ar.stroke ?? '#fbbf24',
      fill: ar.stroke ?? '#fbbf24',
      strokeWidth: 3,
      pointerLength: 12,
      pointerWidth: 12,
      listening: true,
    })
    layerDraw.add(arrow)
  }

  for (const m of state.value.markers) {
    const g = new Konva.Group({
      x: m.x,
      y: m.y,
      name: `marker-${m.id}`,
      draggable: auth.isAdmin && tool.value === 'select',
    })
    const circle = new Konva.Circle({
      name: `hit-marker-${m.id}`,
      radius: 18,
      fill: m.fill,
      stroke: '#0a0a0a',
      strokeWidth: 2,
      listening: true,
      hitStrokeWidth: 28,
    })
    const disp = markerDisplayText(m)
    const fontSize = /^[0-9]{1,2}$/.test(disp) ? (disp.length === 1 ? 14 : 11) : 11
    const text = new Konva.Text({
      text: disp,
      fontSize,
      fontStyle: 'bold',
      fill: markerLabelColor(m.fill),
      align: 'center',
      verticalAlign: 'middle',
      width: 36,
      height: 36,
      offsetX: 18,
      offsetY: 18,
      listening: false,
    })
    g.add(circle)
    g.add(text)

    g.on('dragend', () => {
      if (!auth.isAdmin) return
      const xRaw = g.x()
      const yRaw = g.y()
      const inBench = isInside(benchRect, { x: xRaw, y: yRaw })
      const inField = isInside(fieldRect, { x: xRaw, y: yRaw })
      const x = inBench
        ? clamp(xRaw, benchRect.x + 18, benchRect.x + benchRect.w - 18)
        : clamp(xRaw, fieldRect.x + 18, fieldRect.x + fieldRect.w - 18)
      const y = inBench
        ? clamp(yRaw, benchRect.y + 18, benchRect.y + benchRect.h - 18)
        : clamp(yRaw, fieldRect.y + 18, fieldRect.y + fieldRect.h - 18)
      snapshot()
      state.value.markers = state.value.markers.map((mk) =>
        mk.id === m.id ? { ...mk, x, y } : mk,
      )
      // Si soltó fuera de ambas zonas, lo metemos en cancha por defecto
      if (!inBench && !inField) {
        layoutBenchMarkers()
      }
      redraw()
    })

    layerDraw.add(g)
  }

  layerDraw.batchDraw()
}

function measureWidth(el: HTMLElement) {
  const rw = Math.floor(el.getBoundingClientRect().width)
  const cw = el.clientWidth
  const fallback = typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 720) : 320
  return Math.max(280, cw || rw || fallback)
}

function fitStage() {
  const el = containerEl.value
  if (!el || !stage) return
  const w = measureWidth(el)
  const h = Math.min(Math.max(460, window.innerHeight * 0.62), w * 1.55)
  stage.width(w)
  stage.height(h)
  if (!layerBg) return
  layerBg.destroyChildren()

  const pad = 10
  const fx = pad
  const fy = pad
  const fw = w - pad * 2
  const fh = h - pad * 2
  const benchH = clamp(Math.round(fh * 0.22), 120, 170)
  const gap = 10
  const fieldH = Math.max(220, fh - benchH - gap)
  fieldRect = { x: fx, y: fy, w: fw, h: fieldH }
  benchRect = { x: fx, y: fy + fieldH + gap, w: fw, h: Math.max(90, fh - fieldH - gap) }

  const lineCol = 'rgba(255,255,255,0.72)'
  const lineSoft = 'rgba(255,255,255,0.55)'
  const lineW = 2

  const field = new Konva.Rect({
    x: fieldRect.x,
    y: fieldRect.y,
    width: fieldRect.w,
    height: fieldRect.h,
    fill: '#14532d',
    stroke: 'rgba(255,255,255,0.88)',
    strokeWidth: 2,
    cornerRadius: 10,
    listening: false,
  })
  layerBg.add(field)

  // Fútbol 9 — proporciones orientativas (arcos a izquierda y derecha, línea medial vertical)
  const penDepth = fieldRect.w * 0.16
  const penHeight = fieldRect.h * 0.56
  const penY = fieldRect.y + (fieldRect.h - penHeight) / 2
  const goalDepth = fieldRect.w * 0.048
  const goalHeight = fieldRect.h * 0.24
  const goalY = fieldRect.y + (fieldRect.h - goalHeight) / 2
  const goalMouthW = fieldRect.w * 0.028
  const goalMouthH = fieldRect.h * 0.16
  const goalMouthY = fieldRect.y + (fieldRect.h - goalMouthH) / 2

  // Porterías (boca de gol oscura)
  layerBg.add(
    new Konva.Rect({
      x: fieldRect.x,
      y: goalMouthY,
      width: goalMouthW,
      height: goalMouthH,
      fill: 'rgba(15, 23, 42, 0.55)',
      stroke: 'rgba(255,255,255,0.5)',
      strokeWidth: 1,
      listening: false,
    }),
  )
  layerBg.add(
    new Konva.Rect({
      x: fieldRect.x + fieldRect.w - goalMouthW,
      y: goalMouthY,
      width: goalMouthW,
      height: goalMouthH,
      fill: 'rgba(15, 23, 42, 0.55)',
      stroke: 'rgba(255,255,255,0.5)',
      strokeWidth: 1,
      listening: false,
    }),
  )

  // Área chica (meta)
  layerBg.add(
    new Konva.Rect({
      x: fieldRect.x,
      y: goalY,
      width: goalDepth,
      height: goalHeight,
      stroke: lineCol,
      strokeWidth: lineW,
      listening: false,
    }),
  )
  layerBg.add(
    new Konva.Rect({
      x: fieldRect.x + fieldRect.w - goalDepth,
      y: goalY,
      width: goalDepth,
      height: goalHeight,
      stroke: lineCol,
      strokeWidth: lineW,
      listening: false,
    }),
  )

  // Área grande (penalti)
  layerBg.add(
    new Konva.Rect({
      x: fieldRect.x,
      y: penY,
      width: penDepth,
      height: penHeight,
      stroke: lineCol,
      strokeWidth: lineW,
      listening: false,
    }),
  )
  layerBg.add(
    new Konva.Rect({
      x: fieldRect.x + fieldRect.w - penDepth,
      y: penY,
      width: penDepth,
      height: penHeight,
      stroke: lineCol,
      strokeWidth: lineW,
      listening: false,
    }),
  )

  // Punto de penalti
  const spotR = Math.max(2.5, Math.min(fieldRect.w, fieldRect.h) * 0.012)
  const spotOff = penDepth * 0.72
  layerBg.add(
    new Konva.Circle({
      x: fieldRect.x + spotOff,
      y: fieldRect.y + fieldRect.h / 2,
      radius: spotR,
      fill: lineCol,
      listening: false,
    }),
  )
  layerBg.add(
    new Konva.Circle({
      x: fieldRect.x + fieldRect.w - spotOff,
      y: fieldRect.y + fieldRect.h / 2,
      radius: spotR,
      fill: lineCol,
      listening: false,
    }),
  )

  // Línea medial + círculo central
  const mid = new Konva.Line({
    points: [
      fieldRect.x + fieldRect.w / 2,
      fieldRect.y,
      fieldRect.x + fieldRect.w / 2,
      fieldRect.y + fieldRect.h,
    ],
    stroke: lineCol,
    strokeWidth: lineW,
    listening: false,
  })
  layerBg.add(mid)

  const circle = new Konva.Ellipse({
    x: fieldRect.x + fieldRect.w / 2,
    y: fieldRect.y + fieldRect.h / 2,
    radiusX: Math.min(fieldRect.w, fieldRect.h) * 0.14,
    radiusY: Math.min(fieldRect.w, fieldRect.h) * 0.14,
    stroke: lineSoft,
    strokeWidth: lineW,
    listening: false,
  })
  layerBg.add(circle)

  // Banco (zona inferior)
  layerBg.add(
    new Konva.Rect({
      x: benchRect.x,
      y: benchRect.y,
      width: benchRect.w,
      height: benchRect.h,
      fill: '#0a0a0a',
      stroke: 'rgba(255,255,255,0.14)',
      strokeWidth: 1,
      cornerRadius: 10,
      listening: false,
    }),
  )
  layerBg.add(
    new Konva.Text({
      x: benchRect.x + 12,
      y: benchRect.y + 10,
      text: 'Banco (arrastrá fichas a la cancha)',
      fontSize: 12,
      fill: 'rgba(255,255,255,0.55)',
      listening: false,
    }),
  )

  layerBg.batchDraw()
  layoutBenchMarkers()
  redraw()
}

/** Coordenadas en el espacio del Stage (respeta zoom/posición). Necesario en móvil donde getRelativePointerPosition falla. */
function resolvePointer(
  e: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>,
): { x: number; y: number } | null {
  if (!stage) return null
  try {
    stage.setPointersPositions(e)
  } catch {
    /* Konva viejo / edge */
  }
  const rel = stage.getRelativePointerPosition()
  if (rel && Number.isFinite(rel.x) && Number.isFinite(rel.y)) {
    return { x: rel.x, y: rel.y }
  }

  const evt = e.evt
  const rect = stage.container().getBoundingClientRect()
  const scaleX = stage.scaleX() || 1
  const scaleY = stage.scaleY() || 1
  const posSt = stage.position()
  let cx = 0
  let cy = 0
  if (typeof TouchEvent !== 'undefined' && evt instanceof TouchEvent) {
    const t = evt.touches[0] ?? evt.changedTouches[0]
    if (!t) return null
    cx = t.clientX
    cy = t.clientY
  } else if ('clientX' in evt) {
    cx = (evt as MouseEvent).clientX
    cy = (evt as MouseEvent).clientY
  } else {
    return null
  }
  const x = (cx - rect.left - posSt.x) / scaleX
  const y = (cy - rect.top - posSt.y) / scaleY
  return { x, y }
}

let lastPointerDedup = { t: 0, x: 0, y: 0, tool: '' }

function shouldDedupPointer(pos: { x: number; y: number }, tname: string): boolean {
  const now = Date.now()
  const rx = Math.round(pos.x / 4) * 4
  const ry = Math.round(pos.y / 4) * 4
  if (
    now - lastPointerDedup.t < 70 &&
    lastPointerDedup.tool === tname &&
    lastPointerDedup.x === rx &&
    lastPointerDedup.y === ry
  ) {
    return true
  }
  lastPointerDedup = { t: now, x: rx, y: ry, tool: tname }
  return false
}

function pickNameTarget(target: Konva.Node | null): string | null {
  let n: Konva.Node | null = target
  while (n) {
    const nm = n.name()
    if (nm.startsWith('hit-marker-')) {
      return `marker-${nm.slice('hit-marker-'.length)}`
    }
    if (
      nm.startsWith('marker-') ||
      nm.startsWith('line-') ||
      nm.startsWith('arrow-')
    ) {
      return nm
    }
    n = n.getParent()
  }
  return null
}

function markerTitle(m: BoardMarker): string {
  if (m.player_id) {
    const pl = roster.value.find((r) => r.id === m.player_id)
    return pl?.full_name ?? m.label ?? 'Jugador'
  }
  return `Genérico #${m.num}`
}

function removeMarker(markerId: string) {
  if (!auth.isAdmin) return
  snapshot()
  state.value.markers = state.value.markers.filter((m) => m.id !== markerId)
  redraw()
}

function removeByKindName(fullName: string) {
  if (fullName.startsWith('marker-')) {
    const id = fullName.replace('marker-', '')
    state.value.markers = state.value.markers.filter((m) => m.id !== id)
  } else if (fullName.startsWith('line-')) {
    const id = fullName.replace('line-', '')
    state.value.lines = state.value.lines.filter((l) => l.id !== id)
  } else if (fullName.startsWith('arrow-')) {
    const id = fullName.replace('arrow-', '')
    state.value.arrows = state.value.arrows.filter((a) => a.id !== id)
  }
}

function onStageDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) {
  if (!auth.isAdmin || !stage) return
  const pos = resolvePointer(e)
  if (!pos) return

  if (tool.value !== 'erase' && shouldDedupPointer(pos, tool.value)) return

  if (tool.value === 'player') {
    // Herramienta: ficha genérica (solo número) al tocar la cancha
    if (!isInside(fieldRect, pos)) return
    const n = nextShirtNum()
    const m: BoardMarker = {
      id: uid(),
      x: pos.x,
      y: pos.y,
      num: n,
      fill: n === 1 ? '#3b82f6' : '#ffffff',
      player_id: null,
      label: null,
    }
    snapshot()
    state.value.markers = [...state.value.markers, m]
    redraw()
    return
  }

  if (tool.value === 'line' || tool.value === 'arrow') {
    if (!lineAwait.value) {
      lineAwait.value = { x: pos.x, y: pos.y }
      return
    }
    const a = lineAwait.value
    const b = pos
    lineAwait.value = null
    snapshot()
    const id = uid()
    const pts = [a.x, a.y, b.x, b.y]
    if (tool.value === 'line') {
      state.value.lines.push({ id, points: pts, stroke: '#ffffff' })
    } else {
      state.value.arrows.push({ id, points: pts, stroke: '#fbbf24' })
    }
    redraw()
    return
  }

  if (tool.value === 'erase') {
    try {
      stage.setPointersPositions(e)
    } catch {
      /* */
    }
    const posAbs = stage.getPointerPosition()
    const hit = posAbs ? stage.getIntersection(posAbs) : null
    const nm = pickNameTarget(hit)
    if (!nm) return
    snapshot()
    removeByKindName(nm)
    redraw()
  }
}

function destroyKonva() {
  resizeObs?.disconnect()
  resizeObs = null
  stage?.destroy()
  stage = null
  layerBg = null
  layerDraw = null
}

function initKonva() {
  destroyKonva()
  const el = containerEl.value
  if (!el) return

  const w0 = Math.max(measureWidth(el), 280)
  stage = new Konva.Stage({
    container: el,
    width: w0,
    height: Math.min(Math.max(360, window.innerHeight * 0.52), w0 * 1.45),
  })
  layerBg = new Konva.Layer()
  layerDraw = new Konva.Layer()
  stage.add(layerBg)
  stage.add(layerDraw)

  const down = (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => {
    onStageDown(ev)
  }
  stage.off('mousedown touchstart pointerdown')
  stage.on('mousedown', down)
  stage.on('touchstart', down)
  stage.on('pointerdown', down)

  resizeObs = new ResizeObserver(() => {
    fitStage()
  })
  resizeObs.observe(el)

  fitStage()
}

async function loadBoard() {
  loading.value = true
  err.value = ''
  const { data, error } = await supabase
    .from('tactical_boards')
    .select('*')
    .eq('id', bid.value)
    .single()
  loading.value = false
  if (error || !data) {
    err.value = error?.message ?? 'No encontrado'
    return
  }
  boardName.value = data.name
  state.value = parseBoard(data.konva_json)
  history.value = []
  await nextTick()
  initKonva()
  requestAnimationFrame(() => {
    fitStage()
    stage?.batchDraw()
    ensureRosterTokens()
  })
}

async function save() {
  if (!auth.isAdmin) return
  saving.value = true
  err.value = ''
  const { error } = await supabase
    .from('tactical_boards')
    .update({
      name: boardName.value.trim() || 'Diagrama',
      konva_json: state.value as unknown as Json,
      schema_version: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bid.value)
  saving.value = false
  if (error) err.value = error.message
}

onMounted(() => {
  void loadRoster()
  void loadBoard()
})

onBeforeUnmount(() => {
  destroyKonva()
})

watch(zoom, (z) => {
  if (!stage) return
  stage.scale({ x: z, y: z })
  stage.position({ x: 0, y: 0 })
  stage.batchDraw()
})

watch(tool, (v) => {
  lineAwait.value = null
  if (v === 'player') placementChoice.value = null
  redraw()
})

watch(
  () => bid.value,
  () => {
    void loadBoard()
  },
)
</script>

<template>
  <div class="editor">
    <p v-if="loading" class="muted">Cargando pizarra…</p>
    <template v-else-if="!err">
      <div class="row-name">
        <input v-model="boardName" class="name-inp" type="text" :disabled="!auth.isAdmin" />
        <button v-if="auth.isAdmin" type="button" class="btn btn-primary" :disabled="saving" @click="save">
          Guardar
        </button>
      </div>

      <div v-if="auth.isAdmin" class="tools" aria-label="Herramientas">
        <button type="button" class="tbtn" :class="{ on: tool === 'select' }" @click="tool = 'select'">Selección</button>
        <button type="button" class="tbtn" :class="{ on: tool === 'player' }" @click="tool = 'player'">Genérico</button>
        <button type="button" class="tbtn" :class="{ on: tool === 'line' }" @click="tool = 'line'">Línea</button>
        <button type="button" class="tbtn" :class="{ on: tool === 'arrow' }" @click="tool = 'arrow'">Flecha</button>
        <button type="button" class="tbtn" :class="{ on: tool === 'erase' }" @click="tool = 'erase'">Borrar</button>
        <button type="button" class="tbtn" @click="undo">Deshacer</button>
      </div>
      <p v-if="auth.isAdmin && tool === 'erase'" class="erase-hint">
        Tocá una ficha, línea o flecha en el campo para borrarla.
      </p>
      <p v-else-if="!auth.isAdmin" class="muted">Solo lectura</p>

      <div v-if="auth.isAdmin && tool === 'player'" class="player-panel">
        <p class="panel-hint">
          Herramienta <strong>Genérico</strong>: tocá dentro de la cancha para crear una ficha numérica.
          Los jugadores del plantel ya están en el <strong>Banco</strong> (arrastrá y soltá).
        </p>
      </div>

      <div ref="containerEl" class="stage-wrap" />

      <div v-if="auth.isAdmin && state.markers.length > 0" class="chips-panel card">
        <h3 class="chips-title">Fichas en la cancha</h3>
        <p class="muted sm chips-sub">Podés quitar desde acá o con la herramienta <strong>Borrar</strong>.</p>
        <ul class="chips-list">
          <li v-for="m in state.markers" :key="m.id" class="chip-row">
            <span class="chip-name">{{ markerTitle(m) }}</span>
            <span class="chip-meta">{{ m.label || '—' }} · #{{ m.num }}</span>
            <button type="button" class="btn chip-remove" @click="removeMarker(m.id)">Quitar</button>
          </li>
        </ul>
      </div>

      <div class="zoom">
        <button type="button" class="btn" @click="zoom = Math.max(0.6, Math.round((zoom - 0.1) * 10) / 10)">−</button>
        <span>{{ Math.round(zoom * 100) }}%</span>
        <button type="button" class="btn" @click="zoom = Math.min(1.5, Math.round((zoom + 0.1) * 10) / 10)">+</button>
      </div>
    </template>
    <p v-else class="err">{{ err }}</p>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0 -0.75rem;
}

.row-name {
  display: flex;
  gap: 0.5rem;
  padding: 0 0.75rem;
  align-items: center;
}

.name-inp {
  flex: 1;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0 0.75rem;
}

.tbtn {
  padding: 0.4rem 0.55rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.78rem;
}

.tbtn.on {
  border-color: var(--accent);
  color: var(--accent);
}

.stage-wrap {
  width: 100%;
  min-width: 0;
  min-height: min(420px, 55dvh);
  touch-action: none;
  background: #050505;
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow: hidden;
}

.zoom {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.25rem 0.75rem 0.75rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.player-panel {
  margin: 0 0.75rem 0.5rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius, 12px);
  border: 1px solid var(--border);
  background: var(--surface);
  max-height: 18vh;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.panel-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
}

.pick {
  width: 100%;
  text-align: left;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
}

.pick.on {
  border-color: var(--accent);
  color: var(--accent);
}

.search {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #0a0a0a;
  color: var(--text);
}

.roster {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  flex: 1;
  min-height: 0;
  max-height: 28vh;
}

.pbtn {
  width: 100%;
  text-align: left;
  padding: 0.45rem 0.5rem;
  margin-bottom: 0.25rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--surface-2);
  color: var(--text);
}

.pbtn.on {
  border-color: var(--accent);
  color: var(--accent);
}

.pname {
  display: block;
  font-weight: 600;
  font-size: 0.88rem;
}

.meta {
  display: block;
  font-size: 0.72rem;
  color: var(--muted);
}

.sm {
  font-size: 0.78rem;
  margin: 0;
}

.warn {
  color: #fcd34d;
}

.ok {
  color: #86efac;
}

.erase-hint {
  margin: 0 0.75rem 0.35rem;
  font-size: 0.8rem;
  color: #fcd34d;
}

.chips-panel {
  margin: 0 0.75rem 0.5rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.chips-title {
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
}

.chips-sub {
  margin: 0 0 0.5rem;
  line-height: 1.35;
}

.chips-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 28vh;
  overflow: auto;
}

.chip-row {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 0.15rem 0.5rem;
  align-items: center;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--border);
}

.chip-row:last-child {
  border-bottom: none;
}

.chip-name {
  font-weight: 600;
  font-size: 0.88rem;
  grid-column: 1;
  grid-row: 1;
}

.chip-meta {
  font-size: 0.72rem;
  color: var(--muted);
  grid-column: 1;
  grid-row: 2;
}

.chip-remove {
  grid-column: 2;
  grid-row: 1 / span 2;
  padding: 0.35rem 0.55rem;
  font-size: 0.78rem;
  border-radius: 8px;
  border: 1px solid var(--danger);
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.12);
}
</style>
