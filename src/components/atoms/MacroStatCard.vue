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
    if (!loading) triggerAnimation()
    else isActivated.value = false
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
</script>

<template>
  <div
    class="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col divide-y divide-slate-800/80 transition-all duration-300 h-full">

    <!-- Protein Row -->
    <div class="relative flex flex-1 items-center gap-2 px-2.5 overflow-hidden select-none">
      <div
        class="absolute inset-0 bg-linear-to-r from-emerald-500/20 to-emerald-500/5 border-r border-emerald-400/40 transition-all duration-700 ease-out pointer-events-none"
        :style="{ width: isActivated && !isLoading ? `${proteinPct}%` : '0%' }">
        <div class="absolute top-0 right-0 inset-y-0 w-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
      </div>
      <span
        class="relative z-10 text-[10px] font-black uppercase tracking-widest text-emerald-400 w-4 shrink-0">P</span>
      <span class="relative z-10 flex-1 text-sm font-black text-slate-100 tabular-nums">
        <span v-if="isLoading" class="text-slate-500">--</span>
        <span v-else>{{ proteinG }}g</span>
      </span>
      <span class="relative z-10 text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
        {{ isLoading ? '--' : `${proteinPct}%` }}
      </span>
    </div>

    <!-- Carbs Row -->
    <div class="relative flex flex-1 items-center gap-2 px-2.5 overflow-hidden select-none">
      <div
        class="absolute inset-0 bg-linear-to-r from-amber-500/20 to-amber-500/5 border-r border-amber-400/40 transition-all duration-700 ease-out pointer-events-none"
        :style="{ width: isActivated && !isLoading ? `${carbsPct}%` : '0%' }">
        <div class="absolute top-0 right-0 inset-y-0 w-0.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
      </div>
      <span class="relative z-10 text-[10px] font-black uppercase tracking-widest text-amber-400 w-4 shrink-0">C</span>
      <span class="relative z-10 flex-1 text-sm font-black text-slate-100 tabular-nums">
        <span v-if="isLoading" class="text-slate-500">--</span>
        <span v-else>{{ carbsG }}g</span>
      </span>
      <span class="relative z-10 text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
        {{ isLoading ? '--' : `${carbsPct}%` }}
      </span>
    </div>

    <!-- Fat Row -->
    <div class="relative flex flex-1 items-center gap-2 px-2.5 overflow-hidden select-none">
      <div
        class="absolute inset-0 bg-linear-to-r from-rose-500/20 to-rose-500/5 border-r border-rose-400/40 transition-all duration-700 ease-out pointer-events-none"
        :style="{ width: isActivated && !isLoading ? `${fatPct}%` : '0%' }">
        <div class="absolute top-0 right-0 inset-y-0 w-0.5 bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
      </div>
      <span class="relative z-10 text-[10px] font-black uppercase tracking-widest text-rose-400 w-4 shrink-0">F</span>
      <span class="relative z-10 flex-1 text-sm font-black text-slate-100 tabular-nums">
        <span v-if="isLoading" class="text-slate-500">--</span>
        <span v-else>{{ fatG }}g</span>
      </span>
      <span class="relative z-10 text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
        {{ isLoading ? '--' : `${fatPct}%` }}
      </span>
    </div>
  </div>
</template>
