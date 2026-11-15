<script setup>
// «Годы жизни»: гант-«колбаски» от рождения до смерти.
// Строки сжимаются по видимому диапазону: кто не жил в видимые годы — скрыт, пока не долистаем.
import { ref, computed } from 'vue'
import { state, data, person, fullName, lineColor, lifeSpans, lifespan, STATUS } from '../store'
import { useYearAxis, NOW } from '../composables/yearAxis'
import AxisGrid from './AxisGrid.vue'
import ZoomBar from './ZoomBar.vue'

const emit = defineEmits(['open'])
const AXIS_H = 60
const ROW_H = 34

const box = ref(null)
const active = ref(null)

const all = computed(() => data.people
  .filter(p => lifeSpans[p.id]?.b && !state.hiddenLines[p.line])
  .map(p => ({ p, ...lifeSpans[p.id] }))
  .sort((a, b) => a.b - b.b))
const noDates = computed(() => data.people.filter(p => !lifeSpans[p.id]?.b).length)

const span = computed(() => ({ min: Math.floor(Math.min(...all.value.map(r => r.b), 1900) / 10) * 10 - 10, max: NOW + 5 }))
const ax = useYearAxis({ box, labelW: 0, span, onEmptyClick: () => { active.value = null } })
const { x, view, end } = ax

// только те, чья жизнь пересекает видимый диапазон
const rows = computed(() => all.value.filter(r => r.e > view.start && r.b < end.value))
const hiddenBefore = computed(() => all.value.filter(r => r.e <= view.start).length)
const hiddenAfter = computed(() => all.value.filter(r => r.b >= end.value).length)

function bar(r) {
  const w = Math.max(6, (r.e - r.b) * view.ppy)
  const c = lineColor(r.p.line).fg
  const fade = Math.min(48, w * 0.3)
  const stops = [
    r.bA ? `${c}00 0px, ${c}2e ${fade}px` : `${c}2e 0px`,
    r.eA ? `${c}2e calc(100% - ${fade}px), ${c}00 100%` : `${c}2e 100%`,
  ]
  return { left: x(r.b) + 'px', width: w + 'px', background: `linear-gradient(90deg, ${stops.join(', ')})`, '--fg': c }
}
// подпись прилипает к левому краю, если начало «колбаски» ушло за экран
const labelLeft = (r) => Math.max(x(r.b), 0) + 10
const yr = (t) => Math.floor(t)

