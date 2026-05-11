import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const displayName = ref<string | null>(null)
  const role = ref<'admin' | 'viewer' | null>(null)
  const loading = ref(true)

  const isAdmin = computed(() => role.value === 'admin')

  async function refreshProfile() {
    const u = user.value
    if (!u) {
      displayName.value = null
      role.value = null
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', u.id)
      .maybeSingle()
    if (error) {
      console.error(error)
      role.value = 'viewer'
      return
    }
    displayName.value = data?.display_name ?? null
    role.value = (data?.role as 'admin' | 'viewer') ?? 'viewer'
  }

  let listenerRegistered = false
  let initPromise: Promise<void> | null = null

  function init(): Promise<void> {
    if (initPromise) return initPromise
    initPromise = (async () => {
      loading.value = true
      try {
        const { data } = await supabase.auth.getSession()
        user.value = data.session?.user ?? null
        await refreshProfile()

        if (!listenerRegistered) {
          listenerRegistered = true
          supabase.auth.onAuthStateChange(async (_evt, session) => {
            user.value = session?.user ?? null
            await refreshProfile()
          })
        }
      } catch (e) {
        console.error('[Rolo Futbol] Error al iniciar sesión de Supabase:', e)
        user.value = null
        displayName.value = null
        role.value = null
      } finally {
        loading.value = false
      }
    })()
    return initPromise
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string, name: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return {
    user,
    displayName,
    role,
    loading,
    isAdmin,
    init,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }
})
