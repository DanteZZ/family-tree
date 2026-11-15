<script setup>
// Потомки идут ВВЕРХ: дети — рядом выше, внуки — ещё выше. Супруг(а) — рядом с человеком.
import { computed } from 'vue'
import { childrenOf, spousesOf } from '../store'
import PersonCard from './PersonCard.vue'

defineOptions({ name: 'DescendantTree' })
const props = defineProps({ id: String, depth: Number, showSelf: { type: Boolean, default: true } })
const kids = computed(() => props.depth > 0 ? childrenOf(props.id) : [])
const spouses = computed(() => props.showSelf ? spousesOf(props.id) : [])
</script>

<template>
  <div class="br-up">
    <div v-if="kids.length" class="row">
      <div v-for="k in kids" :key="k.id" class="cell">
        <DescendantTree :id="k.id" :depth="depth - 1" />
      </div>
    </div>
    <div v-if="showSelf" class="flex items-center gap-2">
      <PersonCard :id="id" />
      <template v-for="s in spouses" :key="s.id">
        <span class="text-lg text-soft/60">♡</span>
        <PersonCard :id="s.id" />
      </template>
    </div>
  </div>
</template>
