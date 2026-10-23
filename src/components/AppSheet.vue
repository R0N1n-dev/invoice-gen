<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'

const props = withDefaults(
  defineProps<{ open: boolean; title?: string; subtitle?: string; wide?: boolean }>(),
  { title: '', subtitle: '', wide: false },
)
const emit = defineEmits<{ close: [] }>()
const ui = useUiStore()
let unregister: (() => void) | undefined

function close() {
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close()
}

watch(
  () => props.open,
  (open) => {
    unregister?.()
    unregister = undefined
    if (open) {
      unregister = ui.registerSheet(close)
      window.addEventListener('keydown', onKey)
    } else {
      window.removeEventListener('keydown', onKey)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unregister?.()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="overlay" @click.self="close">
        <div class="sheet" :style="wide ? { maxWidth: '680px' } : undefined" role="dialog" aria-modal="true">
          <div class="sheet-grip"></div>
          <div class="sheet-head">
            <div>
              <div class="sheet-title">{{ title }}</div>
              <div v-if="subtitle" class="page-sub">{{ subtitle }}</div>
            </div>
            <button class="icon-btn" type="button" aria-label="Close" @click="close">
              <X :size="17" />
            </button>
          </div>
          <div class="sheet-body"><slot /></div>
          <div v-if="$slots.footer" class="sheet-foot"><slot name="footer" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
