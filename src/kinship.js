// Степень родства: кем человек `to` приходится человеку `from` («отец», «двоюродная бабушка», «брат жены»…).
import { computed } from 'vue'
import { state, person, spousesOf } from './store'

// Все предки человека: id → число поколений вверх (0 — сам человек).
function ancestors(id) {
  const out = new Map([[id, 0]]), q = [id]
  while (q.length) {
    const c = q.shift(), p = person(c), d = out.get(c)
    for (const x of [p?.father, p?.mother]) if (x && person(x) && !out.has(x)) { out.set(x, d + 1); q.push(x) }
  }
  return out
}

const PRA = (n) => 'пра'.repeat(Math.max(0, n))
const DEG = ['', 'двоюродн', 'троюродн', 'четвероюродн', 'пятиюродн', 'шестиюродн']
const deg = (n, f) => n <= 0 ? '' : (DEG[n] || `${n + 1}-юродн`) + (f ? 'ая ' : 'ый ')

function up(n, f) {          // предок на n поколений вверх
  if (n === 1) return f ? 'мать' : 'отец'
  if (n <= 5) return PRA(n - 2) + (f ? 'бабушка' : 'дедушка')
  return `предок в ${n}-м поколении`
}
function down(n, f) {        // потомок на n поколений вниз
  if (n === 1) return f ? 'дочь' : 'сын'
  if (n <= 5) return PRA(n - 2) + (f ? 'внучка' : 'внук')
  return `потомок в ${n}-м поколении`
}

// Кровное родство: a — поколений от `from` до общего предка, b — от `to`.
function blood(a, b, f, half) {
  if (a === 0) return down(b, f)
  if (b === 0) return up(a, f)
  if (a === 1 && b === 1) return (half ? (f ? 'сводная ' : 'сводный ') : '') + (f ? 'сестра' : 'брат')
  if (a === b) return deg(a - 1, f) + (f ? 'сестра' : 'брат')
  if (a > b) {                // ветвь старше: дяди, двоюродные деды…
    const diff = a - b, n = b - 1 + (diff >= 2 ? 1 : 0)
    const base = diff === 1 ? (f ? 'тётя' : 'дядя') : PRA(diff - 2) + (f ? 'бабушка' : 'дедушка')
    return deg(n, f) + base
  }
  const diff = b - a, n = a - 1  // ветвь младше: племянники
  const pre = diff === 1 ? '' : diff === 2 ? (f ? 'внучатая ' : 'внучатый ') : PRA(diff - 3) + (f ? 'правнучатая ' : 'правнучатый ')
  return deg(n, f) + pre + (f ? 'племянница' : 'племянник')
}

function bloodLabel(from, to) {
  const A = ancestors(from), B = ancestors(to)
  let best = null
  for (const [id, a] of A) if (B.has(id)) {
    const b = B.get(id)
    if (!best || a + b < best.a + best.b) best = { a, b, id }
  }
  if (!best) return null
  const t = person(to), f = t.sex === 'f'
  let half = false
  if (best.a === 1 && best.b === 1) {
    const s = person(from)
    const sameF = s.father && s.father === t.father, sameM = s.mother && s.mother === t.mother
    half = (sameF !== sameM) && !!(s.father && t.father && s.mother && t.mother)
  }
  return blood(best.a, best.b, f, half)
}

// Родительный падеж для подписей вида «брат жены», «жена двоюродного брата».
function gen(word) {
  const W = { мать: 'матери', дочь: 'дочери', отец: 'отца' }
  return word.split(' ').map(w => {
    if (W[w]) return W[w]
    const pra = w.match(/^((?:пра)*)(.*)$/), pre = pra[1], x = pra[2]
    if (W[x]) return pre + W[x]
    if (/ый$/.test(x)) return pre + x.slice(0, -2) + 'ого'
    if (/ая$/.test(x)) return pre + x.slice(0, -2) + 'ой'
    if (/я$/.test(x)) return pre + x.slice(0, -1) + 'и'
    if (/[кгхжшчщ]а$/.test(x)) return pre + x.slice(0, -1) + 'и'
    if (/а$/.test(x)) return pre + x.slice(0, -1) + 'ы'
    if (/[бвгджзклмнпрстфхцчшщ]$/.test(x)) return pre + x + 'а'
    return pre + x
  }).join(' ')
}

export function kinship(from, to) {
  if (!from || !to) return ''
  if (from === to) return 'выбран' + (person(to)?.sex === 'f' ? 'а' : '')
  const s = person(from), t = person(to)
  if (!s || !t) return ''
  const f = t.sex === 'f', sm = s.sex !== 'f'
  const b = bloodLabel(from, to)
  if (b) return b

  const spF = spousesOf(from).map(x => x.id)
  if (spF.includes(to)) return f ? 'жена' : 'муж'

  // родня супруга: тесть, свекровь, «брат жены»…
  for (const sp of spF) {
    const l = bloodLabel(sp, to)
    if (!l) continue
    if (l === 'отец') return sm ? 'тесть' : 'свёкор'
    if (l === 'мать') return sm ? 'тёща' : 'свекровь'
    if (l === 'сын' || l === 'дочь') return (f ? 'падчерица' : 'пасынок')
    return l + ' ' + (sm ? 'жены' : 'мужа')
  }
  // супруг(а) кровного родственника: зять, невестка, отчим, «жена двоюродного брата»…
  for (const r of spousesOf(to)) {
    const l = bloodLabel(from, r.id)
    if (!l) continue
    if (l === 'отец') return 'отчим'
    if (l === 'мать') return 'мачеха'
    if (l === 'сын') return 'невестка'
    if (l === 'дочь') return 'зять'
    return (f ? 'жена ' : 'муж ') + gen(l)
  }
  return ''
}

// Подписи относительно выбранного человека (state.selected), кэш на каждый выбор.
const cache = computed(() => { void state.selected; return new Map() })
export function kinOf(id) {
  const m = cache.value
  if (!m.has(id)) m.set(id, kinship(state.selected, id))
  return m.get(id)
}
