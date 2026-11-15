// Раскладка «Поколения»: все связанные люди по слоям-поколениям.
// Поколение считается обходом в ширину от корня: родитель −1, ребёнок +1, супруг(а) — то же поколение.
// Порядок внутри слоя — барицентрический (Сугияма): семьи тянутся друг к другу.
import { data, person, spousesOf, yearOf } from './store'

export const SLOT = 228      // ширина места под карточку (карточка 208 + зазор)
export const CARD_W = 208
export const CARD_H = 122
export const ROW = 210       // шаг между слоями

const kidsOf = {}
data.people.forEach(p => [p.father, p.mother].forEach(x => { if (x) (kidsOf[x] ||= []).push(p.id) }))
const parentsOf = (id) => { const p = person(id); return [p?.father, p?.mother].filter(x => x && person(x)) }
const spouseIds = (id) => spousesOf(id).map(s => s.id)

export function layoutGenerations(root) {
  // 1. поколения
  const gen = new Map([[root, 0]]), order = [root], q = [root]
  while (q.length) {
    const c = q.shift(), g = gen.get(c)
    const nb = [...parentsOf(c).map(x => [x, g - 1]), ...spouseIds(c).map(x => [x, g]), ...(kidsOf[c] || []).map(x => [x, g + 1])]
    for (const [x, gx] of nb) if (!gen.has(x)) { gen.set(x, gx); order.push(x); q.push(x) }
  }

  // 2. семейные блоки: супруги одного поколения стоят рядом
  const unitOf = new Map(), units = []
  for (const id of order) {
    if (unitOf.has(id)) continue
    const u = [], st = [id]
    while (st.length) {
      const c = st.pop(); if (unitOf.has(c)) continue
      unitOf.set(c, u); u.push(c)
      spouseIds(c).forEach(s => { if (gen.get(s) === gen.get(c) && !unitOf.has(s)) st.push(s) })
    }
    // у кого несколько супругов — в середину; иначе муж слева
    u.sort((a, b) => (person(a).sex === 'f') - (person(b).sex === 'f'))
    if (u.length > 2) {
      const hub = u.reduce((m, x) => spouseIds(x).length > spouseIds(m).length ? x : m, u[0])
      u.splice(u.indexOf(hub), 1); u.splice(Math.floor(u.length / 2), 0, hub)
    }
    units.push({ ids: u, g: gen.get(id) })
  }

  // 3. начальный порядок — обход в глубину от корня (родня кучкуется)
  const seen = new Set(), dfsIdx = new Map(); let k = 0
  const dfs = (id) => {
    if (seen.has(id)) return; seen.add(id)
    const u = unitOf.get(id); if (!dfsIdx.has(u)) dfsIdx.set(u, k++)
    ;[...parentsOf(id), ...spouseIds(id), ...(kidsOf[id] || []).slice().sort((a, b) => yearOf(person(a).birth?.date) - yearOf(person(b).birth?.date))].forEach(dfs)
  }
  dfs(root)
  const rows = new Map()
  units.forEach(u => (rows.get(u.g) || rows.set(u.g, []).get(u.g)).push(u))
  rows.forEach(r => r.sort((a, b) => dfsIdx.get(a.ids) - dfsIdx.get(b.ids)))

  // 4. координаты: сначала плотно, затем подтягиваем к связанным людям в соседних слоях
  const x = new Map()
  const place = (r) => { let cx = 0; r.forEach(u => { u.ids.forEach((id, i) => x.set(id, cx + i * SLOT)); u.x = cx; cx += u.ids.length * SLOT + 24 }) }
  rows.forEach(place)
  const gens = [...rows.keys()].sort((a, b) => a - b)
  const links = (u, dir) => u.ids.flatMap(id => dir < 0 ? parentsOf(id) : (kidsOf[id] || [])).filter(o => gen.get(o) === u.g + dir)
  for (let it = 0; it < 10; it++) {
    const seq = it % 2 ? [...gens].reverse() : gens
    for (const g of seq) {
      const r = rows.get(g)
      r.forEach(u => {
        const nb = [...links(u, -1), ...links(u, +1)]
        const w = (u.ids.length - 1) * SLOT
        u.want = nb.length ? nb.reduce((s, o) => s + x.get(o), 0) / nb.length - w / 2 : u.x
      })
      // переупорядочивание по желаемой позиции (барицентр)
      r.sort((a, b) => a.want - b.want)
      // без наложений: слева направо, затем справа налево, усредняем
      const L = [], R = []
      let edge = -Infinity
      r.forEach((u, i) => { L[i] = Math.max(u.want, edge); edge = L[i] + u.ids.length * SLOT + 24 })
      edge = Infinity
      for (let i = r.length - 1; i >= 0; i--) { const u = r[i]; R[i] = Math.min(u.want, edge - u.ids.length * SLOT - 24); edge = R[i] }
      edge = -Infinity
      r.forEach((u, i) => {
        u.x = Math.max((L[i] + R[i]) / 2, edge)
        edge = u.x + u.ids.length * SLOT + 24
        u.ids.forEach((id, j) => x.set(id, u.x + j * SLOT))
      })
    }
  }
  const minX = Math.min(...x.values())
  x.forEach((v, id) => x.set(id, v - minX))

  // 5. итог: карточки, слои, связи (дети — выше родителей)
  const maxG = Math.max(...gens), minG = Math.min(...gens)
  const yOf = (g) => (maxG - g) * ROW
  const nodes = [...x.entries()].map(([id, cx]) => ({ id, x: cx, y: yOf(gen.get(id)), g: gen.get(id) }))
  const at = Object.fromEntries(nodes.map(n => [n.id, n]))

  // семьи: пара родителей → дети
  const fam = new Map()
  nodes.forEach(n => {
    const ps = parentsOf(n.id).filter(p => at[p] && at[p].g === n.g - 1)
    if (!ps.length) return
    const key = ps.slice().sort().join('+')
    ;(fam.get(key) || fam.set(key, { ps, kids: [] }).get(key)).kids.push(n.id)
  })
  const paths = []; let fi = 0
  fam.forEach(({ ps, kids }) => {
    const px = ps.reduce((s, p) => s + at[p].x + CARD_W / 2, 0) / ps.length
    const pTop = at[ps[0]].y
    const kBottom = at[kids[0]].y + CARD_H
    const bar = kBottom + (pTop - kBottom) * (0.3 + 0.4 * ((fi++ * 0.37) % 1))
    const xs = kids.map(c => at[c].x + CARD_W / 2)
    let d = `M${px},${pTop} V${bar} `
    d += `M${Math.min(px, ...xs)},${bar} H${Math.max(px, ...xs)} `
    xs.forEach(cx => { d += `M${cx},${bar} V${kBottom} ` })
    paths.push(d)
  })
  // супруги рядом — короткая перемычка
  const marriages = []
  units.forEach(u => { for (let i = 0; i + 1 < u.ids.length; i++) {
    const a = at[u.ids[i]], b = at[u.ids[i + 1]]
    marriages.push({ x1: a.x + CARD_W, x2: b.x, y: a.y + CARD_H / 2 })
  } })

  const width = Math.max(...nodes.map(n => n.x)) + CARD_W
  const height = (maxG - minG) * ROW + CARD_H
  return { nodes, paths, marriages, gen, gens, yOf, width, height }
}

// Подпись слоя относительно выбранного: d = поколение слоя − поколение выбранного
export function genLabel(d) {
  if (d === 0) return 'Поколение выбранного: братья, сёстры, супруги, двоюродные'
  if (d === -1) return 'Родители, дяди и тёти'
  if (d === -2) return 'Бабушки и дедушки'
  if (d < -2) return 'пра'.repeat(-d - 2) + 'деды и ' + 'пра'.repeat(-d - 2) + 'бабушки'
  if (d === 1) return 'Дети и племянники'
  if (d === 2) return 'Внуки'
  return 'пра'.repeat(d - 2) + 'внуки'
}
