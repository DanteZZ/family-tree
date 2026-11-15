<script setup>
// Счётчик комментариев «на разбор» в шапке (только dev). Щелчок — список, переход к человеку.
import { ref, computed } from 'vue'
import { state } from '../store'
import { inbox, KINDS } from '../devComments'

const open = ref(false)
const groups = computed(() => {
  const g = {}
  inbox.list.forEach(c => { (g[c.person || '—'] ||= { name: c.personName || 'Без человека', items: [] }).items.push(c) })
  return Object.entries(g)
})
function go(id) {
  if (id === '—') return
  state.selected = id; state.focus = id; state.panelOpen = true
  location.hash = 'tree'; open.value = false
}
</script>

<template>
  <div class="relative">
    <button class="chip bg-accent-soft !px-2.5 !py-1 text-accent ring-1 ring-accent/30 hover:bg-accent hover:text-white" @click="open = !open">
      ✎ на разбор: {{ inbox.list.length }}</button>
    <div v-if="open" class="panel absolute left-0 top-9 z-50 max-h-[70vh] w-[min(420px,90vw)] overflow-y-auto p-4">
      <p class="eyebrow">Комментарии на разбор · dev</p>
      <p v-if="!inbox.list.length" class="mt-2 text-sm text-soft">Пока пусто. Откройте карточку человека и впишите факт в блок «На разбор».</p>
      <div v-for="[id, g] in groups" :key="id" class="mt-3">
        <button class="text-sm font-extrabold hover:text-accent" @click="go(id)">{{ g.name }} →</button>
        <ul class="mt-1 space-y-1">
          <li v-for="c in g.items" :key="c.id" class="text-sm leading-snug">
            <b class="text-[11px]" :style="{ color: KINDS[c.kind]?.c }">{{ KINDS[c.kind]?.label }}</b> {{ c.text }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
