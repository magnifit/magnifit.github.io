<script setup lang="ts">
import { ref, computed } from 'vue'
import { BookOpen, Trash2, Check, Utensils, X, Search, Camera, PenTool, Pencil, Share2, Loader2, AlertCircle } from '@lucide/vue'
import { MealFlags } from '../../../lib/bitmask'
import { useI18n } from '../../../lib/i18n'
import Modal from '../../atoms/Modal.vue'
import SectionHeader from '../../atoms/SectionHeader.vue'
import EmptySectionPlaceholder from '../../atoms/EmptySectionPlaceholder.vue'
import FormInput from '../../atoms/FormInput.vue'
import MicronutrientsAccordion from '../../atoms/MicronutrientsAccordion.vue'
import FoodSearchLookup from '../forms/FoodSearchLookup.vue'
import NutritionLabelOcrModal from '../../modals/food/NutritionLabelOcrModal.vue'
import type { MealTemplate, RecipeIngredient } from '../../../types/fitness'

const props = defineProps<{
  templates: MealTemplate[]
  microsOpt?: number
}>()

const emit = defineEmits<{
  (e: 'create-template', template: Partial<MealTemplate>): void
  (e: 'edit-template', template: MealTemplate): void
  (e: 'delete-template', id: string): void
  (e: 'share-template', recipeId: string, handle: string, callback: (res: { success: boolean; message?: string; error?: string }) => void): void
  (e: 'log-template', template: MealTemplate, slot: number, multiplier: number): void
}>()

const { t } = useI18n()

const showCreateModal = ref(false)
const editingTemplateId = ref<string | null>(null)
const isRecipeMicrosOpen = ref(false)
const showLogModal = ref(false)
const selectedTemplateForLog = ref<MealTemplate | null>(null)
const logSlot = ref<number>(MealFlags.LUNCH)
const logMultiplier = ref<number>(1)

// Share Modal State
const showShareModal = ref(false)
const selectedTemplateForShare = ref<MealTemplate | null>(null)
const shareHandle = ref('')
const isSharing = ref(false)
const shareMessage = ref<string | null>(null)
const shareError = ref<string | null>(null)

// Delete Confirmation Modal State
const deletingTemplate = ref<MealTemplate | null>(null)

const confirmDeleteTemplate = () => {
  if (deletingTemplate.value?.id) {
    emit('delete-template', deletingTemplate.value.id)
  }
  deletingTemplate.value = null
}

// Ingredient input mode
const ingredientInputMode = ref<'search' | 'manual' | 'ocr'>('search')

// New Template Model
const newName = ref('')
const newBrand = ref('')
const newDescription = ref('')
const newServings = ref<number>(1)
const newServingSize = ref<number | null>(null)
const newServingUnit = ref<string>('g')
const newIngredients = ref<RecipeIngredient[]>([])

const ingName = ref('')
const ingAmount = ref<number | null>(null)
const ingUnit = ref('g')
const ingCal = ref<number | null>(null)
const ingProt = ref<number | null>(null)
const ingCarb = ref<number | null>(null)
const ingFat = ref<number | null>(null)

const addIngredient = () => {
  if (!ingName.value.trim() || ingCal.value === null) return
  newIngredients.value.push({
    item_name: ingName.value.trim(),
    name: ingName.value.trim(),
    amount: ingAmount.value || 100,
    unit: ingUnit.value || 'g',
    cal: ingCal.value || 0,
    prot_g: ingProt.value || 0,
    carb_g: ingCarb.value || 0,
    fat_g: ingFat.value || 0
  })

  ingName.value = ''
  ingAmount.value = null
  ingCal.value = null
  ingProt.value = null
  ingCarb.value = null
  ingFat.value = null
}

const handleFoodSelectedForRecipe = (food: { name: string; brand?: string | null; cal: number; prot_g: number; carb_g: number; fat_g: number }) => {
  newIngredients.value.push({
    item_name: food.name,
    name: food.name,
    amount: 1,
    unit: 'serving',
    cal: food.cal,
    prot_g: food.prot_g,
    carb_g: food.carb_g,
    fat_g: food.fat_g
  })
}

