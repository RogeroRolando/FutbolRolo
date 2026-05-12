export interface BoardMarker {
  id: string
  x: number
  y: number
  num: number
  fill: string
  /** Si viene de la plantilla */
  player_id?: string | null
  /** Iniciales en la ficha (ej. "LV") */
  label?: string | null
}

export interface BoardLine {
  id: string
  points: number[]
  stroke?: string
}

export interface BoardArrow extends BoardLine {}

export interface BoardLayoutRef {
  field: { x: number; y: number; w: number; h: number }
  bench: { x: number; y: number; w: number; h: number }
}

export interface BoardStateV1 {
  schema_version: 1
  markers: BoardMarker[]
  lines: BoardLine[]
  arrows: BoardArrow[]
  /** Rectángulos de cancha/banco al guardar (remapa entre PC y móvil) */
  layout_ref?: BoardLayoutRef
}

export type BoardState = BoardStateV1

export function emptyBoard(): BoardStateV1 {
  return {
    schema_version: 1,
    markers: [],
    lines: [],
    arrows: [],
  }
}

function parseLayoutRef(raw: unknown): BoardLayoutRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const f = o.field as Record<string, unknown> | undefined
  const b = o.bench as Record<string, unknown> | undefined
  if (!f || !b) return undefined
  const field = {
    x: Number(f.x) || 0,
    y: Number(f.y) || 0,
    w: Number(f.w) || 0,
    h: Number(f.h) || 0,
  }
  const bench = {
    x: Number(b.x) || 0,
    y: Number(b.y) || 0,
    w: Number(b.w) || 0,
    h: Number(b.h) || 0,
  }
  if (field.w <= 0 || field.h <= 0 || bench.w <= 0 || bench.h <= 0) return undefined
  return { field, bench }
}

export function parseBoard(json: unknown): BoardStateV1 {
  if (!json || typeof json !== 'object') return emptyBoard()
  const o = json as Record<string, unknown>
  if (o.schema_version !== 1) return emptyBoard()
  const rawMarkers = Array.isArray(o.markers) ? (o.markers as Partial<BoardMarker>[]) : []
  const markers: BoardMarker[] = rawMarkers.map((m) => ({
    id:
      typeof m.id === 'string' && m.id.length > 0
        ? m.id
        : typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
          ? globalThis.crypto.randomUUID()
          : `m-${Math.random().toString(36).slice(2)}`,
    x: Number(m.x) || 0,
    y: Number(m.y) || 0,
    num: typeof m.num === 'number' ? m.num : Number(m.num) || 1,
    fill: typeof m.fill === 'string' ? m.fill : '#ffffff',
    player_id: m.player_id ?? null,
    label: m.label ?? null,
  }))

  return {
    schema_version: 1,
    markers,
    lines: Array.isArray(o.lines) ? (o.lines as BoardLine[]) : [],
    arrows: Array.isArray(o.arrows) ? (o.arrows as BoardArrow[]) : [],
    layout_ref: parseLayoutRef(o.layout_ref),
  }
}
