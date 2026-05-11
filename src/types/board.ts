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

export interface BoardStateV1 {
  schema_version: 1
  markers: BoardMarker[]
  lines: BoardLine[]
  arrows: BoardArrow[]
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
  }
}
