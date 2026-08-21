<script setup lang="ts">
import { toRef } from 'vue'
import { Search, Loader2, X, QrCode, AlertCircle } from '@lucide/vue'
import { useI18n } from '../../../lib/i18n'
import { useFoodSearchLookup, type FoodSearchResult, type QuickPickItem } from '../../../composables/useFoodSearchLookup'
import NutritionBreakdownModal from '../../modals/food/NutritionBreakdownModal.vue'
import FoodSearchQuickPicks from './search/FoodSearchQuickPicks.vue'
import FoodSearchResultsList from './search/FoodSearchResultsList.vue'
import FoodServingAdjustModal from '../../modals/food/FoodServingAdjustModal.vue'
import FoodQuickPickServingModal from '../../modals/food/FoodQuickPickServingModal.vue'
import FoodBarcodeScannerModal from '../../modals/food/FoodBarcodeScannerModal.vue'
import type { MealTemplate, Meal } from '../../../types/fitness'

export type { FoodSearchResult, QuickPickItem }

interface Props {
  templates?: MealTemplate[]
  recentMeals?: Meal[]
}

const props = withDefaults(defineProps<Props>(), {
  templates: () => [],
  recentMeals: () => []
})

const emit = defineEmits<{
  (e: 'select-food', food: {
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
    micros?: Record<string, number>
  }): void
}>()

const { t } = useI18n()

const {
  searchQuery,
  isSearching,
  searchResults,
  searchError,
  showAllResults,
  selectedFood,
  inspectedFood,
  servingUnitGrams,
  servingCount,
  confirmingRecentFood,
  recentFoodServings,
  showScannerModal,
  scannerError,
  quickPickList,
  displayedResults,
  isItemFavorited,
  handleToggleFavoriteItem,
  performSearch,
  upsertFoodTemplate
} = useFoodSearchLookup(toRef(props, 'templates'), toRef(props, 'recentMeals'))

const handleSelectFoodResult = (item: FoodSearchResult) => {
  selectedFood.value = item
  servingUnitGrams.value = item.serving_size_g || 100
  servingCount.value = 1
}

const handleConfirmFoodServing = (details: {
  totalGrams: number
  scaledCal: number
  scaledProt: number
  scaledCarb: number
  scaledFat: number
  scaledMicros: Record<string, number>
}) => {
  if (!selectedFood.value) return

  const fullName = selectedFood.value.brand
    ? `${selectedFood.value.brand} ${selectedFood.value.name}`
    : selectedFood.value.name

  const foodPayload = {
    name: `${fullName} (${details.totalGrams}g)`,
    brand: selectedFood.value.brand || null,
    cal: details.scaledCal,
    prot_g: details.scaledProt,
    carb_g: details.scaledCarb,
    fat_g: details.scaledFat,
    num_serv: servingCount.value || 1,
    serv_cal: details.scaledCal,
    serv_prot: details.scaledProt,
    serv_carb: details.scaledCarb,
    serv_fat: details.scaledFat,
    template_id: selectedFood.value.template_id,
    micros: Object.keys(details.scaledMicros).length > 0 ? details.scaledMicros : undefined
  }

  if (!selectedFood.value.template_id) {
    upsertFoodTemplate({
      name: selectedFood.value.name,
      brand: selectedFood.value.brand,
      cal: selectedFood.value.cal_100g,
      prot_g: selectedFood.value.prot_100g,
      carb_g: selectedFood.value.carb_100g,
      fat_g: selectedFood.value.fat_100g,
      num_serv: servingUnitGrams.value || 1,
      micros: selectedFood.value.micros
    }).then(tId => {
      if (tId) foodPayload.template_id = tId
    }).catch(() => { })
  }

  emit('select-food', foodPayload)
  selectedFood.value = null
}

const handleSelectQuickPickItem = (item: QuickPickItem) => {
  confirmingRecentFood.value = item
  recentFoodServings.value = 1
}

const handleConfirmQuickPickServing = () => {
  if (!confirmingRecentFood.value) return
  const item = confirmingRecentFood.value
  const servings = Math.max(0.1, Number(recentFoodServings.value) || 1)

  const scaledCal = Math.round(item.cal * servings)
  const scaledProt = Math.round(item.prot_g * servings * 10) / 10
  const scaledCarb = Math.round(item.carb_g * servings * 10) / 10
  const scaledFat = Math.round(item.fat_g * servings * 10) / 10

  const scaledMicros: Record<string, number> = {}
  if (item.micros) {
    Object.entries(item.micros).forEach(([k, v]) => {
      scaledMicros[k] = Math.round(v * servings * 10) / 10
    })
  }

  let formattedName = item.name
  if (servings !== 1 && !formattedName.includes('x ')) {
    formattedName = `${formattedName} (${servings}x)`
  }

  emit('select-food', {
    name: formattedName,
    brand: (item as any).brand || null,
    cal: scaledCal,
    prot_g: scaledProt,
    carb_g: scaledCarb,
    fat_g: scaledFat,
    num_serv: servings,
    serv_cal: Math.round(item.cal * servings),
    serv_prot: Math.round(item.prot_g * servings * 10) / 10,
    serv_carb: Math.round(item.carb_g * servings * 10) / 10,
    serv_fat: Math.round(item.fat_g * servings * 10) / 10,
    template_id: item.template_id,
    micros: Object.keys(scaledMicros).length > 0 ? scaledMicros : undefined
  })

  confirmingRecentFood.value = null
}

