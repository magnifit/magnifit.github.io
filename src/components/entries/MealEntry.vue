<script setup lang="ts">
import { ref, computed } from 'vue'
import { Utensils, Trash2 } from '@lucide/vue'
import { MealFlags } from '../../lib/bitmask'
import type { Meal } from '../../types/fitness'
import NutritionBreakdownModal from '../modals/food/NutritionBreakdownModal.vue'

interface Props {
  meal: Meal
  showSlotBadge?: boolean
  microsOpt?: number
}

const props = withDefaults(defineProps<Props>(), {
  showSlotBadge: true
})

const emit = defineEmits<{
  (e: 'edit', meal: Meal): void
  (e: 'delete', id: string): void
  (e: 'update-micros', mealId: string, micros: Record<string, number>): void
}>()

const showNutritionModal = ref(false)

const slotLabel = computed(() => {
  const flags = props.meal.flags || 0
  if (flags & MealFlags.BREAKFAST) return 'Breakfast'
  if (flags & MealFlags.LUNCH) return 'Lunch'
  if (flags & MealFlags.DINNER) return 'Dinner'
  if (flags & MealFlags.SNACK) return 'Snack'
  return null
})
</script>

<template>
  <div
    @click="showNutritionModal = true"
    class="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between gap-3 text-sm group hover:border-amber-500/50 hover:bg-slate-850/70 transition cursor-pointer"
  >
    <!-- Left Column: Icon + Title & Macros Stack -->
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <div class="p-2 rounded-lg bg-amber-950/50 border border-amber-800/40 text-amber-400 shrink-0">
        <Utensils class="w-4 h-4" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span v-if="meal.brand" class="text-xs text-slate-400 font-medium shrink-0">[{{ meal.brand }}]</span>
          <span class="font-semibold text-slate-200 truncate">{{ meal.name }}</span>
          <span
            v-if="showSlotBadge && slotLabel"
            class="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 text-[10px] font-semibold text-amber-400/90 tracking-wide uppercase"
          >
            {{ slotLabel }}
          </span>
        </div>
        <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
          <span class="text-emerald-400">P: {{ meal.protein_g || meal.prot_g || 0 }}g</span>
          <span class="text-yellow-400">C: {{ meal.carbs_g || meal.carb_g || 0 }}g</span>
          <span class="text-rose-400">F: {{ meal.fat_g || 0 }}g</span>
        </div>
      </div>
    </div>

    <!-- Right Column: On <360px stacked (Top: Cal/Servings, Bottom: Action Button); On >=360px inline flex-row -->
    <div class="flex flex-col min-[360px]:flex-row items-end min-[360px]:items-center justify-between min-[360px]:justify-end gap-1 min-[360px]:gap-3 shrink-0">
      <!-- Top / Left: Calories & Servings Subtitle -->
      <div class="text-right flex flex-col justify-center">
        <div class="font-bold font-mono text-amber-400 text-sm leading-tight whitespace-nowrap">
          {{ meal.calories || meal.cal || 0 }} <span class="text-xs font-normal text-slate-400">kcal</span>
        </div>
        <div v-if="meal.num_serv && meal.num_serv > 1" class="text-[10px] font-mono text-slate-500 mt-0.5 leading-tight whitespace-nowrap">
          {{ meal.num_serv }}x servings
        </div>
      </div>

      <!-- Bottom / Right: Action Button -->
      <div class="flex items-center justify-end opacity-80 min-[360px]:opacity-80 sm:opacity-0 group-hover:opacity-100 transition min-[360px]:pl-0.5 shrink-0">
        <button
          v-if="meal.id"
          type="button"
          @click.stop="emit('delete', meal.id)"
          class="p-1 rounded text-slate-500 hover:text-rose-400 transition cursor-pointer"
          title="Delete Meal"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Clickable Nutrition Breakdown Modal with Inline Micronutrient & Servings Editing -->
    <NutritionBreakdownModal
      :show="showNutritionModal"
      :is-editable="true"
      :micros-opt="microsOpt"
      :data="{
        title: meal.name,
        subtitle: meal.brand || undefined,
        servings: meal.num_serv || 1,
        cal: meal.calories || meal.cal || 0,
        prot_g: meal.protein_g || meal.prot_g || 0,
        carb_g: meal.carbs_g || meal.carb_g || 0,
        fat_g: meal.fat_g || 0,
        micros: meal.micros as any
      }"
      @save-meal="(updated) => {
        emit('edit', {
          ...meal,
          num_serv: updated.num_serv || 1,
          cal: updated.cal,
          prot_g: updated.prot_g,
          carb_g: updated.carb_g,
          fat_g: updated.fat_g,
          micros: updated.micros
        })
        showNutritionModal = false
      }"
      @close="showNutritionModal = false"
    />
  </div>
</template>
