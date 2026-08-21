<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'

interface Props {
  proteinG?: number
  carbsG?: number
  fatG?: number
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  isLoading: false
})

const isActivated = ref(false)

const triggerAnimation = () => {
  if (!props.isLoading) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isActivated.value = true
      })
    })
  } else {
    isActivated.value = false
  }
}

onMounted(() => {
  triggerAnimation()
})

watch(
  () => props.isLoading,
  (loading) => {
    if (!loading) {
      triggerAnimation()
    } else {
      isActivated.value = false
    }
  }
)

const proteinCal = computed(() => (props.proteinG || 0) * 4)
const carbsCal = computed(() => (props.carbsG || 0) * 4)
const fatCal = computed(() => (props.fatG || 0) * 9)
const totalMacroCal = computed(() => proteinCal.value + carbsCal.value + fatCal.value)

const proteinPct = computed(() =>
  totalMacroCal.value > 0 ? Math.min(100, Math.round((proteinCal.value / totalMacroCal.value) * 100)) : 0
)
const carbsPct = computed(() =>
  totalMacroCal.value > 0 ? Math.min(100, Math.round((carbsCal.value / totalMacroCal.value) * 100)) : 0
)
const fatPct = computed(() =>
  totalMacroCal.value > 0 ? Math.min(100, Math.round((fatCal.value / totalMacroCal.value) * 100)) : 0
)

const proteinDeg = computed(() => {
  if (!isActivated.value || props.isLoading) return '0deg'
  return `${proteinPct.value * 3.6}deg`
})
const carbsDeg = computed(() => {
  if (!isActivated.value || props.isLoading) return '0deg'
  return `${carbsPct.value * 3.6}deg`
})
const fatDeg = computed(() => {
  if (!isActivated.value || props.isLoading) return '0deg'
  return `${fatPct.value * 3.6}deg`
})
</script>

<template>
  <div class="space-y-4">
    <!-- Macro Distribution Overview Linear Bar -->
    <div class="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex gap-0.5 border border-slate-800/80">
      <div v-if="isLoading" class="w-full bg-slate-800 animate-pulse"></div>
      <template v-else>
        <div class="bg-emerald-500 transition-all duration-700 ease-out"
          :style="{ width: isActivated ? `${proteinPct}%` : '0%' }" :title="`Protein: ${proteinPct}%`"></div>
        <div class="bg-amber-400 transition-all duration-700 ease-out"
          :style="{ width: isActivated ? `${carbsPct}%` : '0%' }" :title="`Carbs: ${carbsPct}%`"></div>
        <div class="bg-rose-500 transition-all duration-700 ease-out"
          :style="{ width: isActivated ? `${fatPct}%` : '0%' }" :title="`Fat: ${fatPct}%`"></div>
      </template>
    </div>

    <!-- Macro Pure CSS Circular Gauges Directly on Parent Card -->
    <div class="grid grid-cols-3 gap-2 sm:gap-4 text-center">
      <!-- Protein Gauge -->
      <div class="flex flex-col items-center gap-1.5">
        <span class="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400">Protein</span>

        <div
          class="macro-gauge-p relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[6px] sm:p-[7px] flex items-center justify-center my-1 shadow-inner active:scale-[0.98] transition-transform"
          :class="isLoading ? 'opacity-40 animate-pulse' : 'opacity-100'" :style="{ '--p-deg': proteinDeg }">
          <!-- Inner Cutout -->
          <div
            class="w-full h-full rounded-full bg-slate-900 flex flex-col items-center justify-center shadow-lg select-none">
            <span v-if="isLoading" class="text-xs text-slate-500 font-bold">--</span>
            <template v-else>
              <span class="text-xs sm:text-sm font-black text-slate-100 leading-none">{{ proteinG }}g</span>
              <span class="text-[9px] sm:text-[10px] font-bold text-emerald-400 mt-0.5">{{ proteinPct }}%</span>
            </template>
          </div>
        </div>

        <div class="text-[10px] text-slate-400 font-medium">
          {{ isLoading ? '--' : `${proteinCal} kcal` }}
        </div>
      </div>

      <!-- Carbs Gauge -->
      <div class="flex flex-col items-center gap-1.5">
        <span class="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-400">Carbs</span>

        <div
          class="macro-gauge-c relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1.5 sm:p-1.75 flex items-center justify-center my-1 shadow-inner active:scale-[0.98] transition-transform"
          :class="isLoading ? 'opacity-40 animate-pulse' : 'opacity-100'" :style="{ '--c-deg': carbsDeg }">
          <!-- Inner Cutout -->
          <div
            class="w-full h-full rounded-full bg-slate-900 flex flex-col items-center justify-center shadow-lg select-none">
            <span v-if="isLoading" class="text-xs text-slate-500 font-bold">--</span>
            <template v-else>
              <span class="text-xs sm:text-sm font-black text-slate-100 leading-none">{{ carbsG }}g</span>
              <span class="text-[9px] sm:text-[10px] font-bold text-amber-400 mt-0.5">{{ carbsPct }}%</span>
            </template>
          </div>
        </div>

        <div class="text-[10px] text-slate-400 font-medium">
          {{ isLoading ? '--' : `${carbsCal} kcal` }}
        </div>
      </div>

      <!-- Fat Gauge -->
      <div class="flex flex-col items-center gap-1.5">
        <span class="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-rose-400">Fat</span>

        <div
          class="macro-gauge-f relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1.5 sm:p-1.75 flex items-center justify-center my-1 shadow-inner active:scale-[0.98] transition-transform"
          :class="isLoading ? 'opacity-40 animate-pulse' : 'opacity-100'" :style="{ '--f-deg': fatDeg }">
          <!-- Inner Cutout -->
          <div
            class="w-full h-full rounded-full bg-slate-900 flex flex-col items-center justify-center shadow-lg select-none">
            <span v-if="isLoading" class="text-xs text-slate-500 font-bold">--</span>
            <template v-else>
              <span class="text-xs sm:text-sm font-black text-slate-100 leading-none">{{ fatG }}g</span>
              <span class="text-[9px] sm:text-[10px] font-bold text-rose-400 mt-0.5">{{ fatPct }}%</span>
            </template>
          </div>
        </div>

        <div class="text-[10px] text-slate-400 font-medium">
          {{ isLoading ? '--' : `${fatCal} kcal` }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@property --p-deg {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@property --c-deg {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@property --f-deg {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.macro-gauge-p {
  background: conic-gradient(#10b981 var(--p-deg, 0deg), rgba(30, 41, 59, 0.6) 0deg);
  transition: --p-deg 0.7s ease-out;
}

.macro-gauge-c {
  background: conic-gradient(#fbbf24 var(--c-deg, 0deg), rgba(30, 41, 59, 0.6) 0deg);
  transition: --c-deg 0.7s ease-out;
}

.macro-gauge-f {
  background: conic-gradient(#f43f5e var(--f-deg, 0deg), rgba(30, 41, 59, 0.6) 0deg);
  transition: --f-deg 0.7s ease-out;
}
</style>
