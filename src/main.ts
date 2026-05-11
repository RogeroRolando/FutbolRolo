import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './assets/main.css'

function showBootError(message: string) {
  const el = document.getElementById('app')
  if (!el) return
  el.innerHTML = `
    <div style="padding:1.25rem;font-family:system-ui,sans-serif;background:#0a0a0a;color:#fecaca;min-height:100dvh;">
      <p style="margin:0 0 .75rem;font-weight:700;">No se pudo iniciar la app</p>
      <p style="margin:0 0 .75rem;color:#e4e4e7;font-size:.95rem;">${message}</p>
      <p style="margin:0;color:#a1a1aa;font-size:.85rem;">
        Si estás en Vercel: Settings → Environment Variables → <code style="color:#86efac;">VITE_SUPABASE_URL</code> y
        <code style="color:#86efac;">VITE_SUPABASE_ANON_KEY</code>, luego <strong>Redeploy</strong>.
      </p>
    </div>`
}

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  showBootError(
    'Faltan variables de entorno en el build (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
  )
} else {
  try {
    const auth = useAuthStore()
    await auth.init()
    app.use(router)
    app.mount('#app')
  } catch (e) {
    console.error(e)
    showBootError(e instanceof Error ? e.message : 'Error desconocido al arrancar.')
  }
}
