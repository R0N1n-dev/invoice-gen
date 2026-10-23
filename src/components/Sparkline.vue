<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ values: number[]; height?: number }>(), { height: 46 })
const W = 300

const points = computed(() => {
  const vals = props.values.length ? props.values : [0]
  const max = Math.max(...vals, 1)
  const step = vals.length > 1 ? W / (vals.length - 1) : W
  return vals.map((v, i) => [i * step, props.height - (v / max) * (props.height - 6) - 3] as const)
})
const line = computed(() => points.value.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '))
const area = computed(() => `${line.value} L${W},${props.height} L0,${props.height} Z`)
const last = computed(() => points.value[points.value.length - 1])
</script>

<template>
  <svg class="sparkline" :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.42" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="area" fill="url(#sparkFill)" />
    <path :d="line" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
    <circle :cx="last[0]" :cy="last[1]" r="2.8" fill="#fff" />
  </svg>
</template>
