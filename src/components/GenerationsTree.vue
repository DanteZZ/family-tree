<script setup>
// Режим «Поколения»: все связанные люди по слоям. Сверху младшие, внизу старшие
// (как и в остальных режимах древа). Подписи слоёв — относительно выбранного человека.
import { computed } from 'vue'
import { data, state } from '../store'
import { layoutGenerations, genLabel, CARD_W, CARD_H } from '../generations'
import PersonCard from './PersonCard.vue'

const L = layoutGenerations(data.meta.root)  // раскладка не зависит от выбора — двигаются только подписи
const LABEL_W = 230
const selG = computed(() => L.gen.get(state.selected) ?? L.gen.get(state.focus) ?? 0)
const rows = computed(() => L.gens.map(g => {
  const d = g - selG.value, t = genLabel(d)
  return { g, y: L.yOf(g), d, text: t[0].toUpperCase() + t.slice(1), n: L.nodes.filter(n => n.g === g).length }
}))
</script>

<template>
  <div class="relative" :style="{ width: L.width + LABEL_W + 'px', height: L.height + 'px' }">
    <!-- полосы слоёв -->
    <div v-for="r in rows" :key="r.g" class="absolute left-0 rounded-3xl"
      :class="r.d === 0 ? 'bg-accent-soft/70' : r.d % 2 ? 'bg-white/45' : ''"
      :style="{ top: r.y - 22 + 'px', height: CARD_H + 44 + 'px', width: L.width + LABEL_W + 40 + 'px' }">
      <div class="absolute left-5 top-1/2 w-[190px] -translate-y-1/2">
        <p class="font-mono text-[22px] font-bold leading-none" :class="r.d === 0 ? 'text-accent' : 'text-soft/70'">{{ r.d > 0 ? '+' + r.d : r.d === 0 ? '0' : '−' + -r.d }}</p>
        <p class="mt-1 text-[13px] font-bold leading-snug" :class="r.d === 0 ? 'text-accent' : 'text-ink'">{{ r.text }}</p>
        <p class="mt-0.5 text-[11px] text-soft">{{ r.n }} чел.</p>
      </div>
    </div>

    <div class="absolute top-0" :style="{ left: LABEL_W + 'px' }">
      <svg class="pointer-events-none absolute left-0 top-0 overflow-visible" :width="L.width" :height="L.height">
        <path v-for="(d, i) in L.paths" :key="i" :d="d" fill="none" stroke="var(--line)" stroke-width="1.6" stroke-linejoin="round" />
        <g v-for="(m, i) in L.marriages" :key="'m' + i">
          <line :x1="m.x1" :x2="m.x2" :y1="m.y" :y2="m.y" stroke="#e7a3b5" stroke-width="1.6" />
          <text :x="(m.x1 + m.x2) / 2" :y="m.y - 4" text-anchor="middle" font-size="11" fill="#d0738d">♡</text>
        </g>
      </svg>
      <div v-for="n in L.nodes" :key="n.id" class="absolute" :style="{ left: n.x + 'px', top: n.y + 'px', width: CARD_W + 'px', height: CARD_H + 'px' }">
        <PersonCard :id="n.id" :focus="n.id === state.focus" class="!h-full" />
      </div>
    </div>
  </div>
</template>
