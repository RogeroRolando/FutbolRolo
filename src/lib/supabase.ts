import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Limpia valores típicos mal pegados en Vercel (espacios, comillas). */
function envStr(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '')
}

/** Acepta `https://xxx.supabase.co` o solo `xxx.supabase.co`. */
function normalizeSupabaseUrl(raw: unknown): string {
  let s = envStr(raw)
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.origin
  } catch {
    return ''
  }
}

const resolvedUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const resolvedKey = envStr(import.meta.env.VITE_SUPABASE_ANON_KEY)

export function isSupabaseConfigured(): boolean {
  return Boolean(resolvedUrl && resolvedKey)
}

function buildClient(): SupabaseClient {
  if (!resolvedUrl || !resolvedKey) {
    throw new Error(
      'Faltan o son inválidas VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. En Vercel: Project → Settings → Environment Variables. La URL debe ser https://TU_REF.supabase.co (sin espacios ni comillas). Luego Redeploy.',
    )
  }
  return createClient(resolvedUrl, resolvedKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) _client = buildClient()
  return _client
}

/**
 * Cliente Supabase con creación diferida: evita que un import rompa toda la app
 * si la URL/key vinieron mal en el build (pantalla clavada en "Cargando…").
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const c = getClient()
    const v = Reflect.get(c as object, prop, receiver)
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v
  },
})