const handleBarcodeDetected = (barcode: string) => {
  showScannerModal.value = false
  searchQuery.value = barcode
  performSearch()
}
</script>

<template>
  <div class="space-y-4">
    <!-- Search Bar Form -->
    <form @submit.prevent="showAllResults = false; performSearch()" class="flex gap-2">
      <div class="relative flex-1">
        <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input type="text" v-model="searchQuery" :placeholder="t('meals.search.placeholder')"
          class="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition" />
        <button v-if="searchQuery" type="button" @click="searchQuery = ''; searchResults = []"
          class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition cursor-pointer">
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Barcode Scan Camera Trigger -->
      <button type="button" @click="showScannerModal = true; scannerError = null" title="Scan Barcode"
        class="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500 text-slate-300 hover:text-amber-400 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-md">
        <QrCode class="w-4 h-4" />
      </button>

      <button type="submit" :disabled="isSearching || !searchQuery.trim()"
        class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-md">
        <Loader2 v-if="isSearching" class="w-3.5 h-3.5 animate-spin" />
        <template v-else>
          <Search class="w-3.5 h-3.5 stroke-[2.5]" />
          <span class="hidden sm:inline">Search</span>
        </template>
      </button>
    </form>

    <!-- Error Banner -->
    <div v-if="searchError"
      class="p-3 bg-rose-950/60 border border-rose-900/80 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs sm:text-sm">
      <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
      <span>{{ searchError }}</span>
    </div>

    <!-- Quick-Pick List: Recent Foods (When Search is empty) -->
    <FoodSearchQuickPicks v-if="!searchQuery.trim() && !isSearching" :quick-pick-list="quickPickList"
      :is-item-favorited="isItemFavorited" @select-item="handleSelectQuickPickItem"
      @toggle-favorite="handleToggleFavoriteItem" />

    <!-- Remote Database Search Results List -->
    <FoodSearchResultsList v-if="searchResults.length > 0" :search-results="searchResults"
      :displayed-results="displayedResults" :show-all-results="showAllResults" :is-item-favorited="isItemFavorited"
      @select-food="handleSelectFoodResult" @inspect-food="(item) => inspectedFood = item"
      @toggle-favorite="handleToggleFavoriteItem" @toggle-show-all="showAllResults = !showAllResults" />

    <!-- Nutrition Breakdown Modal -->
    <NutritionBreakdownModal :show="!!inspectedFood" :data="inspectedFood ? {
      title: inspectedFood.name,
      subtitle: inspectedFood.brand,
      serving_size: inspectedFood.serving_label || '100g',
      cal: inspectedFood.cal_100g,
      prot_g: inspectedFood.prot_100g,
      carb_g: inspectedFood.carb_100g,
      fat_g: inspectedFood.fat_100g,
      micros: inspectedFood.micros
    } : null" @close="inspectedFood = null" />

    <!-- Food Serving Adjustment Modal -->
    <FoodServingAdjustModal :food="selectedFood" v-model:serving-unit-grams="servingUnitGrams"
      v-model:serving-count="servingCount" @close="selectedFood = null" @confirm="handleConfirmFoodServing" />

    <!-- Quick Pick Serving Multiplier Modal -->
    <FoodQuickPickServingModal :item="confirmingRecentFood" v-model:servings="recentFoodServings"
      @close="confirmingRecentFood = null" @inspect="(item) => inspectedFood = {
        name: item.name,
        cal_100g: item.cal,
        prot_100g: item.prot_g,
        carb_100g: item.carb_g,
        fat_100g: item.fat_g,
        serving_size_g: item.serving_size,
        serving_label: item.serving_size ? `${item.serving_size}${item.serving_unit || 'g'}` : undefined,
        micros: item.micros
      }" @confirm="handleConfirmQuickPickServing" />

    <!-- Barcode Scanner Modal -->
    <FoodBarcodeScannerModal :show="showScannerModal" :scanner-error="scannerError" @close="showScannerModal = false"
      @detected="handleBarcodeDetected" />
  </div>
</template>
