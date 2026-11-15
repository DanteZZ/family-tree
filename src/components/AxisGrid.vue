<script setup>
// Фон шкалы: эпохи, деления лет и линия «сегодня». Кладётся внутрь плоскости с годами.
import { ERAS, NOW } from '../composables/yearAxis'
defineProps({ ax: Object })
</script>

<template>
  <div v-for="er in ERAS" :key="er.name" class="absolute top-0 h-6"
    :style="{ left: ax.x(er.from) + 'px', width: (er.to - er.from) * ax.view.ppy + 'px', background: er.c }">
    <span class="sticky left-2 inline-block whitespace-nowrap px-2 text-[11px] font-bold uppercase leading-6 tracking-wider text-soft">{{ er.name }}</span>
  </div>
  <div v-for="y in ax.minorTicks.value" :key="'m' + y" class="absolute bottom-0 w-px bg-[#eef0f5]" :style="{ left: ax.x(y) + 'px', top: '46px' }"></div>
  <template v-for="y in ax.ticks.value" :key="y">
    <div class="absolute bottom-0 w-px bg-[#dfe3ee]" :style="{ left: ax.x(y) + 'px', top: '40px' }"></div>
    <span class="absolute top-[26px] -translate-x-1/2 font-mono text-xs font-medium tabular-nums text-soft" :style="{ left: ax.x(y) + 'px' }">{{ y }}</span>
  </template>
  <div class="absolute bottom-0 w-0.5 bg-accent/40" :style="{ left: ax.x(NOW + 0.87) + 'px', top: '40px' }"></div>
</template>
