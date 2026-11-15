<script setup>
// Блок «На разбор» в карточке человека (только dev-режим).
import { ref, computed } from 'vue'
import { person, fullName } from '../store'
import { inbox, KINDS, add, edit, remove } from '../devComments'

const props = defineProps({ pid: String })
const mine = computed(() => inbox.list.filter(c => c.person === props.pid))

const text = ref('')
const source = ref('')
const kind = ref('fact')
const busy = ref(false)
const err = ref('')
const editing = ref(null)

async function submit() {
  if (!text.value.trim()) return
  busy.value = true; err.value = ''
  try {
    if (editing.value) await edit(editing.value, { text: text.value, source: source.value, kind: kind.value })
    else await add({ person: props.pid, personName: fullName(person(props.pid)), text: text.value, source: source.value, kind: kind.value })
    text.value = ''; source.value = ''; editing.value = null
  } catch (e) { err.value = e.message } finally { busy.value = false }
}
function startEdit(c) { editing.value = c.id; text.value = c.text; source.value = c.source || ''; kind.value = c.kind }
function cancel() { editing.value = null; text.value = ''; source.value = '' }
async function del(c) {
  if (!confirm('Удалить комментарий?')) return
  try { await remove(c.id); if (editing.value === c.id) cancel() } catch (e) { err.value = e.message }
}
const when = (iso) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
function key(e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit() }
</script>

<template>
  <div class="mt-6 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 p-4">
    <div class="flex items-center justify-between">
      <p class="eyebrow !text-accent">На разбор</p>
      <span class="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-soft">только в dev-режиме</span>
    </div>

    <ul v-if="mine.length" class="mt-3 space-y-2">
      <li v-for="c in mine" :key="c.id" class="rounded-xl bg-white px-3 py-2 text-sm shadow-sm" :class="{ 'ring-2 ring-accent': editing === c.id }">
        <div class="flex items-center gap-2 text-[11px]">
          <span class="font-bold" :style="{ color: KINDS[c.kind]?.c }">{{ KINDS[c.kind]?.label || c.kind }}</span>
          <span class="text-soft">{{ when(c.created) }}</span>
          <span class="ml-auto flex gap-2">
            <button class="font-semibold text-soft hover:text-accent" @click="startEdit(c)">изменить</button>
            <button class="font-semibold text-soft hover:text-[#c2512f]" @click="del(c)">удалить</button>
          </span>
        </div>
        <p class="mt-0.5 whitespace-pre-line leading-snug">{{ c.text }}</p>
        <p v-if="c.source" class="mt-0.5 text-xs text-soft">Откуда: {{ c.source }}</p>
      </li>
    </ul>

    <div class="mt-3 flex flex-wrap gap-1">
      <button v-for="(k, id) in KINDS" :key="id" type="button" class="chip !px-2.5 !py-1 ring-1 transition"
        :class="kind === id ? 'text-white ring-transparent' : 'bg-white text-soft ring-black/10'"
        :style="kind === id ? { background: k.c } : {}" @click="kind = id">{{ k.label }}</button>
    </div>
    <textarea v-model="text" rows="3" class="mt-2 w-full resize-y rounded-xl border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-accent"
      placeholder="Что известно: даты, места, имена, истории… (Ctrl+Enter — сохранить)" @keydown="key"></textarea>
    <input v-model="source" class="mt-2 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-accent"
      placeholder="Откуда известно (необязательно): со слов бабушки, документ, фото…" @keydown="key">
    <div class="mt-2 flex items-center gap-3">
      <button class="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50" :disabled="busy || !text.trim()" @click="submit">
        {{ editing ? 'Сохранить' : 'Добавить' }}</button>
      <button v-if="editing" class="text-sm font-semibold text-soft hover:text-ink" @click="cancel">отмена</button>
      <span v-if="err || inbox.error" class="text-xs font-semibold text-[#c2512f]">{{ err || inbox.error }}</span>
    </div>
  </div>
</template>
