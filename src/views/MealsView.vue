<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from '../lib/router'
import { useAuthStore } from '../stores/authStore'
import { MealFlags } from '../lib/bitmask'
import { useMeals } from '../composables/useMeals'
import { useI18n } from '../lib/i18n'
import { getTodayDateString, getSuggestedMealSlot } from '../lib/dateUtils'
import MacroNutrientBar from '../components/cards/MacroNutrientBar.vue'
import DatePickerPopover from '../components/atoms/DatePickerPopover.vue'
import DashboardHeader from '../components/layout/DashboardHeader.vue'
import OnboardingModal from '../components/modals/onboarding/OnboardingModal.vue'
import NewMealEntryForm from '../components/meals/forms/NewMealEntryForm.vue'
import RecipeCatalogSection from '../components/meals/recipes/RecipeCatalogSection.vue'
import TabbedView, { type TabItem } from '../components/layout/TabbedView.vue'
import MealSlotCard from '../components/meals/MealSlotCard.vue'
import FavoriteFoodsSection from '../components/meals/favorites/FavoriteFoodsSection.vue'
import { useFoodTemplates } from '../composables/useFoodTemplates'
import type { Meal, Profile } from '../types/fitness'
import { Utensils, Plus, BookOpen, Clock, Star } from '@lucide/vue'

const { navigate, routeState } = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

// Target date passed silently in router state or defaulted to user local today
const targetDate = ref<string>(routeState.value.logDate || getTodayDateString())
const loggedDates = ref<string[]>([])
const currentUserId = computed(() => authStore.user.value?.id)

const {
  meals: allMeals,
  filteredMeals: meals,
  templates,
  totalProteinG: totalProtein,
  totalCarbsG: totalCarbs,
  totalFatG: totalFat,
  loading,
  fetchMeals,
  fetchTemplates,
  addMeal,
  editMeal,
  deleteMeal,
  addTemplate,
  editTemplate,
  deleteTemplate,
  shareTemplateToHandle,
  logTemplateAsMeal
} = useMeals(currentUserId, targetDate, loggedDates)

const {
  favoriteTemplates,
  loading: loadingFavorites,
  fetchFavorites,
  toggleFavorite
} = useFoodTemplates(currentUserId)

const activeTab = ref<'new_entry' | 'favorites' | 'recipes' | 'summary'>(
  (routeState.value.tab as 'new_entry' | 'favorites' | 'recipes' | 'summary') || 'new_entry'
)
const isSaving = ref<boolean>(false)
const selectedSlotForNewEntry = ref<number>(routeState.value.initialSlot || getSuggestedMealSlot())

const mealTabs = computed<TabItem[]>(() => [
  { id: 'new_entry', label: t('meals.tab.new_entry'), icon: Plus },
  { id: 'favorites', label: 'Favorites', icon: Star, badge: favoriteTemplates.value.length },
  { id: 'recipes', label: t('meals.tab.recipes'), icon: BookOpen, badge: templates.value.length },
  { id: 'summary', label: t('meals.tab.summary'), icon: Clock, badge: meals.value.length }
])

watch(() => routeState.value.initialSlot, (newSlot) => {
  if (newSlot) {
    selectedSlotForNewEntry.value = newSlot
  }
})

// Meal groupings by slot bitmask
const breakfastMeals = computed(() => meals.value.filter(m => (m.flags || 0) === MealFlags.BREAKFAST))
const lunchMeals = computed(() => meals.value.filter(m => (m.flags || 0) === MealFlags.LUNCH || (!m.flags && (m.flags || 0) === 0)))
const dinnerMeals = computed(() => meals.value.filter(m => (m.flags || 0) === MealFlags.DINNER))
const snackMeals = computed(() => meals.value.filter(m => (m.flags || 0) === MealFlags.SNACK))

const handleAddMealFromForm = async (mealData: Meal) => {
  isSaving.value = true
  await addMeal({
    ...mealData,
    log_date: targetDate.value
  })
  activeTab.value = 'summary'
  isSaving.value = false
}

const handleLogFavorite = async (item: {
  template_id: string
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
  slotBit: number
  micros?: any
}) => {
  isSaving.value = true
  await addMeal({
    name: item.name,
    brand: item.brand || null,
    cal: item.cal,
    prot_g: item.prot_g,
    carb_g: item.carb_g,
    fat_g: item.fat_g,
    num_serv: item.num_serv || 1,
    serv_cal: item.serv_cal,
    serv_prot: item.serv_prot,
    serv_carb: item.serv_carb,
    serv_fat: item.serv_fat,
    template_id: item.template_id,
    flags: item.slotBit,
    micros: item.micros,
    log_date: targetDate.value
  })
  activeTab.value = 'summary'
  isSaving.value = false
}

const handleQuickAddSlot = (slotBit: number) => {
  selectedSlotForNewEntry.value = slotBit
  activeTab.value = 'new_entry'
}

const userProfile = ref<Profile | null>(null)
const showOnboardingModal = ref<boolean>(false)

const handleSignOut = async () => {
  await authStore.signOut()
  navigate('/')
}

const fetchUserProfile = async (uid: string) => {
  const { data } = await supabase
    .from<Profile>('profiles')
    .select()
    .eq('id', uid)
    .single()
  if (data) {
    userProfile.value = data
  }
}

const fetchAll = async (invalidate = false) => {
  if (currentUserId.value) {
    if (invalidate) {
      try {
        localStorage.removeItem('mfit_recent_foods')
      } catch { }
    }
    await Promise.allSettled([
      fetchUserProfile(currentUserId.value),
      fetchMeals(currentUserId.value),
      fetchTemplates(currentUserId.value),
      fetchFavorites(currentUserId.value)
    ])
  }
}

