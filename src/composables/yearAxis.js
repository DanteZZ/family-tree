// Общая горизонтальная шкала лет: колесо — зум вокруг курсора, перетаскивание — сдвиг.
// Видимый диапазон хранится в state.axis, поэтому вкладки «События» и «Годы жизни» его разделяют.
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { state } from '../store'

export const NOW = new Date().getFullYear()
export const ERAS = [
  { from: 1700, to: 1917.85, name: 'Российская империя', c: '#eef0fd' },
  { from: 1917.85, to: 1991.97, name: 'СССР', c: '#fdf0ec' },
  { from: 1991.97, to: 2100, name: 'Россия', c: '#ecf6f1' },
]
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100]

export function useYearAxis({ box, labelW, span, onEmptyClick }) {
  const width = ref(1000)
  const view = reactive(state.axis ? { ...state.axis } : { start: 1830, ppy: 8 })
  watch(view, v => { state.axis = { start: v.start, ppy: v.ppy } })

  const plotW = computed(() => Math.max(200, width.value - labelW))
  const x = (t) => (t - view.start) * view.ppy
  const end = computed(() => view.start + plotW.value / view.ppy)

  const step = computed(() => STEPS.find(s => s * view.ppy >= 64) || 100)
  const minor = computed(() => step.value >= 10 ? step.value / 5 : step.value >= 2 ? 1 : 0)
  const ticks = computed(() => {
    const out = []
    for (let y = Math.floor(view.start / step.value) * step.value; y <= end.value; y += step.value) out.push(y)
    return out
  })
  const minorTicks = computed(() => {
    if (!minor.value || minor.value * view.ppy < 8) return []
    const out = []
    for (let y = Math.floor(view.start / minor.value) * minor.value; y <= end.value; y += minor.value) if (y % step.value) out.push(y)
    return out
  })

  function clamp() {
    const s = span.value
    view.ppy = Math.min(220, Math.max(plotW.value / (s.max - s.min + 40), view.ppy))
    const visible = plotW.value / view.ppy
    view.start = Math.min(s.max - visible * 0.3, Math.max(s.min - visible * 0.7, view.start))
  }
  function zoomAt(px, f) {
    const t = view.start + px / view.ppy
    view.ppy *= f; clamp()
    view.start = t - px / view.ppy; clamp()
  }
  function fit() {
    view.ppy = plotW.value / (span.value.max - span.value.min)
    view.start = span.value.min
    clamp()
  }
  function onWheel(e) {
    e.preventDefault()
    const px = e.clientX - box.value.getBoundingClientRect().left - labelW
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { view.start += e.deltaX / view.ppy; clamp(); return }
    if (e.shiftKey) { view.start += e.deltaY / view.ppy; clamp(); return }
    zoomAt(Math.max(0, px), e.deltaY < 0 ? 1.15 : 1 / 1.15)
  }
  let drag = null
  // Тянуть можно и за «колбаски»/точки; клик после перетаскивания гасится
  function down(e) {
    if (e.button || e.target.closest('a,input')) return
    drag = { x: e.clientX, start: view.start, moved: false, onItem: !!e.target.closest('button'), id: e.pointerId }
  }
  function move(e) {
    if (!drag) return
    const dx = e.clientX - drag.x
    if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; box.value.setPointerCapture(drag.id) }
    if (drag.moved) { view.start = drag.start - dx / view.ppy; clamp() }
  }
  function up() {
    if (!drag) return
    if (drag.moved) {
      const kill = (ev) => { ev.stopPropagation(); ev.preventDefault() }
      box.value.addEventListener('click', kill, { capture: true, once: true })
      setTimeout(() => box.value?.removeEventListener('click', kill, true), 0)
    }
    else if (!drag.onItem) onEmptyClick?.()
    drag = null
  }

  let ro
  onMounted(() => {
    ro = new ResizeObserver(([en]) => { width.value = en.contentRect.width; clamp() })
    ro.observe(box.value)
    width.value = box.value.clientWidth
    if (!state.axis) fit(); else clamp()
  })
  onBeforeUnmount(() => ro && ro.disconnect())

  return { width, view, plotW, x, end, step, ticks, minorTicks, zoomAt, fit, clamp, onWheel, down, move, up }
}
