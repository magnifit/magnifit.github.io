<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@lucide/vue'
import MealEntry from '../entries/MealEntry.vue'
import type { Meal } from '../../types/fitness'

const props = withDefaults(defineProps<{
  slotTitle: string
  slotBit: number
  meals: Meal[]
  isLoading?: boolean
  microsOpt?: number
}>(), {
  isLoading: false
})

const emit = defineEmits<{
  (e: 'add-item', slotBit: number): void
  (e: 'edit-meal', meal: Meal): void
  (e: 'delete-meal', id: string): void
  (e: 'update-micros', mealId: string, micros: Record<string, number>): void
}>()

const slotCalories = computed(() =>
  props.meals.reduce((acc, m) => acc + (m.cal || m.calories || 0), 0)
)
const slotProt = computed(() =>
  props.meals.reduce((acc, m) => acc + (m.prot_g || m.protein_g || 0), 0)
)
const slotCarb = computed(() =>
  props.meals.reduce((acc, m) => acc + (m.carb_g || m.carbs_g || 0), 0)
)
const slotFat = computed(() =>
  props.meals.reduce((acc, m) => acc + (m.fat_g || 0), 0)
)
</script>

<template>
  <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
    <!-- Header: Slot Name, Subtotals, and Quick Add Action -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <div class="text-sm font-bold text-slate-100 flex items-center gap-2">
          <span>{{ slotTitle }}</span>
          <div v-if="isLoading" class="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
          <span v-else-if="meals.length > 0" class="text-xs font-mono font-bold text-amber-400">
            {{ slotCalories }} kcal
          </span>
        </div>
        <div v-if="isLoading" class="h-3 w-28 bg-slate-800/80 rounded animate-pulse mt-1"></div>
        <div v-else-if="meals.length > 0" class="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
          <span class="text-emerald-400">P: {{ slotProt }}g</span>
          <span class="text-yellow-400">C: {{ slotCarb }}g</span>
          <span class="text-rose-400">F: {{ slotFat }}g</span>
        </div>
      </div>

      <button
        type="button"
        @click="emit('add-item', slotBit)"
        class="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/50 text-amber-400 text-xs font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer ml-auto"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>Add</span>
      </button>
    </div>

    <!-- Meal Entries in this Slot -->
    <div class="space-y-2 pt-1">
      <div v-if="isLoading" class="space-y-2">
        <div class="h-12 w-full bg-slate-950/80 border border-slate-800/80 rounded-xl animate-pulse"></div>
      </div>
      <div v-else-if="meals.length === 0" class="text-xs text-slate-500 py-3 text-center bg-slate-950/50 rounded-xl border border-slate-900">
        No meals logged for {{ slotTitle.toLowerCase() }}.
      </div>
      <MealEntry
        v-else
        v-for="m in meals"
        :key="m.id"
        :meal="m"
        :show-slot-badge="false"
        :micros-opt="microsOpt"
        @edit="emit('edit-meal', $event)"
        @delete="emit('delete-meal', $event)"
        @update-micros="(mealId, newMicros) => emit('update-micros', mealId, newMicros)"
      />
    </div>
  </div>
</template>
