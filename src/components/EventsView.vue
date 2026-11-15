<script setup>
// «События»: дорожки — родовые линии, точки — события из family.json.
import { ref, computed } from 'vue'
import { state, data, timeline, fmtDate, STATUS, lineColor, toYear } from '../store'
import { useYearAxis, NOW } from '../composables/yearAxis'
import AxisGrid from './AxisGrid.vue'
import ZoomBar from './ZoomBar.vue'

const emit = defineEmits(['open'])
const LABEL_W = 168
const AXIS_H = 64
const ROW_H = 34

const box = ref(null)
const active = ref(null)

const events = computed(() => timeline.value.map((e, i) => ({ ...e, i, t: toYear(e.date), approx: String(e.date).startsWith('~') })).filter(e => e.t))
const lanes = computed(() => Object.keys(data.lines).filter(k => !state.hiddenLines[k]))
const span = computed(() => {
  const ts = events.value.map(e => e.t)
  return { min: Math.floor(Math.min(...ts) / 10) * 10 - 10, max: NOW + 5 }
})
const ax = useYearAxis({ box, labelW: LABEL_W, span, onEmptyClick: () => { active.value = null } })
const { x, view } = ax
const showLabels = computed(() => view.ppy >= 14)

// раскладка точек по подрядам, чтобы подписи не налезали
const laid = computed(() => {
  const res = {}
  for (const l of lanes.value) {
    const items = events.value.filter(e => e.line === l).sort((a, b) => a.t - b.t)
    const rowsEnd = []
    const w = showLabels.value ? 190 : 16
    res[l] = items.map(e => {
      const px = x(e.t)
      let r = rowsEnd.findIndex(end => px > end + 8)
      if (r === -1) { r = rowsEnd.length; rowsEnd.push(0) }
      rowsEnd[r] = px + w
      return { ...e, px, row: r }
    })
    res[l].rows = Math.max(1, rowsEnd.length)
  }
  return res
})
const laneTop = computed(() => {
  let y = AXIS_H; const out = {}
  for (const l of lanes.value) { out[l] = y; y += laid.value[l].rows * ROW_H + 26 }
  out.__end = y
  return out
})

const act = computed(() => events.value.find(e => e.i === active.value))
function openPerson(id) { state.selected = id; state.focus = id; state.panelOpen = true; emit('open') }
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div ref="box" class="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-y-auto overflow-x-hidden active:cursor-grabbing"
      @wheel="ax.onWheel" @pointerdown="ax.down" @pointermove="ax.move" @pointerup="ax.up" @pointercancel="ax.up">
      <div class="relative" :style="{ height: laneTop.__end + 24 + 'px' }">
        <div class="absolute inset-y-0 overflow-hidden" :style="{ left: LABEL_W + 'px', right: 0 }">
          <AxisGrid :ax="ax" />
          <template v-for="l in lanes" :key="l">
            <div class="absolute left-0 right-0 border-t border-dashed border-[#e6e9f1]" :style="{ top: laneTop[l] + 'px' }"></div>
            <button v-for="e in laid[l]" :key="e.i" type="button"
              class="group absolute flex -translate-x-[7px] items-center gap-2 whitespace-nowrap"
              :style="{ left: e.px + 'px', top: laneTop[l] + 14 + e.row * ROW_H + 'px' }"
              @click.stop="active = active === e.i ? null : e.i">
              <span class="h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-white shadow ring-2 transition group-hover:scale-125"
                :style="{ background: lineColor(l).fg, '--tw-ring-color': STATUS[e.status]?.dot }"
                :class="{ 'scale-125': active === e.i, 'opacity-60': e.approx }"></span>
              <span v-if="showLabels" class="max-w-[170px] truncate rounded-md px-1 text-xs font-semibold"
                :class="active === e.i ? 'bg-accent text-white' : 'text-ink/80 group-hover:text-ink'">{{ e.title }}</span>
            </button>
          </template>
        </div>
        <div class="absolute inset-y-0 left-0 z-10 border-r border-black/5 bg-white/85 backdrop-blur" :style="{ width: LABEL_W + 'px' }">
          <div v-for="l in lanes" :key="l" class="absolute left-0 right-0 px-4" :style="{ top: laneTop[l] + 12 + 'px' }">
            <span class="chip" :style="{ background: lineColor(l).bg, color: lineColor(l).fg }">{{ data.lines[l] }}</span>
          </div>
        </div>
      </div>
    </div>
    <ZoomBar :ax="ax" />

    <transition enter-from-class="translate-y-3 opacity-0" leave-to-class="translate-y-3 opacity-0"
      enter-active-class="transition duration-200" leave-active-class="transition duration-150">
      <div v-if="act" class="panel absolute bottom-4 right-4 z-30 w-[min(380px,calc(100%-2rem))] p-5">
        <button class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg text-soft hover:bg-page" aria-label="Закрыть" @click="active = null">×</button>
        <time class="font-mono text-sm font-medium text-accent">{{ fmtDate(act.date) }}</time>
        <h3 class="mt-1 pr-6 text-lg font-extrabold leading-snug">{{ act.title }}</h3>
        <p v-if="act.text" class="mt-1 text-sm text-soft">{{ act.text }}</p>
        <p v-if="act.source" class="mt-2 text-xs text-soft">Источник: {{ act.source }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span class="chip" :style="{ background: STATUS[act.status]?.bg, color: STATUS[act.status]?.fg }">
            <i class="h-1.5 w-1.5 rounded-full" :style="{ background: STATUS[act.status]?.dot }"></i>{{ STATUS[act.status]?.label }}</span>
          <span class="chip" :style="{ background: lineColor(act.line).bg, color: lineColor(act.line).fg }">{{ data.lines[act.line] }}</span>
        </div>
        <div class="mt-4 flex flex-wrap gap-4 text-sm">
          <button v-if="act.person" class="link" @click="openPerson(act.person)">Показать в древе</button>
          <a v-if="act.url" :href="act.url" target="_blank" rel="noopener" class="link">Источник ↗</a>
        </div>
      </div>
    </transition>
  </div>
</template>
