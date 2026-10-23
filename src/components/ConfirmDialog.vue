<script setup lang="ts">
import { computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const state = computed(() => ui.confirmState)
const o = computed(() => state.value.options)
let unregister: (() => void) | undefined

function done(value: boolean) {
  ui.resolveConfirm(value)
}

watch(
  () => state.value.open,
  (open) => {
    unregister?.()
    unregister = open ? ui.registerSheet(() => done(false)) : undefined
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="state.open" class="overlay" @click.self="done(false)">
        <div class="sheet" style="max-width: 420px" role="alertdialog" aria-modal="true">
          <div class="sheet-grip"></div>
          <div class="sheet-title" style="margin-bottom: 6px">{{ o.title }}</div>
          <p v-if="o.message" class="muted" style="font-size: 12.5px; line-height: 1.6">{{ o.message }}</p>
          <div class="sheet-foot">
            <button class="btn ghost grow" type="button" @click="done(false)">
              {{ o.cancelLabel || 'Cancel' }}
            </button>
            <button class="btn grow" :class="o.danger ? 'danger' : 'primary'" type="button" @click="done(true)">
              {{ o.confirmLabel || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
