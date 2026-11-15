<script setup>
// Нижняя панель режима «История»: управление, карточка сцены,
// дорожки ключевых людей (что делают и когда) и полоса обзора всех лет.
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { person, lineColor, fmtDate, STATUS } from '../store'
import { KIND } from '../composables/story'

const props = defineProps({ st: Object })
const emit = defineEmits(['person'])
const st = props.st
const s = st.s

const NAME_W = 150
const WINDOW = 36   // лет в окне дорожек
const LANE_H = 24

/* ---------- дорожки: люди в порядке первого появления в сюжете ---------- */
const lanes = (() => {
  const order = []
  st.beats.forEach(b => b.people.forEach(id => { if (!order.includes(id)) order.push(id) }))
  return order.map(id => ({ id, p: person(id), beats: st.beats.filter(b => b.people.includes(id)) })).filter(l => l.p)
})()

const track = ref(null)
const trackW = ref(800)
const ppy = computed(() => (trackW.value - NAME_W) / WINDOW)
const vStart = computed(() => s.t - WINDOW * 0.32)
const x = (t) => NAME_W + (t - vStart.value) * ppy.value
const ticks = computed(() => {
  const step = ppy.value * 5 > 46 ? 5 : 10
  const out = []
  for (let y = Math.ceil(vStart.value / step) * step; y < vStart.value + WINDOW; y += step) out.push(y)
  return out
})

const isCur = (b) => st.current.value.includes(b)
const state = (b) => isCur(b) ? 'cur' : b.t0 > s.t + 1e-6 ? 'future' : (b.t1 > b.t0 && b.t1 >= s.t) ? 'live' : 'past'

/* ---------- перетаскивание дорожек = перемотка ---------- */
let drag = null
function down(e) {
  if (e.button || e.target.closest('button')) return
  drag = { x: e.clientX, t: s.t, moved: false, id: e.pointerId }
}
function move(e) {
  if (!drag) return
  const dx = e.clientX - drag.x
  if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; track.value.setPointerCapture(drag.id) }
  if (drag.moved) st.scrub(drag.t - dx / ppy.value)
}
function up() { drag = null }

/* ---------- полоса обзора ---------- */
const ov = ref(null)
const span = { a: Math.floor(st.frames[0].t) - 3, b: Math.ceil(st.frames[st.frames.length - 1].t) + 3 }
const ox = (t) => ((t - span.a) / (span.b - span.a)) * 100
let ovDrag = false
function ovSeek(e) {
  const r = ov.value.getBoundingClientRect()
  st.scrub(span.a + ((e.clientX - r.left) / r.width) * (span.b - span.a))
}
function ovDown(e) { ovDrag = true; ov.value.setPointerCapture(e.pointerId); ovSeek(e) }
function ovMove(e) { if (ovDrag) ovSeek(e) }

/* ---------- автопрокрутка к дорожке текущей сцены ---------- */
const lanesBox = ref(null)
watch(() => s.k, async () => {
  const id = st.frames[s.k]?.beats[0]?.people[0]; if (!id) return
  await nextTick()
  const el = lanesBox.value?.querySelector(`[data-lane="${id}"]`)
  if (el && lanesBox.value) {
    const box = lanesBox.value, top = el.offsetTop, h = el.offsetHeight
    if (top < box.scrollTop || top + h > box.scrollTop + box.clientHeight) box.scrollTo({ top: top - box.clientHeight / 3, behavior: 'smooth' })
  }
})

let ro
onMounted(() => {
  ro = new ResizeObserver(([en]) => { trackW.value = en.contentRect.width })
  ro.observe(track.value)
  trackW.value = track.value.clientWidth
  addEventListener('keydown', key)
})
onBeforeUnmount(() => { ro?.disconnect(); removeEventListener('keydown', key) })
function key(e) {
  if (e.target.closest?.('input,textarea')) return
  if (e.code === 'Space') { e.preventDefault(); st.toggle() }
  else if (e.code === 'ArrowRight') st.next()
  else if (e.code === 'ArrowLeft') st.prev()
}

const nextFrame = computed(() => s.phase === 'travel' ? st.frames[s.k + 1] : null)
const names = (b) => b.people.map(id => person(id)).filter(Boolean)
const range = (b) => b.t1 > b.t0 ? `${fmtDate(b.from)} — ${fmtDate(b.to)}` : fmtDate(b.from)
</script>

