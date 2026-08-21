<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Search, Camera, PenTool } from '@lucide/vue'
import { MealFlags } from '../../../lib/bitmask'
import { useI18n } from '../../../lib/i18n'
import { getSuggestedMealSlot } from '../../../lib/dateUtils'
import FoodSearchLookup from './FoodSearchLookup.vue'
import NutritionLabelOcrModal from '../../modals/food/NutritionLabelOcrModal.vue'
import MicronutrientsAccordion from '../../atoms/MicronutrientsAccordion.vue'
import FormInput from '../../atoms/FormInput.vue'
import type { Meal, MealTemplate } from '../../../types/fitness'

const props = withDefaults(defineProps<{
  initialSlot?: number
  logDate?: string
  isSubmitting?: boolean
  microsOpt?: number
  templates?: MealTemplate[]
  recentMeals?: Meal[]
}>(), {
  initialSlot: () => getSuggestedMealSlot(),
  templates: () => [],
  recentMeals: () => []
})

const emit = defineEmits<{
  (e: 'submit', meal: Meal): void
}>()

const { t } = useI18n()

const activeMode = ref<'manual' | 'search' | 'ocr'>('search')
const mealName = ref('')
const brand = ref('')
const calories = ref<number | null>(null)
const proteinG = ref<number | null>(null)
const carbsG = ref<number | null>(null)
const fatG = ref<number | null>(null)
const servingSize = ref<number | null>(null)
const servingUnit = ref<string>('g')
const servingsCount = ref<number>(1)
const servingsMultiplier = ref<number>(1)
const selectedMealSlot = ref<number>(props.initialSlot)

watch(() => props.initialSlot, (newSlot) => {
  if (newSlot) {
    selectedMealSlot.value = newSlot
  }
})

const mealSlotOptions = [
  { bit: MealFlags.BREAKFAST, label: t('meals.slot.breakfast') },
  { bit: MealFlags.LUNCH, label: t('meals.slot.lunch') },
  { bit: MealFlags.DINNER, label: t('meals.slot.dinner') },
  { bit: MealFlags.SNACK, label: t('meals.slot.snack') }
]

const mealMicros = ref<Record<string, number>>({})

const handleFoodSelected = (food: {
  name: string
  brand?: string | null
  cal: number
  prot_g: number
  carb_g: number
  fat_g: number
  num_serv?: number
  serv_cal?: number | null
  serv_prot?: number | null
  serv_carb?: number | null
  serv_fat?: number | null
  template_id?: string
  type?: string
  micros?: Record<string, number>
}) => {
  let formattedName = food.name.trim()
  if (food.num_serv && food.num_serv > 1 && !formattedName.includes('(')) {
    formattedName = `${formattedName} (${food.num_serv}x)`
  }

  const isRecipe = food.type === 'recipe'
  let finalFlags = selectedMealSlot.value
  if (isRecipe) finalFlags |= 512

  emit('submit', {
    name: formattedName,
    brand: food.brand || null,
    cal: food.cal || 0,
    prot_g: food.prot_g || 0,
    carb_g: food.carb_g || 0,
    fat_g: food.fat_g || 0,
    num_serv: food.num_serv || 1.0,
    serv_cal: food.serv_cal ?? (food.num_serv === 1 ? Math.round(food.cal || 0) : null),
    serv_prot: food.serv_prot ?? (food.num_serv === 1 ? Math.round(food.prot_g || 0) : null),
    serv_carb: food.serv_carb ?? (food.num_serv === 1 ? Math.round(food.carb_g || 0) : null),
    serv_fat: food.serv_fat ?? (food.num_serv === 1 ? Math.round(food.fat_g || 0) : null),
    template_id: food.template_id || null,
    flags: finalFlags,
    micros: food.micros && Object.keys(food.micros).length > 0 ? food.micros : undefined,
    log_date: props.logDate
  })
}