const handleOcrSelectedForRecipe = (data: { name?: string; brand?: string; cal?: number; prot_g?: number; carb_g?: number; fat_g?: number }) => {
  if (data.cal !== undefined) {
    newIngredients.value.push({
      item_name: data.name || 'Scanned Ingredient',
      name: data.name || 'Scanned Ingredient',
      amount: 1,
      unit: 'serving',
      cal: data.cal || 0,
      prot_g: data.prot_g || 0,
      carb_g: data.carb_g || 0,
      fat_g: data.fat_g || 0
    })
  }
}

const recipeMicros = ref<Record<string, number | undefined>>({})

const removeIngredient = (idx: number) => {
  newIngredients.value.splice(idx, 1)
}

const openCreateModal = () => {
  editingTemplateId.value = null
  newName.value = ''
  newDescription.value = ''
  newServings.value = 1
  newServingSize.value = null
  newServingUnit.value = 'g'
  newIngredients.value = []
  recipeMicros.value = {}
  isRecipeMicrosOpen.value = false
  showCreateModal.value = true
}

const openEditModal = (tmpl: MealTemplate) => {
  editingTemplateId.value = tmpl.id || null
  newName.value = tmpl.name
  newDescription.value = tmpl.description || ''
  newServings.value = tmpl.num_serv || 1
  newIngredients.value = (tmpl.items || []).map((i: any) => ({
    item_name: i.item_name || i.name,
    name: i.item_name || i.name,
    amount: i.amount || 1,
    unit: i.unit || 'g',
    cal: i.cal || 0,
    prot_g: i.prot_g || 0,
    carb_g: i.carb_g || 0,
    fat_g: i.fat_g || 0
  }))
  recipeMicros.value = tmpl.micros ? { ...tmpl.micros } : {}
  isRecipeMicrosOpen.value = Object.values(recipeMicros.value).some(v => v !== undefined && v !== null && v > 0)
  showCreateModal.value = true
}

const batchTotals = computed(() => {
  const cal = newIngredients.value.reduce((acc: number, i: any) => acc + (Number(i.cal) || 0), 0)
  const prot_g = newIngredients.value.reduce((acc: number, i: any) => acc + (Number(i.prot_g) || 0), 0)
  const carb_g = newIngredients.value.reduce((acc: number, i: any) => acc + (Number(i.carb_g) || 0), 0)
  const fat_g = newIngredients.value.reduce((acc: number, i: any) => acc + (Number(i.fat_g) || 0), 0)
  return { cal, prot_g, carb_g, fat_g }
})

const perServingTotals = computed(() => {
  const s = Math.max(0.1, Number(newServings.value) || 1)
  return {
    cal: Math.round(batchTotals.value.cal / s),
    prot_g: Math.round((batchTotals.value.prot_g / s) * 10) / 10,
    carb_g: Math.round((batchTotals.value.carb_g / s) * 10) / 10,
    fat_g: Math.round((batchTotals.value.fat_g / s) * 10) / 10
  }
})

