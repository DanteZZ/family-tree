<script setup>
// «Передвижения»: карта мест из поля moves у людей (координаты примерные — по центру села/района).
// Режим «Все пути» — дуги переездов; режим «История» — проигрывание сюжета data.story
// с перелётами камеры, анимацией переездов и нижней дорожкой событий.
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { state, data, person, fullName, fmtDate, lineColor, lifespan, lifeSpans, placeAt } from '../store'
import { useStory, KIND } from '../composables/story'
import StoryBar from './StoryBar.vue'

const emit = defineEmits(['open'])
const el = ref(null)
const bar = ref(null)
let map, layer, baseLayer, sceneLayer, liveLayer

const mode = ref(state.mapPerson ? 'paths' : 'story')
const st = useStory()
const ss = st.s

const travellers = computed(() => data.people
  .filter(p => p.moves?.length && !state.hiddenLines[p.line])
  .sort((a, b) => (lifeSpans[a.id]?.b || 9999) - (lifeSpans[b.id]?.b || 9999)))
const sel = computed(() => state.mapPerson && person(state.mapPerson))

const P = (k) => data.places[k]
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const short = (k) => esc(P(k).name.split(' (')[0].split(',')[0])

// дуга между двумя точками, чтобы переезды не сливались в прямые
function arc(a, b, n = 24) {
  const [la1, lo1] = a, [la2, lo2] = b
  const dx = lo2 - lo1, dy = la2 - la1, dist = Math.hypot(dx, dy)
  if (dist < 0.05) return [a, b]
  const k = Math.min(0.22, 0.6 / Math.sqrt(dist))
  const cx = (lo1 + lo2) / 2 - dy * k, cy = (la1 + la2) / 2 + dx * k
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    pts.push([u * u * la1 + 2 * u * t * cy + t * t * la2, u * u * lo1 + 2 * u * t * cx + t * t * lo2])
  }
  return pts
}
const ll = (k) => [P(k).lat, P(k).lon]
const icon = (html, cls, c) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="${cls}" style="--c:${c}">${html}</div>` })

/* ================= режим «Все пути» ================= */
function drawPaths() {
  layer.clearLayers()
  const bounds = []
  const byPlace = {}
  travellers.value.forEach(p => {
    const isSel = sel.value?.id === p.id
    const dim = sel.value && !isSel
    const c = lineColor(p.line).fg
    const ms = p.moves.filter(m => P(m.place))
    ms.forEach(m => (byPlace[m.place] ||= []).push({ p, m }))
    for (let i = 1; i < ms.length; i++) {
      if (ms[i].place === ms[i - 1].place) continue
      const approx = ms[i].approx || P(ms[i].place).approx
      L.polyline(arc(ll(ms[i - 1].place), ll(ms[i].place)), {
        color: c, weight: isSel ? 4 : 2.5, opacity: dim ? 0.12 : isSel ? 0.95 : 0.55,
        dashArray: approx ? '6 7' : null, lineCap: 'round', interactive: false,
      }).addTo(layer)
    }
    if (isSel) {
      const seen = {}
      ms.forEach((m, i) => { (seen[m.place] ||= []).push(i + 1) })
      Object.entries(seen).forEach(([k, nums]) => {
        L.marker(ll(k), { icon: icon(nums.join(','), 'mv-pin', c), zIndexOffset: 1000 })
          .bindPopup(popup(k, ms.filter(m => m.place === k).map(m => ({ p, m })))).addTo(layer)
        bounds.push(ll(k))
      })
    }
  })
  Object.entries(byPlace).forEach(([k, list]) => {
    const people = new Set(list.map(x => x.p.id))
    const c = lineColor(list[0].p.line).fg
    const has = !sel.value || people.has(sel.value.id)
    L.circleMarker(ll(k), {
      radius: 4 + Math.min(10, people.size * 1.3), color: '#fff', weight: 2,
      fillColor: c, fillOpacity: has ? 0.85 : 0.25, opacity: has ? 1 : 0.4,
    }).bindTooltip(short(k) + ` · ${people.size}`, { direction: 'top', offset: [0, -6] })
      .bindPopup(popup(k, list)).addTo(layer)
    if (!sel.value) bounds.push(ll(k))
  })
  if (bounds.length) map.fitBounds(bounds, { padding: [50, 50], maxZoom: sel.value ? 8 : 6, animate: true })
}

function popup(k, list) {
  const pl = P(k)
  const rows = list.map(({ p, m }) =>
    `<li><button data-id="${p.id}" style="color:${lineColor(p.line).fg}">${esc(fullName(p))}</button>` +
    `<span>${esc(fmtDate(m.date))}${m.note ? ' — ' + esc(m.note) : ''}</span></li>`).join('')
  return `<div class="mv-pop"><b>${esc(pl.name)}</b>${pl.approx ? '<em>точка на карте примерная</em>' : ''}<ul>${rows}</ul></div>`
}

/* ================= режим «История» ================= */
// фон: кто где жил в текущий год (бледные метки)
function drawBase() {
  baseLayer.clearLayers()
  const y = Math.floor(ss.t), byPlace = {}
  travellers.value.forEach(p => {
    const s = lifeSpans[p.id]; if (!s?.b || s.b > y + 1 || s.e < y) return
    const m = placeAt(p, y); if (!m || !P(m.place)) return
    ;(byPlace[m.place] ||= []).push({ p, m })
  })
  Object.entries(byPlace).forEach(([k, list]) => {
    const c = lineColor(list[0].p.line).fg
    L.marker(ll(k), { icon: icon(list.length, 'mv-pin is-soft', c) })
      .bindTooltip(`${short(k)}: ${list.map(x => esc(x.p.given)).join(', ')}`, { direction: 'top', offset: [0, -12] })
      .bindPopup(popup(k, list)).addTo(baseLayer)
  })
}

// сцена: события текущего кадра
let anims = []
const who = (b) => b.people.map(person).filter(Boolean)
const tag = (b) => who(b).map(p => esc(p.given)).join(', ')
function drawScene(fly) {
  sceneLayer.clearLayers(); anims = []
  const pts = []
  st.current.value.forEach(b => {
    const K = KIND[b.kind]
    if (b.fromPlace && b.place && P(b.fromPlace) && P(b.place)) {
      const path = arc(ll(b.fromPlace), ll(b.place), 80)
      L.polyline(path, { color: K.c, weight: 2, opacity: 0.35, dashArray: '4 8', interactive: false }).addTo(sceneLayer)
      const line = L.polyline([path[0]], { color: K.c, weight: 4.5, opacity: 0.95, lineCap: 'round', interactive: false }).addTo(sceneLayer)
      L.marker(path[0], { icon: icon('', 'mv-dot', K.c) }).bindTooltip(short(b.fromPlace), { permanent: true, direction: 'left', className: 'mv-tip is-soft', offset: [-6, 0] }).addTo(sceneLayer)
      const dest = L.marker(path[path.length - 1], { icon: icon(K.icon, 'mv-beat', K.c), opacity: 0 })
        .bindTooltip(short(b.place), { permanent: true, direction: 'right', className: 'mv-tip', offset: [12, 0] }).addTo(sceneLayer)
      const trav = L.marker(path[0], { icon: icon(who(b).map(p => esc(p.given[0])).join(''), 'mv-trav', K.c), zIndexOffset: 2000 })
        .bindTooltip(tag(b), { permanent: true, direction: 'top', className: 'mv-tip', offset: [0, -16] }).addTo(sceneLayer)
      anims.push({ path, line, trav, dest })
      pts.push(path[0], path[path.length - 1])
    } else if (b.place && P(b.place)) {
      L.marker(ll(b.place), { icon: icon(`<i></i>${K.icon}`, 'mv-beat is-pulse', K.c), zIndexOffset: 1500 })
        .bindTooltip(`<b>${tag(b)}</b> · ${short(b.place)}`, { permanent: true, direction: 'right', className: 'mv-tip', offset: [14, 0] }).addTo(sceneLayer)
      pts.push(ll(b.place))
    }
  })
  animate()
  if (fly && pts.length) {
    const barH = (bar.value?.offsetHeight || 260) + 24
    const size = map.getSize()
    const pad = { paddingTopLeft: [60, 70], paddingBottomRight: [60, barH] }
    const cur = map.getZoom()
    if (pts.length === 1) {
      // если точка уже видна над панелью — камеру не дёргаем
      const cp = map.latLngToContainerPoint(pts[0])
      const visible = cp.x > 80 && cp.x < size.x - 80 && cp.y > 80 && cp.y < size.y - barH - 30
      if (!visible || cur < 4) {
        const z = Math.max(5, Math.min(6, cur))
        // центр сдвигаем вниз на половину панели, чтобы точка оказалась в свободной части карты
        const c = map.unproject(map.project(pts[0], z).add([0, barH / 2]), z)
        map.flyTo(c, z, { duration: 1.1 })
      }
    } else map.flyToBounds(pts, { ...pad, maxZoom: 6, duration: 1.3 })
  }
}
function animate() {
  const p = st.progress.value
  anims.forEach(a => {
    const n = Math.max(1, Math.round(p * (a.path.length - 1)))
    a.line.setLatLngs(a.path.slice(0, n + 1))
    a.trav.setLatLng(a.path[n])
    a.dest.setOpacity(p >= 1 ? 1 : 0)
  })
}
// идущие диапазоны (фронт, раскулачивание…) — маленькие метки
function drawLive() {
  liveLayer.clearLayers()
  st.ongoing.value.forEach(b => {
    if (!b.place || !P(b.place) || b.kind === 'move') return
    const K = KIND[b.kind]
    L.marker(ll(b.place), { icon: icon(K.icon, 'mv-beat is-small', K.c), zIndexOffset: 800 })
      .bindTooltip(`${tag(b)} — ${esc(b.title)}`, { direction: 'top', offset: [0, -10] }).addTo(liveLayer)
  })
}

function enterMode() {
  if (!map) return
  layer.clearLayers(); baseLayer.clearLayers(); sceneLayer.clearLayers(); liveLayer.clearLayers()
  if (mode.value === 'paths') { st.pause(); drawPaths() }
  else { drawBase(); drawScene(true); drawLive() }
}

onMounted(async () => {
  await nextTick()
  map = L.map(el.value, { zoomControl: false, worldCopyJump: true }).setView([52, 80], 3)
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© участники OpenStreetMap', maxZoom: 13, className: 'mv-tiles',
  }).addTo(map)
  layer = L.layerGroup().addTo(map)
  baseLayer = L.layerGroup().addTo(map)
  liveLayer = L.layerGroup().addTo(map)
  sceneLayer = L.layerGroup().addTo(map)
  map.on('popupopen', (e) => {
    e.popup.getElement().querySelectorAll('[data-id]').forEach(b => { b.onclick = () => showPerson(b.dataset.id) })
  })
  if (mode.value === 'story') map.fitBounds(Object.values(data.places).map(p => [p.lat, p.lon]), { paddingBottomRight: [0, 240] })
  enterMode()
})
onBeforeUnmount(() => { map && map.remove() })

watch(mode, enterMode)
watch([() => state.mapPerson, () => ({ ...state.hiddenLines })], () => {
  if (mode.value === 'paths') drawPaths(); else drawBase()
})
watch(() => Math.floor(ss.t), () => { if (mode.value === 'story') drawBase() })
watch(() => `${ss.k}|${ss.phase}`, () => { if (mode.value === 'story') drawScene(ss.phase === 'dwell') })
watch(st.progress, () => { if (mode.value === 'story') animate() })
watch(() => st.ongoing.value.map(b => b.i).join(), () => { if (mode.value === 'story') drawLive() })

function showPerson(id) { state.mapPerson = id; mode.value = 'paths' }
function openPerson(id) { state.selected = id; state.focus = id; state.panelOpen = true; emit('open') }
</script>

<template>
  <div class="relative flex min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-6">
    <!-- список людей (только в режиме путей) -->
    <aside v-if="mode === 'paths'" class="panel hidden w-72 shrink-0 flex-col overflow-hidden md:flex">
      <div v-if="sel" class="min-h-0 flex-1 overflow-y-auto p-5">
        <button class="link text-sm" @click="state.mapPerson = null">← все люди</button>
        <h3 class="mt-2 text-lg font-extrabold leading-snug">{{ fullName(sel) }}</h3>
        <p class="font-mono text-sm text-soft">{{ lifespan(sel) }}</p>
        <ol class="relative mt-4 space-y-3 border-l-2 border-dashed pl-5" :style="{ borderColor: lineColor(sel.line).fg + '40' }">
          <li v-for="(m, i) in sel.moves" :key="i" class="relative text-sm">
            <span class="absolute -left-[31px] top-0 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white shadow"
              :style="{ background: lineColor(sel.line).fg, opacity: m.approx ? .6 : 1 }">{{ i + 1 }}</span>
            <span class="font-mono text-xs font-semibold text-accent">{{ fmtDate(m.date) }}</span>
            <span class="block font-semibold">{{ data.places[m.place]?.name }}</span>
            <span v-if="m.note" class="block text-soft">{{ m.note }}</span>
          </li>
        </ol>
        <button class="mt-5 w-full rounded-full bg-accent py-2 text-sm font-bold text-white hover:opacity-90" @click="openPerson(sel.id)">Открыть в древе</button>
      </div>
      <div v-else class="min-h-0 flex-1 overflow-y-auto p-3">
        <p class="eyebrow px-2 pb-2 pt-1">{{ travellers.length }} человек с известными местами</p>
        <button v-for="p in travellers" :key="p.id"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent-soft"
          @click="state.mapPerson = p.id">
          <i class="h-2 w-2 shrink-0 rounded-full" :style="{ background: lineColor(p.line).fg }"></i>
          <span class="min-w-0 flex-1 truncate font-semibold">{{ p.given }} {{ p.patronymic }} {{ p.surname }}</span>
          <span class="font-mono text-[11px] text-soft">{{ p.moves.length }}</span>
        </button>
      </div>
    </aside>

    <div class="relative min-h-0 flex-1 overflow-hidden rounded-3xl shadow-card ring-1 ring-black/5">
      <div ref="el" class="absolute inset-0 bg-[#eef1f6]"></div>

      <div class="absolute left-3 top-3 z-[500] flex flex-wrap items-center gap-2">
        <div class="seg !shadow-card">
          <button :aria-pressed="mode === 'story'" @click="mode = 'story'">▶ История</button>
          <button :aria-pressed="mode === 'paths'" @click="mode = 'paths'">Все пути</button>
        </div>
      </div>

      <div v-if="mode === 'story'" ref="bar" class="pointer-events-none absolute inset-x-3 bottom-3 z-[600]">
        <StoryBar :st="st" @person="showPerson" />
      </div>
      <p v-else class="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[70%] rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-soft shadow-card">
        Координаты примерные; пунктир — переезд со слов или по косвенным данным</p>
    </div>
  </div>
</template>

<style>
.mv-pin { position: absolute; transform: translate(-50%, -50%); display: grid; place-items: center; min-width: 26px; height: 26px; padding: 0 7px;
  border-radius: 9999px; background: var(--c, #4f63d8); color: #fff; font: 700 12px/1 Manrope, 'Segoe UI', sans-serif; border: 2.5px solid #fff;
  box-shadow: 0 2px 8px rgba(31,36,51,.25); white-space: nowrap; transition: opacity .3s; }
.mv-pin.is-soft { min-width: 20px; height: 20px; padding: 0 5px; font-size: 10px; opacity: .55; border-width: 2px; }
.mv-pin.is-soft:hover { opacity: 1; }
.mv-dot { position: absolute; width: 10px; height: 10px; transform: translate(-50%, -50%); border-radius: 9999px; background: #fff; border: 3px solid var(--c); }
.mv-beat { position: absolute; transform: translate(-50%, -50%); display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9999px;
  background: var(--c); color: #fff; font: 800 14px/1 Manrope, 'Segoe UI', sans-serif; border: 3px solid #fff; box-shadow: 0 3px 12px rgba(31,36,51,.3); }
.mv-beat.is-small { width: 20px; height: 20px; font-size: 10px; border-width: 2px; opacity: .85; }
.mv-beat.is-pulse i { position: absolute; inset: -3px; border-radius: 9999px; border: 3px solid var(--c); animation: mv-ring 1.6s ease-out infinite; }
@keyframes mv-ring { from { transform: scale(1); opacity: .8; } to { transform: scale(2.6); opacity: 0; } }
.mv-trav { position: absolute; transform: translate(-50%, -50%); display: grid; place-items: center; min-width: 28px; height: 28px; padding: 0 6px;
  border-radius: 9999px; background: #fff; color: var(--c); font: 800 12px/1 Manrope, 'Segoe UI', sans-serif; border: 3px solid var(--c);
  box-shadow: 0 4px 14px rgba(31,36,51,.3); letter-spacing: .04em; }
.leaflet-tooltip.mv-tip { background: rgba(255,255,255,.95); border: 0; border-radius: 9999px; padding: 3px 10px; font: 600 12px/1.3 Manrope, sans-serif;
  color: #1f2433; box-shadow: 0 2px 8px rgba(31,36,51,.15); }
.leaflet-tooltip.mv-tip.is-soft { color: #6b7185; font-weight: 600; }
.leaflet-tooltip.mv-tip::before { display: none; }
.mv-pop b { display: block; font: 800 13px/1.3 Manrope, sans-serif; color: #1f2433; }
.mv-pop em { display: block; font-size: 11px; color: #6b7185; font-style: normal; margin-top: 2px; }
.mv-pop ul { margin: 8px 0 0; padding: 0; list-style: none; max-height: 220px; overflow: auto; }
.mv-pop li { margin: 0 0 6px; font: 500 12px/1.35 Manrope, sans-serif; color: #6b7185; }
.mv-pop li button { display: block; font-weight: 800; padding: 0; background: none; border: 0; cursor: pointer; text-align: left; }
.mv-pop li button:hover { text-decoration: underline; }
/* мягкая подложка в тон сайту */
.mv-tiles { filter: saturate(.45) brightness(1.06) contrast(.92); }
.leaflet-container { font-family: Manrope, 'Segoe UI', sans-serif; }
.leaflet-popup-content-wrapper { border-radius: 16px; box-shadow: 0 12px 28px rgba(31,36,51,.18); }
</style>
