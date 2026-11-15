<script setup>
import { state, data, lineColor } from '../store'
const h = state.hiddenLines
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button v-for="(label, key) in data.lines" :key="key"
      class="chip !px-3 !py-1 !text-xs ring-1 transition"
      :style="h[key] ? {} : { background: lineColor(key).bg, color: lineColor(key).fg }"
      :class="h[key] ? 'bg-white text-soft ring-black/10 line-through' : 'ring-transparent'"
      @click="h[key] = !h[key]">
      <i class="h-2 w-2 rounded-full" :style="{ background: lineColor(key).fg }"></i>{{ label }}</button>
    <slot />
  </div>
</template>
