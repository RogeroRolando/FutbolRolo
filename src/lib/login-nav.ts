/** Navegación completa al login (misma pestaña). Evita quedar en rutas protegidas con sesión ya cerrada. */
export function goToLoginPage(redirect?: string) {
  if (typeof window === 'undefined') return
  const path = redirect?.trim()
  const q =
    path && path !== '/login' && !path.startsWith('/login?')
      ? `?redirect=${encodeURIComponent(path)}`
      : ''
  const base = import.meta.env.BASE_URL || '/'
  const root = base === '/' ? '' : base.replace(/\/$/, '')
  const loginPath = `${root}/login`.replace(/\/+/g, '/')
  window.location.assign(loginPath + q)
}
