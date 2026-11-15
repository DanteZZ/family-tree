// Проигрыватель семейной истории: сюжет из data.story разбит на ключевые кадры (даты).
// На каждом кадре — пауза-«сцена» (карточка, анимация переезда), между кадрами время бежит с ускорением.
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { data, toYear } from '../store'

export const KIND = {
  birth:    { label: 'Рождение', icon: '✶', c: '#22a06b' },
  marriage: { label: 'Свадьба',  icon: '♥', c: '#d14d8a' },
  move:     { label: 'Переезд',  icon: '➜', c: '#4f63d8' },
  war:      { label: 'Война',    icon: '★', c: '#c2512f' },
  event:    { label: 'Событие',  icon: '!', c: '#c48a0a' },
  death:    { label: 'Утрата',   icon: '†', c: '#6b7185' },
}

export function useStory() {
  const beats = (data.story || []).map((b, i) => {
    const t0 = toYear(b.from)
    return { ...b, i, t0, t1: b.to ? toYear(b.to) : t0, kind: KIND[b.kind] ? b.kind : 'event' }
  }).sort((a, b) => a.t0 - b.t0)

  // ключевые кадры — уникальные даты начала
  const frames = []
  beats.forEach(b => {
    const last = frames[frames.length - 1]
    if (last && Math.abs(last.t - b.t0) < 0.002) last.beats.push(b)
    else frames.push({ t: b.t0, beats: [b] })
  })
  beats.forEach(b => { b.frame = frames.findIndex(f => f.beats.includes(b)) })

  const s = reactive({ k: 0, phase: 'dwell', elapsed: 0, t: frames[0]?.t || 1900, from: 0, playing: false, speed: 1 })

  const dwellMs = (k) => {
    const f = frames[k]; if (!f) return 0
    const text = f.beats.reduce((n, b) => n + (b.text?.length || 0) + b.title.length, 0)
    const move = f.beats.some(b => b.kind === 'move' && b.fromPlace)
    return Math.min(9000, Math.max(move ? 4200 : 2600, 1500 + text * 28))
  }
  const travelMs = (a, b) => Math.min(2600, Math.max(450, (b - a) * 240))
  const ease = (x) => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2

  // кадр rAF
  let raf = 0, last = 0
  function tick(now) {
    const dt = last ? Math.min(100, now - last) * s.speed : 0
    last = now
    if (s.phase === 'dwell') {
      const D = dwellMs(s.k)
      if (s.elapsed < D) s.elapsed = Math.min(D, s.elapsed + dt)   // анимация сцены доигрывается и на паузе
      else if (s.playing) {
        if (s.k >= frames.length - 1) s.playing = false
        else { s.phase = 'travel'; s.from = s.t; s.elapsed = 0 }
      }
    } else if (s.playing) {
      const to = frames[s.k + 1]?.t
      if (to == null) { s.playing = false }
      else {
        const T = travelMs(s.from, to)
        s.elapsed += dt
        if (s.elapsed >= T) { s.k++; s.t = to; s.phase = 'dwell'; s.elapsed = 0 }
        else s.t = s.from + (to - s.from) * ease(s.elapsed / T)
      }
    }
    raf = requestAnimationFrame(tick)
  }
  onMounted(() => { raf = requestAnimationFrame(tick) })
  onBeforeUnmount(() => cancelAnimationFrame(raf))

  function goFrame(k, full = false) {
    s.k = Math.max(0, Math.min(frames.length - 1, k))
    s.t = frames[s.k].t; s.phase = 'dwell'; s.elapsed = full ? dwellMs(s.k) : 0
  }
  function play() {
    if (s.k >= frames.length - 1 && s.phase === 'dwell' && s.elapsed >= dwellMs(s.k)) goFrame(0)
    s.playing = true
  }
  const pause = () => { s.playing = false }
  const toggle = () => (s.playing ? pause() : play())
  const next = () => goFrame(s.phase === 'dwell' ? s.k + 1 : s.k + 1)
  const prev = () => goFrame(s.phase === 'dwell' && s.elapsed < 600 ? s.k - 1 : s.k)
  const seekBeat = (b) => goFrame(b.frame)
  // свободная перемотка: время между кадрами, сцены нет
  function scrub(t) {
    s.playing = false
    const min = frames[0].t, max = frames[frames.length - 1].t
    s.t = Math.max(min, Math.min(max, t))
    let k = 0
    while (k < frames.length - 1 && frames[k + 1].t <= s.t + 1e-6) k++
    s.k = k
    if (Math.abs(frames[k].t - s.t) < 0.05) { s.t = frames[k].t; s.phase = 'dwell'; s.elapsed = dwellMs(k) }
    else { s.phase = 'travel'; s.from = s.t; s.elapsed = 0 }
  }

  const current = computed(() => s.phase === 'dwell' ? frames[s.k]?.beats || [] : [])
  const progress = computed(() => s.phase === 'dwell' ? Math.min(1, s.elapsed / Math.max(1, dwellMs(s.k) * 0.6)) : 1)
  const ongoing = computed(() => beats.filter(b => b.t1 > b.t0 && b.t0 <= s.t && b.t1 >= s.t && !current.value.includes(b)))

  return { beats, frames, s, current, ongoing, progress, play, pause, toggle, next, prev, seekBeat, scrub, goFrame }
}
