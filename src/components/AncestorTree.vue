<script setup>
// Предки идут ВНИЗ: человек сверху, под ним — отец и мать, ещё ниже — их родители.
// Режим «Прямые предки»: братья и сёстры — списком под карточкой.
// Режим «Все»: братья и сёстры — такими же карточками в одном ряду (по старшинству),
// с общей скобкой к родителям. Пустые ячейки по краям держат самого человека по центру,
// чтобы линии от ребёнка сверху и к родителям снизу шли ровно в его карточку.
import { computed } from 'vue'
import { person, siblingsOf, lifespan, lineColor, select, state, yearOf } from '../store'
import { kinOf } from '../kinship'
import PersonCard from './PersonCard.vue'

defineOptions({ name: 'AncestorTree' })
const props = defineProps({ id: String, depth: Number, focus: Boolean })
const p = computed(() => person(props.id))
const parents = computed(() => props.depth > 0 && p.value ? [p.value.father, p.value.mother].filter(x => x && person(x)) : [])
const sibs = computed(() => siblingsOf(props.id).sort((a, b) => yearOf(a.birth?.date) - yearOf(b.birth?.date)))

// ряд «братья и сёстры + сам человек» с распорками
const row = computed(() => {
  const all = [...sibs.value, p.value].sort((a, b) => yearOf(a.birth?.date) - yearOf(b.birth?.date))
  const i = all.indexOf(p.value), L = i, R = all.length - 1 - i
  const cells = all.map(x => ({ id: x.id }))
  for (let k = 0; k < R - L; k++) cells.unshift({ sp: 'l' + k })
  for (let k = 0; k < L - R; k++) cells.push({ sp: 'r' + k })
  const real = cells.map((c, j) => c.id ? j : -1).filter(j => j >= 0)
  return cells.map((c, j) => ({ ...c, first: j === real[0], last: j === real[real.length - 1] }))
})
</script>

<template>
  <div class="br-down">
    <div v-if="state.treeMode === 'all' && sibs.length" class="sibs">
      <div v-for="c in row" :key="c.id || c.sp" class="sib" :class="{ sp: !c.id, first: c.first, last: c.last }">
        <PersonCard v-if="c.id" :id="c.id" :focus="focus && c.id === id" :class="c.id !== id ? 'opacity-90' : ''" />
        <div v-else class="w-52"></div>
      </div>
    </div>
    <div v-else class="flex flex-col items-center">
      <PersonCard :id="id" :focus="focus" />
      <div v-if="sibs.length" class="mt-1.5 w-52 rounded-xl bg-white/70 px-2 py-1.5 ring-1 ring-black/5">
        <p class="px-1 text-[10px] font-bold uppercase tracking-wider text-soft">{{ p.sex === 'f' ? 'Её' : 'Его' }} братья и сёстры</p>
        <button v-for="s in sibs" :key="s.id" type="button"
          class="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs hover:bg-accent-soft"
          :class="state.selected === s.id ? 'bg-accent-soft' : ''" :title="kinOf(s.id)"
          @click="select(s.id)" @dblclick="state.focus = s.id">
          <i class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: lineColor(s.line).fg }"></i>
          <span class="truncate font-semibold">{{ s.given }}</span>
          <span v-if="kinOf(s.id)" class="truncate text-[10.5px] font-semibold text-accent">{{ kinOf(s.id) }}</span>
          <span class="ml-auto shrink-0 font-mono text-[10.5px] text-soft">{{ lifespan(s) }}</span>
        </button>
      </div>
    </div>
    <div v-if="parents.length" class="row">
      <div v-for="pid in parents" :key="pid" class="cell">
        <AncestorTree :id="pid" :depth="depth - 1" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ряд братьев и сестёр: карточки снизу выровнены, под ними скобка к родителям */
.sibs { display: flex; align-items: stretch; }
.sib { position: relative; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 8px var(--gap); }
.sib:not(.sp)::before, .sib:not(.sp)::after { content: ""; position: absolute; bottom: 0; width: 50%; height: var(--gap); border-bottom: 1.5px solid var(--line); }
.sib:not(.sp)::before { right: 50%; }
.sib:not(.sp)::after { left: 50%; border-left: 1.5px solid var(--line); }
.sib.first::before, .sib.last::after { border-bottom: 0; }
.sib.first::after { border-bottom-left-radius: 12px; }
.sib.last::before { border-right: 1.5px solid var(--line); border-bottom-right-radius: 12px; }
.sib.last::after { border-left: 0; }
.sib.first.last::before { display: none; }
</style>
