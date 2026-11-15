// Комментарии «на разбор» — работают только через dev-сервер (vite.config.js → /__comments).
import { reactive } from 'vue'

export const KINDS = {
  fact:     { label: 'Факт',        c: '#22a06b' },
  fix:      { label: 'Поправка',    c: '#c2512f' },
  lead:     { label: 'Зацепка',     c: '#4f63d8' },
  question: { label: 'Вопрос',      c: '#c48a0a' },
}

export const inbox = reactive({ list: [], loaded: false, error: '' })

async function call(method, url, data) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || r.statusText)
  return j
}
export async function load() {
  try { inbox.list = await call('GET', '/__comments'); inbox.error = '' } catch (e) { inbox.error = e.message }
  inbox.loaded = true
}
export async function add(c) { const it = await call('POST', '/__comments', c); inbox.list.push(it); return it }
export async function edit(id, c) {
  const it = await call('PATCH', '/__comments?id=' + encodeURIComponent(id), c)
  const i = inbox.list.findIndex(x => x.id === id); if (i >= 0) inbox.list[i] = it
}
export async function remove(id) {
  await call('DELETE', '/__comments?id=' + encodeURIComponent(id))
  inbox.list = inbox.list.filter(x => x.id !== id)
}
load()