const handleOcrAutofill = (data: { name?: string; brand?: string; cal?: number; prot_g?: number; carb_g?: number; fat_g?: number }) => {
  if (data.name) mealName.value = data.name
  if (data.brand) brand.value = data.brand
  if (data.cal !== undefined) calories.value = data.cal
  if (data.prot_g !== undefined) proteinG.value = data.prot_g
  if (data.carb_g !== undefined) carbsG.value = data.carb_g
  if (data.fat_g !== undefined) fatG.value = data.fat_g
  activeMode.value = 'manual'
}

const handleSubmit = () => {
  if (!mealName.value.trim() || calories.value === null) return

  let formattedName = mealName.value.trim()
  if (servingsMultiplier.value > 1 && !formattedName.includes('(')) {
    formattedName = `${formattedName} (${servingsMultiplier.value}x)`
  }

  emit('submit', {
    name: formattedName,
    brand: brand.value.trim() || null,
    cal: calories.value || 0,
    prot_g: proteinG.value || 0,
    carb_g: carbsG.value || 0,
    fat_g: fatG.value || 0,
    num_serv: servingsMultiplier.value || 1.0,
    serv_cal: Math.round(calories.value || 0),
    serv_prot: Math.round(proteinG.value || 0),
    serv_carb: Math.round(carbsG.value || 0),
    serv_fat: Math.round(fatG.value || 0),
    flags: selectedMealSlot.value,
    micros: Object.keys(mealMicros.value).length > 0 ? mealMicros.value : undefined,
    log_date: props.logDate
  })

  // Reset form
  mealName.value = ''
  brand.value = ''
  calories.value = null
  proteinG.value = null
  carbsG.value = null
  fatG.value = null
  servingSize.value = null
  servingUnit.value = 'g'
  servingsCount.value = 1
  servingsMultiplier.value = 1
  mealMicros.value = {}
}
</script>