<template>
  <div class="panel pointer-events-auto flex flex-col overflow-hidden !rounded-2xl">
    <!-- управление + сцена -->
    <div class="flex items-stretch gap-4 border-b border-black/5 px-4 py-3">
      <div class="flex shrink-0 flex-col items-center justify-center gap-1.5">
        <span class="font-mono text-3xl font-extrabold tabular-nums leading-none text-ink">{{ Math.floor(s.t) }}</span>
        <div class="flex items-center gap-1">
          <button class="ctl" aria-label="Предыдущая сцена" @click="st.prev()">⏮</button>
          <button class="ctl !h-9 !w-9 bg-accent text-white hover:!bg-accent hover:!text-white hover:opacity-90" :aria-label="s.playing ? 'Пауза' : 'Играть'" @click="st.toggle()">{{ s.playing ? '❚❚' : '▶' }}</button>
          <button class="ctl" aria-label="Следующая сцена" @click="st.next()">⏭</button>
        </div>
        <button class="rounded-full px-2 text-[11px] font-bold text-soft hover:text-accent" @click="s.speed = s.speed === 1 ? 2 : s.speed === 2 ? 0.5 : 1">скорость {{ s.speed }}×</button>
      </div>

      <div class="min-w-0 flex-1">
        <transition-group tag="div" name="scene" class="relative space-y-2">
          <div v-for="b in st.current.value" :key="b.i" class="flex gap-3">
            <span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white shadow" :style="{ background: KIND[b.kind].c }">{{ KIND[b.kind].icon }}</span>
            <div class="min-w-0">
              <p class="text-[11px] font-bold uppercase tracking-wider" :style="{ color: KIND[b.kind].c }">{{ KIND[b.kind].label }} · {{ range(b) }}
                <span v-if="b.status && b.status !== 'doc'" class="ml-1 normal-case tracking-normal" :style="{ color: STATUS[b.status].fg }">({{ STATUS[b.status].short }})</span></p>
              <h3 class="text-base font-extrabold leading-snug">{{ b.title }}</h3>
              <p v-if="b.text" class="text-sm leading-snug text-ink/75">{{ b.text }}</p>
              <div class="mt-1 flex flex-wrap gap-1">
                <button v-for="p in names(b)" :key="p.id" class="chip hover:ring-1 hover:ring-current" :style="{ background: lineColor(p.line).bg, color: lineColor(p.line).fg }" @click="emit('person', p.id)">{{ p.given }} {{ p.surname }}</button>
              </div>
            </div>
          </div>
          <div v-if="!st.current.value.length" key="idle" class="py-1 text-sm text-soft">
            <p v-if="s.playing && nextFrame" class="mb-1 truncate">Идут годы… Далее: <b class="text-ink">{{ nextFrame.beats[0].title }}</b> ({{ fmtDate(nextFrame.beats[0].from) }})</p>
            <template v-if="st.ongoing.value.length">
              <p class="eyebrow mb-1">Сейчас идёт</p>
              <p v-for="b in st.ongoing.value" :key="b.i" class="truncate"><b class="text-ink">{{ b.title }}</b> · {{ range(b) }}</p>
            </template>
            <p v-else-if="!s.playing">Нажмите ▶, чтобы проиграть историю семьи, или выберите событие на дорожках. Пробел — пауза, стрелки — к соседней сцене.</p>
          </div>
        </transition-group>
        <div v-if="st.current.value.length && st.ongoing.value.length" class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-soft">
          <span class="font-bold">Параллельно:</span>
          <span v-for="b in st.ongoing.value" :key="b.i">{{ b.title }} ({{ range(b) }})</span>
        </div>
      </div>
    </div>

    <!-- дорожки -->
    <div ref="track" class="relative cursor-grab touch-none select-none active:cursor-grabbing"
      @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
      <div class="relative h-6 border-b border-black/5">
        <span v-for="y in ticks" :key="y" class="absolute top-1 -translate-x-1/2 font-mono text-[11px] text-soft" :style="{ left: x(y) + 'px' }">{{ y }}</span>
      </div>
      <div ref="lanesBox" class="relative max-h-[150px] overflow-y-auto overflow-x-hidden">
        <div class="relative" :style="{ height: lanes.length * LANE_H + 'px' }">
          <div v-for="y in ticks" :key="'g' + y" class="absolute inset-y-0 w-px bg-black/[.04]" :style="{ left: x(y) + 'px' }"></div>
          <div v-for="(l, i) in lanes" :key="l.id" :data-lane="l.id" class="absolute inset-x-0" :style="{ top: i * LANE_H + 'px', height: LANE_H + 'px' }">
            <template v-for="b in l.beats" :key="b.i">
              <!-- диапазон -->
              <button v-if="b.t1 > b.t0" class="beat absolute top-[7px] h-[10px] rounded-full" :class="state(b)"
                :style="{ left: x(b.t0) + 'px', width: Math.max(10, (b.t1 - b.t0) * ppy) + 'px', '--c': KIND[b.kind].c }"
                :title="b.title" @click="st.seekBeat(b)">
                <span v-if="(b.t1 - b.t0) * ppy > 70" class="absolute left-2 top-1/2 -translate-y-1/2 truncate whitespace-nowrap text-[10px] font-bold leading-none text-white" :style="{ maxWidth: (b.t1 - b.t0) * ppy - 12 + 'px' }">{{ KIND[b.kind].label }}</span>
              </button>
              <!-- точка -->
              <button v-else class="beat dot absolute top-[5px] grid h-[14px] w-[14px] -translate-x-1/2 place-items-center rounded-full text-[8px] font-bold text-white" :class="state(b)"
                :style="{ left: x(b.t0) + 'px', '--c': KIND[b.kind].c }" :title="b.title" @click="st.seekBeat(b)">{{ KIND[b.kind].icon }}</button>
            </template>
          </div>
          <!-- курсор времени -->
          <div class="pointer-events-none absolute inset-y-0 w-0.5 bg-accent" :style="{ left: x(s.t) + 'px' }"></div>
        </div>
        <!-- имена -->
        <div class="pointer-events-none absolute left-0 top-0 z-10 bg-gradient-to-r from-white via-white/95 to-transparent" :style="{ width: NAME_W + 'px', height: lanes.length * LANE_H + 'px' }">
          <div v-for="(l, i) in lanes" :key="l.id" class="absolute left-3 truncate text-xs font-bold"
            :class="st.current.value.some(b => b.people.includes(l.id)) ? 'opacity-100' : 'opacity-60'"
            :style="{ top: i * LANE_H + 4 + 'px', maxWidth: NAME_W - 24 + 'px', color: lineColor(l.p.line).fg }">{{ l.p.given }} {{ l.p.surname }}</div>
        </div>
      </div>
    </div>

    <!-- обзор всех лет -->
    <div ref="ov" class="relative mx-4 mb-3 mt-2 h-5 cursor-pointer touch-none rounded-full bg-page"
      @pointerdown="ovDown" @pointermove="ovMove" @pointerup="ovDrag = false" @pointercancel="ovDrag = false">
      <div class="absolute inset-y-0 rounded-full bg-accent/10 ring-1 ring-accent/30" :style="{ left: ox(vStart) + '%', width: (WINDOW / (span.b - span.a)) * 100 + '%' }"></div>
      <i v-for="b in st.beats" :key="b.i" class="absolute top-1/2 h-2 w-[3px] -translate-y-1/2 rounded-full" :style="{ left: ox(b.t0) + '%', background: KIND[b.kind].c, opacity: b.t0 <= s.t ? 1 : .35 }"></i>
      <div class="absolute -top-0.5 h-6 w-1 -translate-x-1/2 rounded-full bg-accent shadow" :style="{ left: ox(s.t) + '%' }"></div>
      <span class="absolute -bottom-0.5 left-2 font-mono text-[10px] leading-none text-soft">{{ span.a }}</span>
      <span class="absolute -bottom-0.5 right-2 font-mono text-[10px] leading-none text-soft">{{ span.b }}</span>
    </div>
  </div>
</template>

<style scoped>
.ctl { @apply grid h-8 w-8 place-items-center rounded-full text-sm text-ink hover:bg-accent-soft hover:text-accent; }
.beat { background: var(--c); transition: opacity .2s, box-shadow .2s, transform .2s; }
.beat.future { opacity: .3; }
.beat.past { opacity: .6; }
.beat.live { opacity: .95; }
.beat.cur { opacity: 1; box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 30%, transparent); }
.beat.dot.cur { transform: translateX(-50%) scale(1.35); }
.beat:hover { opacity: 1; }
.scene-enter-active { transition: opacity .35s ease, transform .35s ease; }
.scene-enter-from { opacity: 0; transform: translateY(6px); }
.scene-leave-active { display: none; }
</style>
