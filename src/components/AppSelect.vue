<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import AppSheet from './AppSheet.vue'

export interface SelectOption {
  value: string | number
  label: string
  hint?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    options: SelectOption[]
    label?: string
    placeholder?: string
    disabled?: boolean
    compact?: boolean
  }>(),
  { label: '', placeholder: 'Select…', disabled: false, compact: false },
)
const emit = defineEmits<{ 'update:modelValue': [string | number] }>()

const open = ref(false)
const selected = computed(() => props.options.find((o) => o.value === props.modelValue))

function pick(value: string | number) {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <button
    type="button"
    class="app-select"
    :class="{ compact, empty: !selected }"
    :disabled="disabled"
    :aria-haspopup="'listbox'"
    @click="open = true"
  >
    <span class="as-value">{{ selected?.label ?? placeholder }}</span>
    <ChevronDown :size="15" class="as-caret" />
  </button>

  <AppSheet :open="open" :title="label || 'Select'" @close="open = false">
    <div class="scrim-list" role="listbox">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="quick as-option"
        :class="{ chosen: option.value === modelValue }"
        role="option"
        :aria-selected="option.value === modelValue"
        @click="pick(option.value)"
      >
        <span class="grow" style="text-align: left">
          <span class="row-title">{{ option.label }}</span>
          <span v-if="option.hint" class="row-sub">{{ option.hint }}</span>
        </span>
        <Check v-if="option.value === modelValue" :size="16" class="as-tick" />
      </button>
    </div>
  </AppSheet>
</template>

<style scoped>
.app-select {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  background: var(--field);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--ink);
  font-size: 14px;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.app-select:active {
  background: var(--surface-2);
}
.app-select.empty .as-value {
  color: var(--dim);
}
.app-select.compact {
  min-height: 34px;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 9px;
}
.as-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.as-caret {
  flex: none;
  color: var(--muted);
}
.as-option {
  padding: 11px 12px;
}
.as-option.chosen {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}
.as-tick {
  flex: none;
  color: var(--link);
}
</style>