<template>
  <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xl">
    <!-- Universal Meal Timing Slot Buttons -->
    <div class="space-y-1.5">
      <label class="text-xs font-semibold text-slate-300">{{ t('meals.slot.label') }}</label>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button v-for="slot in mealSlotOptions" :key="slot.bit" type="button" @click="selectedMealSlot = slot.bit"
          :class="[
            'py-2 px-3 rounded-xl border text-xs font-semibold transition active:scale-95 cursor-pointer text-center',
            selectedMealSlot === slot.bit
              ? 'bg-amber-950/70 border-amber-500 text-amber-300'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          ]">
          {{ slot.label }}
        </button>
      </div>
    </div>

    <!-- Mode Switcher Pill Bar (Manual, Search, OCR) with Sliding Indicator -->
    <div
      class="relative grid grid-cols-3 p-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold gap-1 overflow-hidden">
      <!-- Animated Sliding Background Pill -->
      <div
        class="absolute top-1.5 bottom-1.5 rounded-lg bg-amber-500 shadow-md transition-all duration-300 ease-out pointer-events-none"
        :style="{
          width: 'calc((100% - 12px) / 3)',
          left: '6px',
          transform: activeMode === 'manual' ? 'translateX(0%)' : activeMode === 'search' ? 'translateX(calc(100% + 4px))' : 'translateX(calc(200% + 8px))'
        }"></div>

      <button type="button" @click="activeMode = 'manual'" :class="[
        'relative z-10 py-2 px-1.5 sm:px-2 min-h-13 sm:min-h-11 rounded-lg transition-colors duration-200 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center leading-tight',
        activeMode === 'manual' ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
      ]">
        <PenTool class="w-3.5 h-3.5 shrink-0" />
        <span class="text-[11px] sm:text-xs text-center line-clamp-2">{{ t('meals.mode.manual') }}</span>
      </button>

      <button type="button" @click="activeMode = 'search'" :class="[
        'relative z-10 py-2 px-1.5 sm:px-2 min-h-13 sm:min-h-11 rounded-lg transition-colors duration-200 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center leading-tight',
        activeMode === 'search' ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
      ]">
        <Search class="w-3.5 h-3.5 shrink-0" />
        <span class="text-[11px] sm:text-xs text-center line-clamp-2">{{ t('meals.mode.search') }}</span>
      </button>

      <button type="button" @click="activeMode = 'ocr'" :class="[
        'relative z-10 py-2 px-1.5 sm:px-2 min-h-13 sm:min-h-11 rounded-lg transition-colors duration-200 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center leading-tight',
        activeMode === 'ocr' ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
      ]">
        <Camera class="w-3.5 h-3.5 shrink-0" />
        <span class="text-[11px] sm:text-xs text-center line-clamp-2">{{ t('meals.mode.ocr') }}</span>
      </button>
    </div>

    <!-- Search Food Lookup View -->
    <div v-if="activeMode === 'search'">
      <FoodSearchLookup :templates="templates" :recent-meals="recentMeals" @select-food="handleFoodSelected" />
    </div>

    <!-- OCR Scanner View -->
    <div v-else-if="activeMode === 'ocr'">
      <NutritionLabelOcrModal @autofill="handleOcrAutofill" />
    </div>

    <!-- Manual / Finalized Entry Form -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-5">

      <!-- Item Name, Brand & Total Energy -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FormInput
          v-model="mealName"
          :label="t('meals.item_name_label')"
          :placeholder="t('meals.item_name_placeholder')"
          required
          input-class="focus:border-amber-500"
          class="sm:col-span-2"
        />

        <FormInput
          v-model="brand"
          label="Brand (Optional)"
          placeholder="e.g. Quaker"
          input-class="focus:border-amber-500"
        />

        <FormInput
          v-model="calories"
          type="number"
          :label="t('meals.cal_label')"
          placeholder="550"
          :min="0"
          :max="10000"
          required
          input-class="focus:border-amber-500 font-mono"
        />
      </div>

      <!-- Optional Serving Configuration -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
        <FormInput
          v-model="servingSize"
          type="number"
          label="Serving Size (Optional)"
          placeholder="100"
          :min="1"
          input-class="bg-slate-900 focus:border-amber-500 py-2 text-xs font-mono"
        />

        <FormInput
          v-model="servingUnit"
          type="text"
          label="Unit"
          placeholder="g / ml / scoop"
          input-class="bg-slate-900 focus:border-amber-500 py-2 text-xs"
        />

        <FormInput
          v-model="servingsCount"
          type="number"
          step="0.25"
          label="# of Servings"
          min="0.25"
          input-class="bg-slate-900 focus:border-amber-500 py-2 text-xs font-mono"
        />
      </div>

      <!-- Macronutrients Row (P/C/F) -->
      <div class="grid grid-cols-3 gap-3">
        <FormInput
          v-model="proteinG"
          type="number"
          :label="t('meals.prot_label')"
          placeholder="40"
          :min="0"
          input-class="focus:border-amber-500 font-mono"
        />

        <FormInput
          v-model="carbsG"
          type="number"
          :label="t('meals.carb_label')"
          placeholder="55"
          :min="0"
          input-class="focus:border-amber-500 font-mono"
        />

        <FormInput
          v-model="fatG"
          type="number"
          :label="t('meals.fat_label')"
          placeholder="15"
          :min="0"
          input-class="focus:border-amber-500 font-mono"
        />
      </div>

      <!-- Collapsible Tracked Micronutrients Accordion Section -->
      <MicronutrientsAccordion v-model="mealMicros" :micros-opt="microsOpt" />

      <button type="submit" :disabled="isSubmitting"
        class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-950/40 disabled:opacity-50">
        <Plus class="w-4 h-4 stroke-3" />
        <span>{{ t('meals.submit_save') }}</span>
      </button>
    </form>
  </div>
</template>
