<script setup lang="ts">
import { computed } from 'vue'
import type { DisplayStatus } from '@/types'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/calc'

const props = defineProps<{ status: DisplayStatus }>()
const label = computed(() => STATUS_LABEL[props.status])
const tone = computed(() => STATUS_TONE[props.status])
</script>

<template>
  <span class="pill" :class="tone">{{ label }}</span>
</template>
