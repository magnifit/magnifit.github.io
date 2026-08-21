<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Utensils, Info, Pencil, Check } from '@lucide/vue'
import { filterTrackedMicroLabels, isMicroColumnTracked } from '../../../lib/bitmask'
import Modal from '../../atoms/Modal.vue'
import FormInput from '../../atoms/FormInput.vue'

interface NutritionData {
  title: string
  subtitle?: string
  cal: number
  prot_g: number
  carb_g: number
  fat_g: number
  num_serv?: number
  servings?: number
  micros?: Record<string, number | undefined>
}

const props = withDefaults(defineProps<{
  show: boolean
  data: NutritionData | null
  isEditable?: boolean
  microsOpt?: number
}>(), {
  isEditable: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save-micros', micros: Record<string, number>): void
  (e: 'save-meal', payload: {
    num_serv: number
    cal: number
    prot_g: number
    carb_g: number
    fat_g: number
    micros: Record<string, number>
  }): void
}>()

const isEditing = ref(false)
const editableServings = ref<number>(1)
const editableMicros = ref<Record<string, number | null>>({})

// Base per-1.0-serving values for scaling
const baseCal = ref<number>(0)
const baseProt = ref<number>(0)
const baseCarb = ref<number>(0)
const baseFat = ref<number>(0)
const baseMicros = ref<Record<string, number>>({})

const allMicroLabels: Record<string, { label: string; unit: string }> = {
  sugar_g: { label: 'Sugar', unit: 'g' },
  added_sugar_g: { label: 'Added Sugar', unit: 'g' },
  sat_fat_g: { label: 'Saturated Fat', unit: 'g' },
  trans_fat_g: { label: 'Trans Fat', unit: 'g' },
  mono_fat_g: { label: 'Monounsaturated Fat', unit: 'g' },
  poly_fat_g: { label: 'Polyunsaturated Fat', unit: 'g' },
  omega_3_mg: { label: 'Omega-3 Fatty Acids', unit: 'mg' },
  omega_6_mg: { label: 'Omega-6 Fatty Acids', unit: 'mg' },
  sodium_mg: { label: 'Sodium', unit: 'mg' },
  potassium_mg: { label: 'Potassium', unit: 'mg' },
  cholesterol_mg: { label: 'Cholesterol', unit: 'mg' },
  caffeine_mg: { label: 'Caffeine', unit: 'mg' },
  calcium_mg: { label: 'Calcium', unit: 'mg' },
  iron_mg: { label: 'Iron', unit: 'mg' },
  magnesium_mg: { label: 'Magnesium', unit: 'mg' },
  zinc_mg: { label: 'Zinc', unit: 'mg' },
  vit_a_mcg: { label: 'Vitamin A', unit: 'mcg' },
  vit_c_mg: { label: 'Vitamin C', unit: 'mg' },
  vit_d_mcg: { label: 'Vitamin D', unit: 'mcg' },
  vit_b12_mcg: { label: 'Vitamin B-12', unit: 'mcg' }
}

const microLabels = computed(() =>
  filterTrackedMicroLabels(allMicroLabels, props.microsOpt)
)

watch(
  () => props.data,
  (newData) => {
    isEditing.value = false
    const initialServings = Number((newData?.num_serv ?? newData?.servings) || 1)
    editableServings.value = initialServings

    // Calculate base values per single serving (1.0)
    const factor = initialServings > 0 ? initialServings : 1
    baseCal.value = (newData?.cal || 0) / factor
    baseProt.value = (newData?.prot_g || 0) / factor
    baseCarb.value = (newData?.carb_g || 0) / factor
    baseFat.value = (newData?.fat_g || 0) / factor

    const initialMicros: Record<string, number | null> = {}
    const baseMicrosMap: Record<string, number> = {}

    Object.keys(microLabels).forEach(key => {
      const val = newData?.micros?.[key] !== undefined && newData.micros[key] !== null
        ? Number(newData.micros[key])
        : null
      initialMicros[key] = val
      if (val !== null) {
        baseMicrosMap[key] = val / factor
      }
    })

    editableMicros.value = initialMicros
    baseMicros.value = baseMicrosMap
  },
  { immediate: true, deep: true }
)

const handleServingsChange = () => {
  const s = Number(editableServings.value) || 1
  Object.keys(baseMicros.value).forEach(key => {
    editableMicros.value[key] = Math.round(baseMicros.value[key] * s * 10) / 10
  })
}

const liveCal = computed(() => {
  if (!isEditing.value) return props.data?.cal || 0
  const s = Number(editableServings.value) || 1
  return Math.round(baseCal.value * s)
})

const liveProt = computed(() => {
  if (!isEditing.value) return props.data?.prot_g || 0
  const s = Number(editableServings.value) || 1
  return Math.round(baseProt.value * s * 10) / 10
})

const liveCarb = computed(() => {
  if (!isEditing.value) return props.data?.carb_g || 0
  const s = Number(editableServings.value) || 1
  return Math.round(baseCarb.value * s * 10) / 10
})

const liveFat = computed(() => {
  if (!isEditing.value) return props.data?.fat_g || 0
  const s = Number(editableServings.value) || 1
  return Math.round(baseFat.value * s * 10) / 10
})

const availableMicros = computed(() => {
  if (!props.data?.micros) return []
  return Object.entries(props.data.micros)
    .filter(([k, v]) => v !== undefined && v !== null && !isNaN(v) && v > 0 && isMicroColumnTracked(k, props.microsOpt))
    .map(([k, v]) => ({
      key: k,
      label: allMicroLabels[k]?.label || k.replace(/_/g, ' '),
      unit: allMicroLabels[k]?.unit || '',
      value: v
    }))
})

const handleSave = () => {
  const resultMicros: Record<string, number> = {}
  Object.entries(editableMicros.value).forEach(([k, v]) => {
    if (v !== null && v !== undefined && !isNaN(v) && v > 0) {
      resultMicros[k] = v
    }
  })

  const s = Number(editableServings.value) || 1
  emit('save-meal', {
    num_serv: s,
    cal: Math.round(baseCal.value * s),
    prot_g: Math.round(baseProt.value * s * 10) / 10,
    carb_g: Math.round(baseCarb.value * s * 10) / 10,
    fat_g: Math.round(baseFat.value * s * 10) / 10,
    micros: resultMicros
  })
  emit('save-micros', resultMicros)
  isEditing.value = false
}
</script>

<template>
  <Modal v-if="show && data" title="Nutritional Breakdown" :icon="Utensils" icon-color="text-amber-400"
    max-width-class="max-w-md" @close="emit('close')">
    <div class="space-y-4">
      <!-- Title & Subtitle Header -->
      <div class="space-y-1">
        <h3 class="text-lg font-bold text-slate-100 leading-tight">{{ data.title }}</h3>
        <p v-if="data.subtitle" class="text-xs text-slate-400 font-medium">{{ data.subtitle }}</p>
      </div>
      <!-- Servings & Base size Row -->
      <div class="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800/60 pb-3">
        <div class="text-xs font-semibold text-slate-300">
          <span v-if="data.num_serv && data.num_serv > 1">Servings</span>
          <span v-else>Yield</span>
        </div>

        <div class="flex items-center gap-1.5">
          <template v-if="isEditing">
            <FormInput
              v-model="editableServings"
              type="number"
              step="any"
              min="0.1"
              max="50"
              @input="handleServingsChange"
              input-class="bg-slate-900 border-amber-500 rounded-lg px-2.5 py-1 text-xs font-mono font-bold !text-amber-300 text-right"
              class="w-20"
            />
            <span class="text-xs text-slate-400">x</span>
          </template>
          <template v-else>
            <span v-if="data.num_serv && data.num_serv > 1" class="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md">
              {{ data.num_serv }}x servings
            </span>
          </template>
        </div>
      </div>

      <!-- Main Macronutrient Grid (Dynamic live preview when editing) -->
      <div class="grid grid-cols-4 gap-2 text-center">
        <div class="bg-slate-950/80 p-2 sm:p-2.5 rounded-xl border border-slate-800">
          <div class="text-[10px] text-slate-400 uppercase font-bold">
            <span class="inline min-[360px]:hidden">Cals</span>
            <span class="hidden min-[360px]:inline">Calories</span>
          </div>
          <div class="text-sm font-bold font-mono text-slate-100 mt-0.5">{{ liveCal }}</div>
          <div class="text-[9px] text-slate-500">kcal</div>
        </div>

        <div class="bg-slate-950/80 p-2 sm:p-2.5 rounded-xl border border-emerald-900/40">
          <div class="text-[10px] text-emerald-400 uppercase font-bold">
            <span class="inline min-[360px]:hidden">Prot</span>
            <span class="hidden min-[360px]:inline">Protein</span>
          </div>
          <div class="text-sm font-bold font-mono text-emerald-300 mt-0.5">{{ liveProt }}</div>
          <div class="text-[9px] text-emerald-500">grams</div>
        </div>

        <div class="bg-slate-950/80 p-2.5 rounded-xl border border-amber-900/40">
          <div class="text-[10px] text-amber-400 uppercase font-bold">Carbs</div>
          <div class="text-sm font-bold font-mono text-amber-300 mt-0.5">{{ liveCarb }}</div>
          <div class="text-[9px] text-amber-500">grams</div>
        </div>

        <div class="bg-slate-950/80 p-2.5 rounded-xl border border-rose-900/40">
          <div class="text-[10px] text-rose-400 uppercase font-bold">Fat</div>
          <div class="text-sm font-bold font-mono text-rose-300 mt-0.5">{{ liveFat }}</div>
          <div class="text-[9px] text-rose-500">grams</div>
        </div>
      </div>

      <!-- Detailed Tracked Micronutrients List -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Info class="w-3.5 h-3.5 text-amber-400" />
            <span>Tracked Micronutrients & Details</span>
          </div>

          <!-- Edit Button (Only visible when isEditable is true) -->
          <div v-if="isEditable">
            <button v-if="!isEditing" type="button" @click="isEditing = true"
              class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-amber-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer">
              <Pencil class="w-3 h-3" />
              <span>Edit Details</span>
            </button>

            <div v-else class="flex items-center gap-1.5">
              <button type="button" @click="isEditing = false"
                class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 text-xs transition cursor-pointer">
                Cancel
              </button>
              <button type="button" @click="handleSave"
                class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-sm">
                <Check class="w-3 h-3 stroke-3" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Editable Form Mode -->
        <div v-if="isEditing"
          class="max-h-60 overflow-y-auto border border-slate-800/80 rounded-xl p-3 bg-slate-950/60">
          <div class="grid grid-cols-2 gap-3">
            <FormInput
              v-for="(meta, key) in microLabels"
              :key="key"
              v-model="editableMicros[key]"
              type="number"
              step="any"
              min="0"
              :label="`${meta.label} (${meta.unit})`"
              placeholder="0"
              input-class="focus:border-amber-500 font-mono text-xs py-1.5 px-2.5"
            />
          </div>
        </div>

        <!-- Read-Only Display Mode -->
        <template v-else>
          <div v-if="availableMicros.length === 0"
            class="p-4 rounded-xl bg-slate-950/50 border border-slate-900 text-center text-xs text-slate-500">
            No additional micronutrients recorded for this item.
          </div>

          <div v-else class="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            <div v-for="micro in availableMicros" :key="micro.key"
              class="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
              <span class="text-slate-300 font-medium">{{ micro.label }}</span>
              <span class="font-mono font-bold text-amber-400">
                {{ micro.value }} <span class="text-[10px] text-slate-500 font-normal">{{ micro.unit }}</span>
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Modal>
</template>
