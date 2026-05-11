<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

const tab = computed(() => route.name as string)
</script>

<template>
  <nav class="nav" aria-label="Principal">
    <RouterLink
      class="item"
      :class="{ active: tab === 'players' || tab === 'player-detail' || tab === 'player-new' || tab === 'player-edit' }"
      :to="{ name: 'players' }"
    >
      <span class="ico">👤</span>
      Jugadores
    </RouterLink>
    <RouterLink
      class="item"
      :class="{ active: tab === 'board-list' || tab === 'board-editor' }"
      :to="{ name: 'board-list' }"
    >
      <span class="ico">⚽</span>
      Táctica
    </RouterLink>
    <RouterLink
      class="item"
      :class="{ active: tab === 'events' || tab === 'event-detail' }"
      :to="{ name: 'events' }"
    >
      <span class="ico">📋</span>
      Equipo
    </RouterLink>
  </nav>
</template>

<style scoped>
.nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 0.35rem 0.5rem calc(0.35rem + var(--safe-bottom));
  border-top: 1px solid var(--border);
  background: rgba(10, 10, 10, 0.96);
  backdrop-filter: blur(10px);
}

.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.45rem;
  font-size: 0.7rem;
  color: var(--muted);
  border-radius: 10px;
}

.item.active {
  color: var(--accent);
  background: var(--surface-2);
}

.ico {
  font-size: 1.15rem;
  line-height: 1;
}
</style>
