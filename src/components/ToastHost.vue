<script setup lang="ts">
import { CircleCheck, Info, TriangleAlert } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="fade">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.tone">
        <span class="ic">
          <CircleCheck v-if="t.tone === 'ok'" :size="16" />
          <TriangleAlert v-else-if="t.tone === 'err'" :size="16" />
          <Info v-else :size="16" />
        </span>
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