const refreshFetchers = computed(() => {
  const uid = currentUserId.value
  if (!uid) return []
  return [
    () => fetchUserProfile(uid),
    () => fetchMeals(uid),
    () => fetchTemplates(uid),
    () => fetchFavorites(uid)
  ]
})

onMounted(async () => {
  await fetchAll()
})

watch(currentUserId, async () => {
  await fetchAll()
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
    <OnboardingModal v-if="showOnboardingModal" :initial-profile="userProfile"
      @completed="(updated) => { userProfile = updated; showOnboardingModal = false; }"
      @dismiss="showOnboardingModal = false" />

    <div class="max-w-4xl mx-auto space-y-6">
      <!-- Global Brand & Profile Header -->
      <DashboardHeader :user-profile="userProfile" :user-email="authStore.user.value?.email" :loading="loading"
        :show-back="true" :fetchers="refreshFetchers" @back="navigate('/dash')"
        @open-onboarding="showOnboardingModal = true" @sign-out="handleSignOut" />
      <!-- Top Summary / Macro Gauge Section -->
      <div class="space-y-4">
        <!-- Top Title & Calendar Picker Bar -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Utensils class="w-5 h-5 text-amber-500 shrink-0" />
            <h1 class="text-lg sm:text-xl font-black text-slate-100">{{ t('meals.title') }}</h1>
          </div>

          <!-- Date Picker Component -->
          <div class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <DatePickerPopover v-model="targetDate" :logged-dates="loggedDates" />
          </div>
        </div>

        <!-- Animated Macro Nutrients Gauges & Distribution Bar -->
        <MacroNutrientBar :protein-g="totalProtein" :carbs-g="totalCarbs" :fat-g="totalFat" :is-loading="loading" />
      </div>

      <!-- Centralized Tabbed View for Meals -->
      <TabbedView v-model="activeTab" :tabs="mealTabs" pill-color-class="bg-amber-500">
        <!-- Tab 1: New Entry (Manual / Search / OCR Switcher) -->
        <template #new_entry>
          <div class="space-y-6">
            <NewMealEntryForm :initial-slot="selectedSlotForNewEntry" :log-date="targetDate" :is-submitting="isSaving"
              :micros-opt="userProfile?.micros_opt" :templates="templates" :recent-meals="allMeals"
              @submit="handleAddMealFromForm" />
          </div>
        </template>

        <!-- Tab 2: Favorite Foods -->
        <template #favorites>
          <div class="space-y-6">
            <FavoriteFoodsSection :favorites="favoriteTemplates" :is-loading="loadingFavorites"
              :micros-opt="userProfile?.micros_opt" @log-favorite="handleLogFavorite"
              @toggle-favorite="toggleFavorite" />
          </div>
        </template>

        <!-- Tab 3: Recipes & Meal Templates Catalog -->
        <template #recipes>
          <div class="space-y-6">
            <RecipeCatalogSection :templates="templates" :micros-opt="userProfile?.micros_opt"
              @create-template="addTemplate" @edit-template="editTemplate" @delete-template="deleteTemplate"
              @share-template="async (id, handle, cb) => {
                const res = await shareTemplateToHandle(id, handle)
                cb(res)
              }" @log-template="(tmpl, slot, multiplier) => logTemplateAsMeal(tmpl, slot, targetDate, multiplier)" />
          </div>
        </template>

        <!-- Tab 3: Grouped Slots Day Summary (Breakfast, Lunch, Dinner, Snack) -->
        <template #summary>
          <div class="space-y-4">
            <MealSlotCard :slot-title="t('meals.slot.breakfast')" :slot-bit="MealFlags.BREAKFAST"
              :meals="breakfastMeals" :is-loading="loading" :micros-opt="userProfile?.micros_opt"
              @add-item="handleQuickAddSlot" @edit-meal="editMeal" @delete-meal="deleteMeal" @update-micros="(id, newMicros) => {
                const m = meals.find(item => item.id === id)
                if (m) editMeal({ ...m, micros: newMicros })
              }" />

            <MealSlotCard :slot-title="t('meals.slot.lunch')" :slot-bit="MealFlags.LUNCH" :meals="lunchMeals"
              :is-loading="loading" :micros-opt="userProfile?.micros_opt" @add-item="handleQuickAddSlot"
              @edit-meal="editMeal" @delete-meal="deleteMeal" @update-micros="(id, newMicros) => {
                const m = meals.find(item => item.id === id)
                if (m) editMeal({ ...m, micros: newMicros })
              }" />

            <MealSlotCard :slot-title="t('meals.slot.dinner')" :slot-bit="MealFlags.DINNER" :meals="dinnerMeals"
              :is-loading="loading" :micros-opt="userProfile?.micros_opt" @add-item="handleQuickAddSlot"
              @edit-meal="editMeal" @delete-meal="deleteMeal" @update-micros="(id, newMicros) => {
                const m = meals.find(item => item.id === id)
                if (m) editMeal({ ...m, micros: newMicros })
              }" />

            <MealSlotCard :slot-title="t('meals.slot.snack')" :slot-bit="MealFlags.SNACK" :meals="snackMeals"
              :is-loading="loading" :micros-opt="userProfile?.micros_opt" @add-item="handleQuickAddSlot"
              @edit-meal="editMeal" @delete-meal="deleteMeal" @update-micros="(id, newMicros) => {
                const m = meals.find(item => item.id === id)
                if (m) editMeal({ ...m, micros: newMicros })
              }" />
          </div>
        </template>
      </TabbedView>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