const handleCreateTemplate = () => {
  if (!newName.value.trim()) return

  // Clean empty micros
  const cleanedMicros: Record<string, number> = {}
  Object.entries(recipeMicros.value).forEach(([k, v]) => {
    if (v !== undefined && v !== null && !isNaN(v)) {
      cleanedMicros[k] = v
    }
  })

  const recipePayload = {
    name: newName.value.trim(),
    brand: newBrand.value.trim(),
    description: newDescription.value.trim() || null,
    cal: perServingTotals.value.cal,
    prot_g: perServingTotals.value.prot_g,
    carb_g: perServingTotals.value.carb_g,
    fat_g: perServingTotals.value.fat_g,
    num_serv: newServings.value || 1,
    items: newIngredients.value.map((i: any) => ({
      item_name: i.name || i.item_name,
      amount: i.amount,
      unit: i.unit,
      cal: i.cal,
      prot_g: i.prot_g,
      carb_g: i.carb_g,
      fat_g: i.fat_g
    })),
    micros: Object.keys(cleanedMicros).length > 0 ? cleanedMicros : undefined
  }

  if (editingTemplateId.value) {
    emit('edit-template', {
      id: editingTemplateId.value,
      ...recipePayload
    })
  } else {
    emit('create-template', recipePayload)
  }

  newName.value = ''
  newDescription.value = ''
  newServingSize.value = null
  newServingUnit.value = 'g'
  newIngredients.value = []
  recipeMicros.value = {
    sugar_g: undefined,
    sodium_mg: undefined,
    potassium_mg: undefined,
    caffeine_mg: undefined
  }
  editingTemplateId.value = null
  showCreateModal.value = false
}

const openShareModal = (tmpl: MealTemplate) => {
  selectedTemplateForShare.value = tmpl
  shareHandle.value = ''
  shareError.value = null
  shareMessage.value = null
  isSharing.value = false
  showShareModal.value = true
}

const handleShareSubmit = () => {
  if (!selectedTemplateForShare.value?.id || !shareHandle.value.trim()) return
  isSharing.value = true
  shareError.value = null
  shareMessage.value = null

  emit('share-template', selectedTemplateForShare.value.id, shareHandle.value.trim(), (res) => {
    isSharing.value = false
    if (res.success) {
      shareMessage.value = res.message || `Recipe sent to @${shareHandle.value.trim().replace(/^@/, '')}`
      setTimeout(() => {
        showShareModal.value = false
        selectedTemplateForShare.value = null
      }, 1500)
    } else {
      shareError.value = res.error || 'Failed to share recipe'
    }
  })
}

const openLogModal = (tmpl: MealTemplate) => {
  selectedTemplateForLog.value = tmpl
  logMultiplier.value = 1
  showLogModal.value = true
}

