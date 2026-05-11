export const POSITIONS = ['ARQ', 'DEF', 'VOL', 'DEL', 'OTRO'] as const
export type PositionCode = (typeof POSITIONS)[number]

export function positionLabel(code: string): string {
  switch (code) {
    case 'ARQ':
      return 'Arquero'
    case 'DEF':
      return 'Defensa'
    case 'VOL':
      return 'Mediocampo'
    case 'DEL':
      return 'Delantero'
    default:
      return 'Otro'
  }
}

export function positionVar(code: string): string {
  switch (code) {
    case 'ARQ':
      return 'var(--arq)'
    case 'DEF':
      return 'var(--def)'
    case 'VOL':
      return 'var(--vol)'
    case 'DEL':
      return 'var(--del)'
    default:
      return 'var(--muted)'
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Color de ficha en canvas (Konva), alineado a PositionBadge */
export function markerHexForPosition(code: string): string {
  switch (code) {
    case 'ARQ':
      return '#3b82f6'
    case 'DEF':
      return '#22c55e'
    case 'VOL':
      return '#f97316'
    case 'DEL':
      return '#ef4444'
    default:
      return '#e4e4e7'
  }
}
