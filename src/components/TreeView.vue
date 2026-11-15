<script setup>
// Древо на весь экран: перетаскивание мышью/пальцем и зум колесом — библиотека panzoom.
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import createPanZoom from 'panzoom'
import { state, data, person, spousesOf, fullName, unplaced, select } from '../store'
import AncestorTree from './AncestorTree.vue'
import DescendantTree from './DescendantTree.vue'
import GenerationsTree from './GenerationsTree.vue'
import PersonPanel from './PersonPanel.vue'

const focusP = computed(() => person(state.focus))
const spouses = computed(() => spousesOf(state.focus))

const viewport = ref(null)
const canvas = ref(null)
let pz = null

onMounted(() => {
  pz = createPanZoom(canvas.value, {
    maxZoom: 2.5,
    minZoom: 0.15,
    zoomDoubleClickSpeed: 1, // двойной щелчок занят: «поставить в центр»
    smoothScroll: false,
    // не начинать перетаскивание с ползунков и кнопок управления
    beforeMouseDown: (e) => !!e.target.closest('input,select'),
  })
  centerFocus(false)
})
onBeforeUnmount(() => pz && pz.dispose())

function centerFocus(smooth = true) {
  nextTick(() => {
    const el = canvas.value?.querySelector('[data-focus="true"]')
    if (!el || !pz) return
    const v = viewport.value.getBoundingClientRect(), r = el.getBoundingClientRect()
    const free = v.width - (state.panelOpen && v.width > 900 ? 400 : 0)
    const dx = (v.left + free / 2) - (r.left + r.width / 2)
    const dy = (v.top + v.height * 0.28) - (r.top + r.height / 2)
    if (smooth) pz.smoothMoveTo(pz.getTransform().x + dx, pz.getTransform().y + dy)
    else pz.moveBy(dx, dy)
  })
}
watch(() => [state.focus, state.upGens, state.downGens, state.treeMode], () => centerFocus())
watch(() => state.treeMode, (m) => { try { localStorage.setItem('treeMode', m) } catch {} })
const MODES = [['direct', 'Прямые предки'], ['all', 'Все'], ['gens', 'Поколения']]

function zoom(f) {
  const v = viewport.value.getBoundingClientRect()
  pz.smoothZoom(v.width / 2, v.height / 2, f)
}
function fitAll() {
  const v = viewport.value.getBoundingClientRect()
  const t = pz.getTransform()
  const w = canvas.value.scrollWidth, h = canvas.value.scrollHeight
  const s = Math.min(1.2, Math.min((v.width - 80) / w, (v.height - 80) / h))
  pz.zoomAbs(0, 0, s)
  pz.moveTo((v.width - w * s) / 2, (v.height - h * s) / 2)
  void t
}
</script>

<template>
  <div class="absolute inset-0">
    <!-- холст -->
    <div ref="viewport" class="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
      style="background-image: radial-gradient(#d9dde8 1px, transparent 1px); background-size: 22px 22px;">
      <div ref="canvas" class="inline-flex flex-col items-center p-16">
        <GenerationsTree v-if="state.treeMode === 'gens'" />
        <template v-else>
          <DescendantTree v-if="state.downGens > 0" :id="state.focus" :depth="state.downGens" :show-self="false" />
          <AncestorTree :id="state.focus" :depth="state.upGens" :focus="true" />
        </template>
      </div>
    </div>

    <!-- кто в центре -->
    <div class="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)]">
      <div class="pointer-events-auto inline-block rounded-2xl bg-white/90 px-4 py-2.5 shadow-card ring-1 ring-black/5 backdrop-blur">
        <p class="eyebrow">В центре древа · подписи родства — от выбранного человека</p>
        <p class="text-[15px] font-bold">{{ fullName(focusP) }}
          <button v-for="s in spouses" :key="s.id" class="ml-2 text-sm font-semibold text-soft hover:text-accent"
            @click="state.selected = s.id; state.panelOpen = true" @dblclick="state.focus = s.id">♡ {{ s.given }} {{ s.surname }}</button>
        </p>
        <button v-if="state.focus !== data.meta.root" class="mt-1 text-xs font-semibold text-accent" @click="state.focus = data.meta.root">← вернуться к началу</button>
        <div v-if="unplaced.length" class="mt-2 border-t border-black/5 pt-2">
          <p class="eyebrow">Ещё без места в древе</p>
          <button v-for="u in unplaced" :key="u.id" class="mr-3 mt-0.5 text-sm font-semibold text-accent hover:underline"
            @click="select(u.id)">{{ u.given }} {{ u.surname }}</button>
        </div>
      </div>
    </div>

    <!-- управление -->
    <div class="absolute bottom-4 left-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/90 px-3 py-2 text-sm shadow-card ring-1 ring-black/5 backdrop-blur">
      <div class="flex rounded-lg bg-[#eef0f6] p-0.5" role="group" aria-label="Режим древа">
        <button v-for="[m, label] in MODES" :key="m" class="h-7 whitespace-nowrap rounded-md px-3 text-xs font-bold transition"
          :class="state.treeMode === m ? 'bg-white text-accent shadow-sm' : 'text-soft hover:text-ink'"
          :aria-pressed="state.treeMode === m" @click="state.treeMode = m">{{ label }}</button>
      </div>
      <div class="flex items-center gap-1">
        <button class="ctl w-8" aria-label="Приблизить" @click="zoom(1.3)">+</button>
        <button class="ctl w-8" aria-label="Отдалить" @click="zoom(1 / 1.3)">−</button>
        <button class="ctl px-3 text-xs" @click="fitAll">Всё древо</button>
        <button class="ctl px-3 text-xs" @click="centerFocus()">К центру</button>
      </div>
      <template v-if="state.treeMode !== 'gens'">
      <label class="flex items-center gap-2 text-soft">Предков
        <input id="up-gens" v-model.number="state.upGens" type="range" min="1" max="10" class="w-20 accent-[#4f63d8]">
        <span class="w-3 font-mono text-ink">{{ state.upGens }}</span>
      </label>
      <label class="flex items-center gap-2 text-soft">Потомков
        <input id="down-gens" v-model.number="state.downGens" type="range" min="0" max="5" class="w-16 accent-[#4f63d8]">
        <span class="w-3 font-mono text-ink">{{ state.downGens }}</span>
      </label>
      </template>
    </div>

    <!-- панель информации поверх древа -->
    <button v-if="!state.panelOpen" class="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-accent shadow-card ring-1 ring-black/5"
      @click="state.panelOpen = true">Показать сведения</button>
    <transition enter-from-class="translate-x-6 opacity-0" leave-to-class="translate-x-6 opacity-0"
      enter-active-class="transition duration-200" leave-active-class="transition duration-150">
      <div v-if="state.panelOpen" class="absolute right-4 top-4 flex max-h-[calc(100%-2rem)] w-[min(440px,calc(100%-2rem))] flex-col">
        <PersonPanel @close="state.panelOpen = false" />
      </div>
    </transition>
  </div>
</template>

<style scoped>
.ctl { @apply grid h-8 whitespace-nowrap place-items-center rounded-lg font-bold text-ink hover:bg-accent-soft hover:text-accent; }
</style>
