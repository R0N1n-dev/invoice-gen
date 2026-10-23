<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney } from '@/lib/money'
import { useSettingsStore } from '@/stores/settings'

const props = withDefaults(
  defineProps<{ amount: number; currency?: string; compact?: boolean; signed?: boolean }>(),
  { compact: false, signed: false },
)
const settings = useSettingsStore()
const text = computed(() =>
  formatMoney(props.amount, props.currency ?? settings.currency, settings.locale, {
    compact: props.compact,
    signed: props.signed,
  }),
)
</script>

<template>
  <span class="num">{{ text }}</span>
</template>
