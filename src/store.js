// Все данные берутся из src/data/family.json. Чтобы дополнить древо —
// правим JSON и пересобираем (npm run build).
import { reactive, computed } from 'vue'
import data from './data/family.json'

export { data }

export const state = reactive({
  focus: data.meta.root,
  selected: data.meta.root,
  upGens: 9,
  downGens: 2,
  mapPerson: null,
  hiddenLines: {},
  axis: null,      // общий видимый диапазон лет для вкладок хронологии
  treeMode: (() => { try { return localStorage.getItem('treeMode') || 'direct' } catch { return 'direct' } })(), // direct | all
  panelOpen: typeof window === 'undefined' || window.innerWidth > 900,
})

export function select(id) { state.selected = id; state.panelOpen = true }

/* ---------- фотографии: файлы из src/data/photos, имя указывается в поле "photo" ---------- */
const photoFiles = import.meta.glob('./data/photos/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' })
export const photoOf = (p) => p?.photo ? photoFiles[`./data/photos/${p.photo}`] || null : null

/* ---------- запросы ---------- */
const byId = Object.fromEntries(data.people.map(p => [p.id, p]))
export const person = (id) => byId[id] || null

// Люди без единой связи (место в древе ещё не установлено)
export const unplaced = data.people.filter(p =>
  !p.father && !p.mother && !(p.spouses || []).length &&
  !data.people.some(q => q.father === p.id || q.mother === p.id || (q.spouses || []).includes(p.id)))

export function childrenOf(id) {
  return data.people
    .filter(p => p.father === id || p.mother === id)
    .sort((a, b) => yearOf(a.birth?.date) - yearOf(b.birth?.date))
}
export function spousesOf(id) {
  const p = person(id); if (!p) return []
  const set = new Set(p.spouses || [])
  data.people.forEach(q => { if ((q.spouses || []).includes(id)) set.add(q.id) })
  childrenOf(id).forEach(c => { const other = c.father === id ? c.mother : c.father; if (other) set.add(other) })
  set.delete(id)
  return [...set].map(person).filter(Boolean)
}
export function siblingsOf(id) {
  const p = person(id); if (!p || (!p.father && !p.mother)) return []
  return data.people.filter(q => q.id !== id && ((p.father && q.father === p.father) || (p.mother && q.mother === p.mother)))
}

