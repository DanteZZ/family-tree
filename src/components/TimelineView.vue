<script setup>
// Хронология: три вкладки — «События», «Передвижения» (карта), «Годы жизни» (гант).
import EventsView from './EventsView.vue'
import MovesView from './MovesView.vue'
import LivesView from './LivesView.vue'
import LineFilter from './LineFilter.vue'

defineProps({ tab: String })
const emit = defineEmits(['open', 'tab'])
const TABS = [
  ['timeline', 'События'],
  ['lives', 'Годы жизни'],
  ['moves', 'Передвижения'],
]
const HINT = {
  timeline: 'Колесо — приблизить, перетаскивание — листать годы',
  lives: 'Видны только те, кто жил в показанные годы — листайте, чтобы появились остальные',
  moves: 'Нажмите на человека слева или на точку на карте',
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col">
    <div class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-2 pt-3 sm:px-6">
      <nav class="seg" aria-label="Вид хронологии">
        <button v-for="[k, label] in TABS" :key="k" :aria-pressed="tab === k" @click="emit('tab', k)">{{ label }}</button>
      </nav>
      <LineFilter />
      <span class="ml-auto hidden text-xs text-soft xl:inline">{{ HINT[tab] }}</span>
    </div>
    <EventsView v-if="tab === 'timeline'" @open="emit('open')" />
    <LivesView v-else-if="tab === 'lives'" @open="emit('open')" />
    <MovesView v-else @open="emit('open')" />
  </div>
</template>
