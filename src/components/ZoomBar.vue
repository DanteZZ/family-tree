<script setup>
defineProps({ ax: Object })
</script>

<template>
  <div class="absolute bottom-4 left-4 z-20 inline-flex items-center gap-1 rounded-2xl bg-white/90 px-2 py-1.5 shadow-card ring-1 ring-black/5 backdrop-blur">
    <button class="ctl w-8" aria-label="Приблизить" @click="ax.zoomAt(ax.plotW.value / 2, 1.4)">+</button>
    <button class="ctl w-8" aria-label="Отдалить" @click="ax.zoomAt(ax.plotW.value / 2, 1 / 1.4)">−</button>
    <button class="ctl px-3 text-xs" @click="ax.fit">Все годы</button>
    <span class="px-2 font-mono text-xs text-soft">{{ Math.round(ax.view.start) }}–{{ Math.round(ax.end.value) }}</span>
  </div>
</template>

<style scoped>
.ctl { @apply grid h-8 whitespace-nowrap place-items-center rounded-lg font-bold text-ink hover:bg-accent-soft hover:text-accent; }
</style>
