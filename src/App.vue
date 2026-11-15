<script setup>
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { data, STATUS } from './store'
import TreeView from './components/TreeView.vue'
import TimelineView from './components/TimelineView.vue'

const view = ref('tree')
const TL = ['timeline', 'lives', 'moves']
const sync = () => { const h = location.hash.slice(1); view.value = TL.includes(h) ? h : 'tree' }
onMounted(() => { sync(); addEventListener('hashchange', sync) })
const DevBadge = import.meta.env.DEV ? defineAsyncComponent(() => import('./components/DevBadge.vue')) : null
const go = (v) => { location.hash = v }
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <header class="z-20 flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-black/5 bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
      <div class="flex min-w-0 items-baseline gap-3">
        <h1 class="truncate text-lg font-extrabold tracking-tight sm:text-xl">{{ data.meta.title }}</h1>
        <span class="hidden text-xs font-semibold text-soft md:inline">{{ data.people.length }} человек</span>
        <component :is="DevBadge" v-if="DevBadge" />
      </div>
      <div class="hidden flex-wrap gap-1.5 lg:flex">
        <span v-for="(s, k) in STATUS" :key="k" class="chip" :style="{ background: s.bg, color: s.fg }">
          <i class="h-1.5 w-1.5 rounded-full" :style="{ background: s.dot }"></i>{{ s.label }}</span>
      </div>
      <nav class="seg" aria-label="Разделы">
        <button :aria-pressed="view === 'tree'" @click="go('tree')">Древо</button>
        <button :aria-pressed="view !== 'tree'" @click="go('timeline')">Хронология</button>
      </nav>
    </header>

    <main class="relative min-h-0 flex-1">
      <TreeView v-if="view === 'tree'" />
      <TimelineView v-else :tab="view" @tab="go" @open="go('tree')" />
    </main>
  </div>
</template>
