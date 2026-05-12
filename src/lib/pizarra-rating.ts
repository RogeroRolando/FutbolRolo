import type { PositionCode } from '@/lib/positions'

export type InferredRole = PositionCode

export type FieldRect = { x: number; y: number; w: number; h: number }

/** Convierte rating 1–10 de la DB a OVR estilo FIFA (~47–99) */
export function ratingToOvr(rating: number | null | undefined): number {
  const r = rating != null && !Number.isNaN(Number(rating)) ? Number(rating) : 5.5
  const clamped = Math.min(10, Math.max(1, r))
  return Math.round(47 + ((clamped - 1) * 52) / 9)
}

export function isInsideField(field: FieldRect, x: number, y: number): boolean {
  return x >= field.x && x <= field.x + field.w && y >= field.y && y <= field.y + field.h
}

/**
 * Rol inferido por posición en cancha (ataque hacia la derecha; arcos en ambos extremos).
 */
export function inferRoleFromBoardPosition(x: number, y: number, field: FieldRect): InferredRole {
  if (!field.w || !field.h) return 'OTRO'
  const cx = x
  const cy = y
  if (cx < field.x || cx > field.x + field.w || cy < field.y || cy > field.y + field.h) return 'OTRO'
  const t = (cx - field.x) / field.w
  if (t < 0.2 || t > 0.8) return 'ARQ'
  if (t < 0.45) return 'DEF'
  if (t < 0.58) return 'VOL'
  return 'DEL'
}

export function tokenizeStrengths(s: string | null | undefined): Set<string> {
  if (!s) return new Set()
  return new Set(
    s
      .split(/[,;\n]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isRoloPlayer(fullName: string): boolean {
  return fullName.trim().toLowerCase().includes('rolo')
}

export interface PlayerBoardRatingBreakdown {
  playerId: string
  name: string
  baseOvr: number
  naturalBonus: number
  secondaryBonus: number
  linkBonus: number
  roloFloorApplied: number
  totalOvr: number
  inferredRole: InferredRole
}

export interface TeamBoardRatingResult {
  /** Media OVR de fichas del plantel en cancha (sin genéricos) */
  squadOvr: number
  /** 0–100 estilo química FIFA */
  chemistry: number
  players: PlayerBoardRatingBreakdown[]
}

export type RosterPlayer = {
  id: string
  full_name: string
  primary_position: string
  secondary_positions?: string[] | null
  rating: number | null
  strengths: string | null
}

type CoreRole = Exclude<InferredRole, 'OTRO'>

function normPos(code: string): InferredRole {
  if (code === 'ARQ' || code === 'DEF' || code === 'VOL' || code === 'DEL') return code
  return 'OTRO'
}

/**
 * Calcula valoración del once en cancha + química.
 */
export function computeTeamBoardRating(
  markers: { x: number; y: number; player_id?: string | null }[],
  roster: RosterPlayer[],
  field: FieldRect,
): TeamBoardRatingResult {
  const rosterById = new Map(roster.map((p) => [p.id, p]))
  const onField = markers.filter(
    (m) => m.player_id && isInsideField(field, m.x, m.y) && rosterById.has(m.player_id),
  ) as { x: number; y: number; player_id: string }[]

  if (onField.length === 0) {
    return { squadOvr: 0, chemistry: 0, players: [] }
  }

  const inferredList = onField.map((m) => ({
    m,
    inferred: inferRoleFromBoardPosition(m.x, m.y, field),
    p: rosterById.get(m.player_id)!,
  }))

  const linkBonusById = new Map<string, number>()
  for (let i = 0; i < inferredList.length; i++) {
    for (let j = i + 1; j < inferredList.length; j++) {
      const a = inferredList[i]!.p
      const b = inferredList[j]!.p
      const sa = tokenizeStrengths(a.strengths)
      const sb = tokenizeStrengths(b.strengths)
      let shared = 0
      for (const t of sa) {
        if (sb.has(t)) shared++
      }
      const pairBonus = Math.min(4, shared * 2)
      if (pairBonus <= 0) continue
      const each = Math.ceil(pairBonus / 2)
      linkBonusById.set(a.id, (linkBonusById.get(a.id) ?? 0) + each)
      linkBonusById.set(b.id, (linkBonusById.get(b.id) ?? 0) + each)
    }
  }

  let naturalCount = 0
  let secondaryCount = 0
  const players: PlayerBoardRatingBreakdown[] = []

  for (const { m, inferred, p } of inferredList) {
    const primary = normPos(p.primary_position)
    const secondaries = (p.secondary_positions ?? [])
      .map(normPos)
      .filter((c): c is CoreRole => c !== 'OTRO')

    const baseOvr = ratingToOvr(p.rating)

    let naturalBonus = 0
    let secondaryBonus = 0
    if (primary !== 'OTRO' && inferred === primary) {
      naturalBonus = 5
      naturalCount++
    } else if (inferred !== 'OTRO' && secondaries.length && secondaries.includes(inferred)) {
      secondaryBonus = 2
      secondaryCount++
    }

    let linkBonus = Math.min(8, linkBonusById.get(p.id) ?? 0)

    let extras = naturalBonus + secondaryBonus + linkBonus
    let roloFloorApplied = 0
    if (isRoloPlayer(p.full_name)) {
      const floor = inferred === 'ARQ' ? 2 : 3
      if (extras < floor) {
        roloFloorApplied = floor - extras
        extras = floor
      }
    }

    const totalOvr = Math.min(99, baseOvr + extras)

    players.push({
      playerId: p.id,
      name: p.full_name,
      baseOvr,
      naturalBonus,
      secondaryBonus,
      linkBonus,
      roloFloorApplied,
      totalOvr,
      inferredRole: inferred,
    })
  }

  const squadOvr = Math.round(players.reduce((s, x) => s + x.totalOvr, 0) / players.length)

  const n = players.length
  const totalLink = players.reduce((s, p) => s + p.linkBonus, 0)
  const chemistry = Math.min(
    100,
    Math.round(22 + (naturalCount / n) * 42 + (secondaryCount / n) * 16 + Math.min(20, totalLink * 1.5)),
  )

  return { squadOvr, chemistry, players }
}