const act = computed(() => active.value && person(active.value))
function select(id) { active.value = active.value === id ? null : id; state.selected = id }
function openPerson(id) { state.selected = id; state.focus = id; state.panelOpen = true; emit('open') }
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div ref="box" class="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-y-auto overflow-x-hidden active:cursor-grabbing"
      @wheel="ax.onWheel" @pointerdown="ax.down" @pointermove="ax.move" @pointerup="ax.up" @pointercancel="ax.up">
      <div class="relative overflow-hidden" :style="{ height: AXIS_H + rows.length * ROW_H + 90 + 'px', minHeight: '100%' }">
        <AxisGrid :ax="ax" />

        <!-- счётчики скрытых -->
        <div v-if="hiddenBefore" class="absolute left-3 top-[44px] z-10 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-soft shadow-card">
          ← ещё {{ hiddenBefore }} раньше</div>
        <div v-if="hiddenAfter" class="absolute right-3 top-[44px] z-10 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-soft shadow-card">
          ещё {{ hiddenAfter }} позже →</div>

        <TransitionGroup tag="div" name="row" class="absolute inset-x-0" :style="{ top: AXIS_H + 10 + 'px' }">
          <div v-for="(r, i) in rows" :key="r.p.id" class="absolute inset-x-0" :style="{ top: i * ROW_H + 'px', height: ROW_H + 'px' }">
            <button type="button" class="life absolute top-[5px] h-6 rounded-full"
              :class="{ 'is-act': active === r.p.id, 'is-alive': r.p.living }"
              :style="bar(r)" :aria-label="fullName(r.p)" @click.stop="select(r.p.id)">
              <i v-if="!r.bA" class="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style="background: var(--fg)"></i>
              <i v-if="!r.eA && !r.p.living" class="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rotate-45 border-2 border-white" style="background: var(--fg)"></i>
            </button>
            <span class="pointer-events-none absolute top-[9px] whitespace-nowrap text-xs font-bold"
              :style="{ left: labelLeft(r) + 'px', color: lineColor(r.p.line).fg }">
              {{ r.p.given }} {{ r.p.patronymic }} {{ r.p.surname }}<template v-if="r.p.maiden"> ({{ r.p.maiden }})</template>
              <span class="ml-1 font-mono font-medium text-soft">{{ lifespan(r.p) || ('~' + yr(r.b) + (r.p.living ? '' : '–?')) }}</span>
            </span>
          </div>
        </TransitionGroup>

        <p v-if="!rows.length" class="absolute inset-x-0 text-center text-sm text-soft" :style="{ top: AXIS_H + 40 + 'px' }">В этих годах никого нет — полистайте или нажмите «Все годы».</p>
      </div>
    </div>
    <ZoomBar :ax="ax" />
    <div class="pointer-events-none absolute bottom-5 right-4 hidden gap-4 rounded-full bg-white/90 px-4 py-1.5 text-[11px] font-semibold text-soft shadow-card ring-1 ring-black/5 lg:flex">
      <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-full bg-soft"></i>рождение</span>
      <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rotate-45 bg-soft"></i>смерть</span>
      <span class="flex items-center gap-1.5"><i class="h-2.5 w-7 rounded-full bg-gradient-to-r from-transparent to-soft/50"></i>оценка по родственникам</span>
      <span v-if="noDates">без дат: {{ noDates }}</span>
    </div>

    <transition enter-from-class="translate-y-3 opacity-0" leave-to-class="translate-y-3 opacity-0"
      enter-active-class="transition duration-200" leave-active-class="transition duration-150">
      <div v-if="act" class="panel absolute bottom-16 right-4 z-30 w-[min(400px,calc(100%-2rem))] p-5">
        <button class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg text-soft hover:bg-page" aria-label="Закрыть" @click="active = null">×</button>
        <h3 class="pr-6 text-lg font-extrabold leading-snug">{{ fullName(act) }}</h3>
        <p class="font-mono text-sm text-soft">{{ lifespan(act) || 'даты неизвестны' }}
          <span v-if="lifeSpans[act.id].bA || lifeSpans[act.id].eA"> · на шкале ~{{ Math.floor(lifeSpans[act.id].b) }}–{{ act.living ? 'н. в.' : Math.floor(lifeSpans[act.id].e) }}</span></p>
        <p v-if="act.bio?.length" class="mt-2 line-clamp-4 text-sm text-ink/80">{{ act.bio[0] }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span class="chip" :style="{ background: STATUS[act.status]?.bg, color: STATUS[act.status]?.fg }">
            <i class="h-1.5 w-1.5 rounded-full" :style="{ background: STATUS[act.status]?.dot }"></i>{{ STATUS[act.status]?.label }}</span>
          <span class="chip" :style="{ background: lineColor(act.line).bg, color: lineColor(act.line).fg }">{{ data.lines[act.line] }}</span>
        </div>
        <button class="link mt-4 text-sm" @click="openPerson(act.id)">Открыть в древе →</button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.life { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--fg) 40%, transparent); transition: box-shadow .15s; }
.life:hover, .life.is-act { box-shadow: inset 0 0 0 2px var(--fg), 0 4px 14px color-mix(in srgb, var(--fg) 25%, transparent); }
.life.is-alive::after { content: ""; position: absolute; right: -4px; top: 50%; width: 8px; height: 8px; margin-top: -4px; border-radius: 9999px; background: var(--fg); animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 50% { transform: scale(1.6); opacity: .4; } }
.row-move, .row-enter-active, .row-leave-active { transition: top .25s ease, opacity .25s ease; }
.row-enter-from, .row-leave-to { opacity: 0; }
.row-leave-active { pointer-events: none; }
</style>
