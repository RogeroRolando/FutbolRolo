<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const name = ref('')
const mode = ref<'login' | 'register'>('login')
const error = ref('')
const pending = ref(false)

function safeRedirectPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/jugadores'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/jugadores'
  return raw
}

async function submit() {
  error.value = ''
  pending.value = true
  try {
    if (mode.value === 'register') {
      await auth.signUp(email.value.trim(), password.value, name.value.trim() || 'Usuario')
    } else {
      await auth.signIn(email.value.trim(), password.value)
    }
    const redir = safeRedirectPath(route.query.redirect)
    await router.replace(redir)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error de autenticación'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="logo">Rolo Futbol</div>
    <p class="muted">
      Ingresá con tu cuenta. Los nuevos usuarios quedan como
      <strong>lectura</strong>; un administrador debe otorgar permisos en Supabase.
    </p>

    <form class="card form" @submit.prevent="submit">
      <div v-if="mode === 'register'" class="field">
        <label for="name">Nombre</label>
        <input id="name" v-model="name" type="text" autocomplete="name" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required autocomplete="email" />
      </div>
      <div class="field">
        <label for="pass">Contraseña</label>
        <input id="pass" v-model="password" type="password" required autocomplete="current-password" />
      </div>
      <p v-if="error" class="err">{{ error }}</p>
      <button type="submit" class="btn btn-primary full" :disabled="pending">
        {{ mode === 'login' ? 'Entrar' : 'Registrarse' }}
      </button>
      <button type="button" class="btn full subtle" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  padding: 2rem 1.25rem;
  max-width: 420px;
  margin: 0 auto;
}

.logo {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
  text-align: center;
  color: var(--accent);
}

.form {
  margin-top: 1.25rem;
}

.full {
  width: 100%;
}

.subtle {
  margin-top: 0.5rem;
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
