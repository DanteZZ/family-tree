import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Комментарии «на разбор»: только в dev-режиме. Пишутся в ../inbox/comments.json (папка дела),
// чтобы потом разобрать их в реестры и family.json и очистить.
const INBOX = fileURLToPath(new URL('../inbox/comments.json', import.meta.url))

function readInbox() {
  try { return JSON.parse(fs.readFileSync(INBOX, 'utf8')) } catch { return [] }
}
function writeInbox(list) {
  fs.mkdirSync(path.dirname(INBOX), { recursive: true })
  const tmp = INBOX + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, INBOX)
}
function body(req) {
  return new Promise((ok, fail) => {
    let s = ''
    req.on('data', c => { s += c; if (s.length > 200_000) req.destroy() })
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}) } catch (e) { fail(e) } })
    req.on('error', fail)
  })
}

function commentsInbox() {
  return {
    name: 'comments-inbox',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__comments', async (req, res) => {
        const send = (code, data) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)) }
        try {
          const url = new URL(req.url, 'http://x')
          if (req.method === 'GET') return send(200, readInbox())
          if (req.method === 'POST') {
            const b = await body(req)
            const text = String(b.text || '').trim()
            if (!text) return send(400, { error: 'пустой комментарий' })
            const item = {
              id: randomUUID().slice(0, 8),
              person: b.person || null,
              personName: b.personName || '',
              kind: b.kind || 'fact',
              text,
              source: String(b.source || '').trim(),
              created: new Date().toISOString(),
            }
            const list = readInbox(); list.push(item); writeInbox(list)
            return send(200, item)
          }
          if (req.method === 'PATCH') {
            const b = await body(req)
            const list = readInbox()
            const it = list.find(x => x.id === url.searchParams.get('id'))
            if (!it) return send(404, { error: 'не найден' })
            for (const k of ['text', 'kind', 'source']) if (k in b) it[k] = String(b[k]).trim()
            it.edited = new Date().toISOString()
            writeInbox(list)
            return send(200, it)
          }
          if (req.method === 'DELETE') {
            const id = url.searchParams.get('id')
            writeInbox(readInbox().filter(x => x.id !== id))
            return send(200, { ok: true })
          }
          send(405, { error: 'метод не поддерживается' })
        } catch (e) { send(500, { error: String(e.message || e) }) }
      })
    },
  }
}

// Собирает всё (JS, CSS, данные) в один dist/index.html
export default defineConfig({
  plugins: [vue(), viteSingleFile(), commentsInbox()],
  // assetsInlineLimit большой — фотографии тоже встраиваются в единый HTML
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 100_000_000 },
})
