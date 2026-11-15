<script setup>
import { computed } from 'vue'
import { state, person, lifespan, STATUS, lineColor, initials, select, photoOf } from '../store'
import { kinOf } from '../kinship'

const props = defineProps({ id: String, focus: Boolean })
const p = computed(() => person(props.id))
const st = computed(() => STATUS[p.value?.status] || STATUS.unk)
const lc = computed(() => lineColor(p.value?.line))
const uncertain = computed(() => ['hypo', 'unk'].includes(p.value?.status))
</script>

<template>
  <button
    v-if="p"
    type="button"
    class="card flex w-52 items-start gap-3 rounded-2xl bg-white p-3 text-left shadow-card ring-1"
    :class="[
      state.selected === id ? 'ring-2 ring-accent shadow-lift' : 'ring-black/5',
      uncertain ? 'outline-dashed outline-1 outline-offset-2 outline-[#c9cfdd]' : '',
      focus ? 'shadow-lift' : '',
    ]"
    :data-focus="focus ? 'true' : null"
    title="Двойной щелчок — поставить в центр"
    @click="select(id)"
    @dblclick="state.focus = id"
  >
    <img v-if="photoOf(p)" :src="photoOf(p)" alt="" class="h-10 w-10 shrink-0 rounded-full object-cover object-top ring-2 ring-white">
    <span v-else class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold"
      :style="{ background: lc.bg, color: lc.fg }">{{ initials(p) }}</span>
    <span class="min-w-0 flex-1">
      <span v-if="kinOf(id)" class="mb-0.5 block truncate text-[11px] font-bold leading-tight"
        :class="state.selected === id ? 'text-soft' : 'text-accent'" :title="kinOf(id)">{{ kinOf(id) }}</span>
      <span class="block truncate text-[11px] font-semibold uppercase tracking-wider text-soft">
        {{ p.surname || '—' }}<template v-if="p.maiden && p.maiden !== p.surname"> · {{ p.maiden }}</template>
      </span>
      <span class="block text-[14.5px] font-bold leading-snug">{{ p.given }} {{ p.patronymic }}</span>
      <span class="mt-1 flex items-center gap-2">
        <span v-if="lifespan(p)" class="font-mono text-[11.5px] tabular-nums text-soft">{{ lifespan(p) }}</span>
        <span class="inline-flex items-center gap-1 text-[10.5px] font-semibold" :style="{ color: st.fg }">
          <i class="inline-block h-1.5 w-1.5 rounded-full" :style="{ background: st.dot }"></i>{{ st.short }}
        </span>
      </span>
    </span>
  </button>
</template>