const confirmLog = () => {
  if (!selectedTemplateForLog.value) return
  emit('log-template', selectedTemplateForLog.value, logSlot.value, logMultiplier.value)
  showLogModal.value = false
  selectedTemplateForLog.value = null
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header with Create Button -->
    <SectionHeader :title="t('meals.recipes.title')" :description="t('meals.recipes.desc')" action-variant="amber"
      @action="openCreateModal" />

    <!-- Empty State -->
    <EmptySectionPlaceholder v-if="templates.length === 0" :title="t('meals.empty.recipes_title')"
      :description="t('meals.empty.recipes_desc')" :icon="BookOpen" icon-color-class="text-amber-400"
      icon-bg-class="bg-amber-950/60 border border-amber-800/60" />

    <!-- Template Cards Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div v-for="tmpl in templates" :key="tmpl.id"
        class="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl transition group">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition">{{ tmpl.name
                }}</span>
              <span v-if="tmpl.num_serv && tmpl.num_serv > 1"
                class="px-1.5 py-0.2 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-400/90">
                {{ tmpl.num_serv }} servings
              </span>
            </div>
            <div v-if="tmpl.description" class="text-xs text-slate-400 mt-0.5 line-clamp-1">{{ tmpl.description }}</div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" @click="openShareModal(tmpl)"
              class="text-slate-500 hover:text-amber-400 p-1 transition cursor-pointer" title="Share Recipe by Handle">
              <Share2 class="w-3.5 h-3.5" />
            </button>
            <button type="button" @click="openEditModal(tmpl)"
              class="text-slate-500 hover:text-amber-400 p-1 transition cursor-pointer" title="Edit Recipe">
              <Pencil class="w-3.5 h-3.5" />
            </button>
            <button type="button" @click="deletingTemplate = tmpl"
              class="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer" title="Delete Recipe">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Macro Badges -->
        <div class="grid grid-cols-4 gap-1.5 text-center font-mono">
          <div class="bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
            <div class="text-[9px] text-slate-500 uppercase font-sans">Energy</div>
            <div class="text-xs font-bold text-amber-400">{{ tmpl.cal }}</div>
          </div>
          <div class="bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
            <div class="text-[9px] text-slate-500 uppercase font-sans">Protein</div>
            <div class="text-xs font-bold text-emerald-300">{{ tmpl.prot_g }}g</div>
          </div>
          <div class="bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
            <div class="text-[9px] text-slate-500 uppercase font-sans">Carbs</div>
            <div class="text-xs font-bold text-yellow-400">{{ tmpl.carb_g }}g</div>
          </div>
          <div class="bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
            <div class="text-[9px] text-slate-500 uppercase font-sans">Fat</div>
            <div class="text-xs font-bold text-rose-400">{{ tmpl.fat_g }}g</div>
          </div>
        </div>

        <!-- Ingredients / Items Preview -->
        <div v-if="tmpl.items && tmpl.items.length > 0" class="text-[11px] text-slate-400 truncate">
          <span>{{tmpl.items.map((i: any) => `${i.item_name || i.name} (${i.amount}${i.unit})`).join(', ')}}</span>
        </div>

        <!-- Log Button -->
        <button type="button" @click="openLogModal(tmpl)"
          class="w-full py-2 rounded-xl bg-slate-950 hover:bg-amber-500 border border-slate-800 hover:border-amber-500 hover:text-slate-950 text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md">
          <Utensils class="w-3.5 h-3.5" />
          <span>{{ t('meals.recipes.log_btn') }}</span>
        </button>
      </div>
    </div>

    <!-- Create Recipe Modal -->
    <Modal v-if="showCreateModal" title="Create Recipe Blueprint" :icon="BookOpen" icon-color="text-amber-400"
      max-width-class="max-w-xl" @close="showCreateModal = false">
      <form @submit.prevent="handleCreateTemplate" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <FormInput v-model="newName" label="Recipe Name" placeholder="e.g. Post-Workout Smoothie" required
            input-class="focus:border-amber-500 text-xs py-2.5 px-3.5" class="sm:col-span-2" />

          <FormInput v-model="newServings" type="number" step="any" label="Yield (Servings)" placeholder="1" required
            min="0.1" max="50" input-class="focus:border-amber-500 font-mono text-xs text-center py-2.5 px-3.5" />

            <div class="space-y-1">
              <!-- Serving size field removed; replaced by num_serv in grid above -->
            </div>
        </div>

        <!-- Ingredients Builder with Mode Tabs -->
        <div class="space-y-3 pt-2 border-t border-slate-800/80">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-300">Add Ingredients</span>

            <div class="flex p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-semibold">
              <button type="button" @click="ingredientInputMode = 'search'" :class="[
                'px-2 py-1 rounded transition cursor-pointer flex items-center gap-1',
                ingredientInputMode === 'search' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              ]">
                <Search class="w-3 h-3" />
                <span>Search</span>
              </button>
              <button type="button" @click="ingredientInputMode = 'manual'" :class="[
                'px-2 py-1 rounded transition cursor-pointer flex items-center gap-1',
                ingredientInputMode === 'manual' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              ]">
                <PenTool class="w-3 h-3" />
                <span>Manual</span>
              </button>
              <button type="button" @click="ingredientInputMode = 'ocr'" :class="[
                'px-2 py-1 rounded transition cursor-pointer flex items-center gap-1',
                ingredientInputMode === 'ocr' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              ]">
                <Camera class="w-3 h-3" />
                <span>OCR</span>
              </button>
            </div>
          </div>

          <!-- Mode 1: Search Database -->
          <div v-if="ingredientInputMode === 'search'">
            <FoodSearchLookup @select-food="handleFoodSelectedForRecipe" />
          </div>

          <!-- Mode 2: OCR Label -->
          <div v-else-if="ingredientInputMode === 'ocr'">
            <NutritionLabelOcrModal @autofill="handleOcrSelectedForRecipe" />
          </div>

          <!-- Mode 3: Manual Values -->
          <div v-else class="space-y-2">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <FormInput v-model="ingName" placeholder="Ingredient name"
                input-class="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs"
                class="col-span-2" />
              <FormInput v-model="ingAmount" type="number" placeholder="Amount (100)"
                input-class="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
              <FormInput v-model="ingCal" type="number" placeholder="Calories"
                input-class="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
            </div>

            <div class="grid grid-cols-4 gap-2">
              <FormInput v-model="ingProt" type="number" placeholder="Prot (g)"
                input-class="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
              <FormInput v-model="ingCarb" type="number" placeholder="Carb (g)"
                input-class="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
              <FormInput v-model="ingFat" type="number" placeholder="Fat (g)"
                input-class="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
              <button type="button" @click="addIngredient"
                class="rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 text-xs font-bold py-1.5 transition active:scale-95 cursor-pointer">
                + Add
              </button>
            </div>
          </div>

          <!-- Ingredients List -->
          <div v-if="newIngredients.length > 0" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            <div v-for="(ing, idx) in newIngredients" :key="idx"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span class="text-slate-200">{{ ing.name }} ({{ ing.amount }}{{ ing.unit }})</span>
              <div class="flex items-center gap-2">
                <span class="font-mono text-amber-400">{{ ing.cal }} kcal</span>
                <button type="button" @click="removeIngredient(idx)"
                  class="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer">
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Live Per-Serving Nutrition Summary Bar -->
        <div v-if="newIngredients.length > 0" class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-amber-300">
              Per Serving <span class="font-normal text-slate-400">({{ newServings }} yield)</span>
            </span>
            <span v-if="newServings > 1" class="text-[11px] font-mono text-slate-500">
              Batch Total: {{ batchTotals.cal }} kcal
            </span>
          </div>
          <div class="grid grid-cols-4 gap-1.5 text-center font-mono">
            <div class="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
              <div class="text-[9px] text-slate-500 uppercase font-sans">Energy</div>
              <div class="text-xs font-bold text-amber-400">{{ perServingTotals.cal }}</div>
            </div>
            <div class="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
              <div class="text-[9px] text-slate-500 uppercase font-sans">Protein</div>
              <div class="text-xs font-bold text-emerald-300">{{ perServingTotals.prot_g }}g</div>
            </div>
            <div class="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
              <div class="text-[9px] text-slate-500 uppercase font-sans">Carbs</div>
              <div class="text-xs font-bold text-yellow-400">{{ perServingTotals.carb_g }}g</div>
            </div>
            <div class="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
              <div class="text-[9px] text-slate-500 uppercase font-sans">Fat</div>
              <div class="text-xs font-bold text-rose-400">{{ perServingTotals.fat_g }}g</div>
            </div>
          </div>
        </div>

        <!-- Collapsible Micronutrients Accordion Section -->
        <MicronutrientsAccordion v-model="recipeMicros" :micros-opt="microsOpt" />

        <button type="submit"
          class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md">
          <Check class="w-3.5 h-3.5 stroke-3" />
          <span>{{ editingTemplateId ? 'Save Changes' : 'Save Recipe Blueprint' }}</span>
        </button>
      </form>
    </Modal>

    <!-- Log Template Modal -->
    <Modal v-if="showLogModal && selectedTemplateForLog" title="Log Recipe as Meal" :icon="Utensils"
      icon-color="text-amber-400" max-width-class="max-w-md"
      @close="showLogModal = false; selectedTemplateForLog = null">
      <div class="space-y-4">
        <div>
          <div class="text-sm font-bold text-slate-100">{{ selectedTemplateForLog.name }}</div>
          <div class="text-xs text-slate-400 font-mono mt-0.5">
            1 Serving = {{ selectedTemplateForLog.serv_cal ?? selectedTemplateForLog.cal }} kcal • P:{{ selectedTemplateForLog.serv_prot ?? selectedTemplateForLog.prot_g }}g • C:{{
              selectedTemplateForLog.serv_carb ?? selectedTemplateForLog.carb_g }}g • F:{{ selectedTemplateForLog.serv_fat ?? selectedTemplateForLog.fat_g }}g
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-300">Meal Slot</label>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="slot in [
              { bit: MealFlags.BREAKFAST, label: t('meals.slot.breakfast') },
              { bit: MealFlags.LUNCH, label: t('meals.slot.lunch') },
              { bit: MealFlags.DINNER, label: t('meals.slot.dinner') },
              { bit: MealFlags.SNACK, label: t('meals.slot.snack') }
            ]" :key="slot.bit" type="button" @click="logSlot = slot.bit" :class="[
              'py-2 px-3 rounded-xl border text-xs font-semibold transition active:scale-95 cursor-pointer text-center',
              logSlot === slot.bit
                ? 'bg-amber-950/70 border-amber-500 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            ]">
              {{ slot.label }}
            </button>
          </div>
        </div>

        <div class="flex items-end gap-3">
          <FormInput v-model="logMultiplier" type="number" step="any" label="Number of Servings (Multiplier)" min="0.1"
            max="20" input-class="focus:border-amber-500 font-mono py-2" class="w-32" />
          <div class="text-xs font-mono text-amber-400 font-bold pb-3">
            = {{ Math.round(selectedTemplateForLog.serv_cal ?? selectedTemplateForLog.cal) * (logMultiplier || 1) }} kcal total
          </div>
        </div>

        <button type="button" @click="confirmLog"
          class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md">
          <Check class="w-3.5 h-3.5 stroke-3" />
          <span>Confirm & Log to Diary</span>
        </button>
      </div>
    </Modal>

    <!-- Share Recipe by Handle Modal -->
    <Modal v-if="showShareModal && selectedTemplateForShare" title="Share Recipe" :icon="Share2"
      icon-color="text-amber-400" max-width-class="max-w-md"
      @close="showShareModal = false; selectedTemplateForShare = null">
      <form @submit.prevent="handleShareSubmit" class="space-y-4">
        <div>
          <div class="text-sm font-bold text-slate-100">{{ selectedTemplateForShare.name }}</div>
          <p class="text-xs text-slate-400 mt-1">
            Send a copy of this complete recipe including all ingredients and macros to another user.
          </p>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-300">Recipient Username Handle</label>
          <div class="relative">
            <span
              class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-amber-400 font-bold font-mono z-10">@</span>
            <FormInput v-model="shareHandle" type="text" placeholder="username" required
              input-class="focus:border-amber-500 pl-8 pr-3.5 py-2.5 text-sm font-mono" />
          </div>
        </div>

        <!-- Success Alert -->
        <div v-if="shareMessage"
          class="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
          <Check class="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />
          <span>{{ shareMessage }}</span>
        </div>

        <!-- Error Alert -->
        <div v-else-if="shareError"
          class="p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
          <span>{{ shareError }}</span>
        </div>

        <button type="submit" :disabled="isSharing || !shareHandle.trim()"
          class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md">
          <Loader2 v-if="isSharing" class="w-3.5 h-3.5 animate-spin" />
          <template v-else>
            <Share2 class="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Send Recipe</span>
          </template>
        </button>
      </form>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <Modal v-if="deletingTemplate" :title="t('meals.recipes.delete_title')" :icon="Trash2" icon-color="text-rose-400"
      max-width-class="max-w-md" :confirm-text="t('meals.recipes.delete_btn')" confirm-variant="rose"
      :confirm-icon="Trash2" @close="deletingTemplate = null" @confirm="confirmDeleteTemplate">
      <div class="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/80 space-y-2">
        <div class="text-sm font-bold text-rose-300">
          {{ t('meals.recipes.delete_confirm_title', { name: deletingTemplate.name }) }}
        </div>
        <p class="text-xs text-rose-200/80 leading-relaxed">
          {{ t('meals.recipes.delete_warning') }}
        </p>
      </div>
    </Modal>
  </div>
</template>
