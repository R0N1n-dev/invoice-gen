<script setup lang="ts">
withDefaults(defineProps<{ title: string; message?: string; icon?: unknown }>(), { message: '' })
</script>

<template>
  <div class="empty">
    <div class="eic">
      <slot name="icon"><span style="font-size: 18px">◎</span></slot>
    </div>
    <h3>{{ title }}</h3>
    <p v-if="message">{{ message }}</p>
    <slot />
  </div>
</template>