/* ---------- форматирование ---------- */
export function yearOf(d) {
  const m = String(d || '').match(/\d{4}/); return m ? +m[0] : 9999
}
export function fmtDate(d) {
  if (!d) return ''
  const s = String(d)
  if (s.startsWith('~')) return 'ок. ' + s.slice(1)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${+m[3]}.${m[2]}.${m[1]}`
  const ym = s.match(/^(\d{4})-(\d{2})$/)
  if (ym) return `${ym[2]}.${ym[1]}`
  return s
}
function yearLabel(d) {
  if (!d) return ''
  const y = (String(d).match(/\d{4}/) || [''])[0]
  return (String(d).startsWith('~') ? '~' : '') + y
}
export function lifespan(p) {
  const by = yearLabel(p.birth?.date), dy = yearLabel(p.death?.date)
  if (by && dy) return `${by}–${dy}`
  if (by) return p.living || !p.death ? `р. ${by}` : `${by}–?`
  if (dy) return `?–${dy}`
  if (p.death) return '†'
  return ''
}
export function fullName(p) {
  if (!p) return ''
  return [p.surname, p.given, p.patronymic].filter(Boolean).join(' ') || '?'
}

export const STATUS = {
  doc:    { label: 'По документам', short: 'документ', dot: '#22a06b', bg: '#e6f6ee', fg: '#167a51' },
  memory: { label: 'Со слов семьи', short: 'со слов',  dot: '#e0a31a', bg: '#fdf4dd', fg: '#94680a' },
  hypo:   { label: 'Гипотеза',      short: 'гипотеза', dot: '#e05a7a', bg: '#fde8ee', fg: '#b03456' },
  unk:    { label: 'Неизвестно',    short: 'неизв.',   dot: '#a3a9b8', bg: '#eff1f5', fg: '#6b7185' },
}

// Мягкие цвета для родовых линий (аватар с инициалами)
export const LINE_COLORS = {
  zakh: { bg: '#e8ecff', fg: '#3f51c4' },
  kan:  { bg: '#ffeae4', fg: '#c2512f' },
  kol:  { bg: '#f1e8ff', fg: '#7b45c7' },
  trof: { bg: '#e2f4fb', fg: '#1d7fa6' },
  fam:  { bg: '#fff2d6', fg: '#a56a00' },
  fir:  { bg: '#fde8f1', fg: '#b03a72' },
  kuk:  { bg: '#e3f6ec', fg: '#23855a' },
  pam:  { bg: '#eef5dd', fg: '#5f7a12' },
}
export const lineColor = (l) => LINE_COLORS[l] || { bg: '#eff1f5', fg: '#6b7185' }
export const initials = (p) => ((p.given || '?')[0] + (p.surname || '')[0] || '').replace('undefined', '')

/* ---------- хронология: события людей + отдельные события ---------- */
export const timeline = computed(() => {
  const ev = []
  data.people.forEach(p => {
    const name = [p.given, p.patronymic, p.maiden || p.surname].filter(Boolean).join(' ')
    const src = (p.sources || [])[0]
    const ref = src ? { url: src.url, source: src.url ? null : src.title } : {}
    if (p.birth?.date) ev.push({ date: p.birth.date, title: `Рождение: ${name}`, text: p.birth.place || '', line: p.line, status: p.status, person: p.id, ...ref })
    if (p.death?.date) ev.push({ date: p.death.date, title: `Смерть: ${name}`, text: p.death.place || '', line: p.line, status: p.status, person: p.id, ...ref })
  })
  ;(data.events || []).forEach(e => ev.push(e))
  return ev.sort((a, b) => String(a.date).replace('~', '').localeCompare(String(b.date).replace('~', '')))
})

/* ---------- годы жизни: известные и оценённые ---------- */
// Дробный год из строки вида 1913, 1913-02, 1913-02-02, ~1892
export function toYear(d) {
  const s = String(d || '').replace('~', '')
  const m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)
  if (!m) return null
  return +m[1] + (m[2] ? (+m[2] - 1) / 12 : 0.5) + (m[3] ? (+m[3] - 1) / 365 : 0)
}
const NOW_Y = new Date().getFullYear() + new Date().getMonth() / 12
const GEN = 27 // примерная разница поколений
// Для каждого человека: b, e — начало и конец «колбаски»; bA/eA — оценка, а не дата
export const lifeSpans = (() => {
  const out = {}
  data.people.forEach(p => {
    const b = toYear(p.birth?.date), e = toYear(p.death?.date)
    out[p.id] = {
      b, e,
      bA: !b || String(p.birth?.date).startsWith('~'),
      eA: !e ? !p.living : String(p.death?.date).startsWith('~'),
    }
  })
  // оценка дат рождения по родственникам, несколько проходов
  for (let pass = 0; pass < 8; pass++) {
    data.people.forEach(p => {
      const s = out[p.id]; if (s.b) return
      const kids = childrenOf(p.id).map(c => out[c.id].b).filter(Boolean)
      const pars = [p.father, p.mother].map(id => id && out[id]?.b).filter(Boolean)
      const sps = spousesOf(p.id).map(q => out[q.id].b).filter(Boolean)
      if (kids.length) s.b = Math.min(...kids) - GEN
      else if (pars.length) s.b = Math.max(...pars) + GEN
      else if (sps.length) s.b = sps[0]
      else if (s.e) s.b = s.e - 55
    })
  }
  data.people.forEach(p => {
    const s = out[p.id]; if (!s.b) return
    if (!s.e) s.e = p.living ? NOW_Y : Math.min(s.b + 70, NOW_Y)
    if (s.e - s.b < 0.3) s.e = s.b + 0.3
  })
  return out
})()

// Где человек находился в данный год: последняя точка передвижений не позже года
export function placeAt(p, year) {
  const ms = (p.moves || []).filter(m => toYear(m.date) <= year + 0.999)
  return ms.length ? ms[ms.length - 1] : null
}
