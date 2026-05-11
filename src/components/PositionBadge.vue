<script setup lang="ts">
import { computed } from 'vue'
import { positionVar } from '@/lib/positions'

const props = defineProps<{ code: string }>()

const bg = computed(() => positionVar(props.code))
</script>

<template>
  <span class="badge" :style="{ background: bg }">{{ code }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4rem;
  padding: 0.15rem 0.4rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #0a0a0a;
}
</style>
