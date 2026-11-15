<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { state, data, person, fullName, fmtDate, STATUS, childrenOf, spousesOf, siblingsOf, lifespan, lineColor, initials, photoOf } from '../store'

const p = computed(() => person(state.selected))
const st = computed(() => STATUS[p.value?.status] || STATUS.unk)
const lc = computed(() => lineColor(p.value?.line))
const rel = computed(() => {
  const x = p.value; if (!x) return []
  const out = []
  const par = [person(x.father), person(x.mother)].filter(Boolean)
  if (par.length) out.push(['Родители', par])
  const sp = spousesOf(x.id); if (sp.length) out.push(['Супруг(а)', sp])
  const sib = siblingsOf(x.id); if (sib.length) out.push(['Братья и сёстры', sib])
  const ch = childrenOf(x.id); if (ch.length) out.push(['Дети', ch])
  return out
})
const julian = (d) => d?.calendar === 'julian' ? ' (ст. ст.)' : ''
defineEmits(['close'])
// форма комментариев «на разбор» — только при запуске через dev-сервер, в сборку не попадает
const DevComments = import.meta.env.DEV ? defineAsyncComponent(() => import('./DevComments.vue')) : null
function showOnMap() { state.mapPerson = p.value.id; location.hash = 'moves' }
</script>

<template>
  <aside v-if="p" class="panel relative min-h-0 overflow-y-auto p-6">
    <button class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg text-soft hover:bg-page hover:text-ink"
      aria-label="Скрыть сведения" @click="$emit('close')">×</button>
    <!-- фото или место под фото -->
    <img v-if="photoOf(p)" :src="photoOf(p)" :alt="fullName(p)" class="-mx-2 -mt-2 mb-5 max-h-80 w-[calc(100%+1rem)] rounded-2xl object-cover object-top">
    <div v-else class="-mx-2 -mt-2 mb-5 grid h-44 place-items-center rounded-2xl border-2 border-dashed text-center"
      :style="{ borderColor: lc.fg + '33', background: lc.bg + '80' }">
      <div>
        <span class="mx-auto grid h-16 w-16 place-items-center rounded-full text-xl font-bold" :style="{ background: lc.bg, color: lc.fg }">{{ initials(p) }}</span>
        <p class="mt-2 text-xs font-semibold text-soft">Место для фотографии</p>
      </div>
    </div>
    <div class="pr-6">
      <h2 class="text-xl font-extrabold leading-tight">{{ fullName(p) }}</h2>
      <p v-if="p.maiden" class="text-sm text-soft">урождённая {{ p.maiden }}</p>
      <p v-if="lifespan(p)" class="mt-0.5 font-mono text-sm text-soft">{{ lifespan(p) }}</p>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <span class="chip" :style="{ background: st.bg, color: st.fg }"><i class="h-1.5 w-1.5 rounded-full" :style="{ background: st.dot }"></i>{{ st.label }}</span>
      <span v-if="p.line" class="chip" :style="{ background: lc.bg, color: lc.fg }">{{ data.lines[p.line] }}</span>
    </div>

    <dl class="mt-5 space-y-3 text-sm">
      <div v-if="p.birth" class="rounded-xl bg-page px-4 py-3">
        <dt class="eyebrow">Рождение</dt>
        <dd class="mt-0.5 font-semibold">{{ fmtDate(p.birth.date) || '—' }}{{ julian(p.birth) }}</dd>
        <dd v-if="p.birth.place" class="text-soft">{{ p.birth.place }}</dd>
      </div>
      <div v-if="p.death" class="rounded-xl bg-page px-4 py-3">
        <dt class="eyebrow">Смерть</dt>
        <dd class="mt-0.5 font-semibold">{{ fmtDate(p.death.date) || '—' }}</dd>
        <dd v-if="p.death.place" class="text-soft">{{ p.death.place }}</dd>
      </div>
    </dl>

    <component :is="DevComments" v-if="DevComments" :key="p.id" :pid="p.id" />

    <div v-if="p.bio?.length" class="mt-6">
      <p class="eyebrow">Биография</p>
      <div class="mt-2 space-y-3 text-[15px] leading-relaxed text-ink/90">
        <p v-for="(t, i) in p.bio" :key="i">{{ t }}</p>
      </div>
    </div>

    <div v-if="p.moves?.length" class="mt-6">
      <p class="eyebrow">Где жил(а)</p>
      <ol class="relative mt-3 space-y-3 border-l-2 border-dashed pl-5" :style="{ borderColor: lc.fg + '40' }">
        <li v-for="(m, i) in p.moves" :key="i" class="relative text-sm">
          <span class="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white shadow" :style="{ background: lc.fg, opacity: m.approx ? .5 : 1 }"></span>
          <span class="font-mono text-xs font-semibold text-accent">{{ fmtDate(m.date) }}</span>
          <span class="block font-semibold">{{ data.places[m.place]?.name || m.place }}</span>
          <span v-if="m.note" class="block text-soft">{{ m.note }}</span>
        </li>
      </ol>
      <button class="link mt-3 text-sm" @click="showOnMap">Показать на карте →</button>
    </div>

    <div v-for="[label, list] in rel" :key="label" class="mt-5">
      <p class="eyebrow">{{ label }}</p>
      <ul class="mt-2 space-y-1">
        <li v-for="r in list" :key="r.id">
          <button class="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1 text-left text-sm hover:bg-accent-soft"
            @click="state.selected = r.id" @dblclick="state.focus = r.id">
            <span class="font-semibold">{{ r.given }} {{ r.patronymic }} {{ r.surname }}</span>
            <span class="font-mono text-xs text-soft">{{ lifespan(r) }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div v-if="p.notes?.length" class="mt-5">
      <p class="eyebrow">Заметки</p>
      <ul class="mt-2 space-y-2 text-sm leading-relaxed text-ink/90">
        <li v-for="(n, i) in p.notes" :key="i" class="flex gap-2"><span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-soft"></span>{{ n }}</li>
      </ul>
    </div>

    <div v-if="p.sources?.length" class="mt-5">
      <p class="eyebrow">Источники</p>
      <ul class="mt-2 space-y-2 text-sm">
        <li v-for="(s, i) in p.sources" :key="i">
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="link">{{ s.title }} ↗</a>
          <span v-else class="text-ink/90">{{ s.title }}</span>
        </li>
      </ul>
    </div>

    <button v-if="state.focus !== p.id" class="mt-6 w-full rounded-full bg-accent py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90" @click="state.focus = p.id">
      Поставить в центр древа</button>
  </aside>
</template>
