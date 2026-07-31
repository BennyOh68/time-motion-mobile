<template>
  <Teleport to="body">
    <div v-if="visible" class="picker-overlay" @click.self="confirm">
      <div class="picker-modal">
        <div class="picker-body">
          <!-- Day column: 1–31 -->
          <div class="scroll-column day-column">
            <div class="column-label">Day</div>
            <div class="scroll-track" ref="dayTrackRef">
              <div
                v-for="d in days"
                :key="d"
                class="scroll-item"
                :class="{ active: d === selectedDay }"
                @click="selectedDay = d"
              >
                {{ d }}
              </div>
            </div>
          </div>

          <!-- Month column: Jan–Dec -->
          <div class="scroll-column month-column">
            <div class="column-label">Month</div>
            <div class="scroll-track" ref="monthTrackRef">
              <div
                v-for="m in months"
                :key="m.value"
                class="scroll-item"
                :class="{ active: m.value === selectedMonth }"
                @click="selectedMonth = m.value"
              >
                {{ m.label }}
              </div>
            </div>
          </div>

          <!-- Year column: range of years -->
          <div class="scroll-column year-column">
            <div class="column-label">Year</div>
            <div class="scroll-track" ref="yearTrackRef">
              <div
                v-for="y in years"
                :key="y"
                class="scroll-item"
                :class="{ active: y === selectedYear }"
                @click="selectedYear = y"
              >
                {{ y }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'update:visible'])

// ── Generate options ──
const days = Array.from({ length: 31 }, (_, i) => i + 1) // 1..31
const months = [
  { value: '01', label: 'Jan' }, { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' }, { value: '04', label: 'Apr' },
  { value: '05', label: 'May' }, { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' }, { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' }, { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i) // ±5 years

// ── Selected state ──
const selectedDay = ref(1) // will be overwritten on open
const selectedMonth = ref('01')
const selectedYear = ref(currentYear)

// ── Track refs for scroll-to ──
const dayTrackRef = ref(null)
const monthTrackRef = ref(null)
const yearTrackRef = ref(null)

// ── Parse incoming modelValue on open ──
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      if (props.modelValue && /^\d{4}-\d{2}-\d{2}$/.test(props.modelValue)) {
        const [y, m, d] = props.modelValue.split('-')
        selectedYear.value = parseInt(y, 10)
        selectedMonth.value = m
        selectedDay.value = parseInt(d, 10)
      } else {
        // Default to today
        const now = new Date()
        selectedYear.value = now.getFullYear()
        selectedMonth.value = String(now.getMonth() + 1).padStart(2, '0')
        selectedDay.value = now.getDate()
      }
      await nextTick()
      scrollToActive()
    }
  }
)

function scrollToActive() {
  if (dayTrackRef.value) {
    const idx = days.findIndex(d => d === selectedDay.value)
    const item = dayTrackRef.value.children[idx]
    if (item) item.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  if (monthTrackRef.value) {
    const idx = months.findIndex(m => m.value === selectedMonth.value)
    const item = monthTrackRef.value.children[idx]
    if (item) item.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  if (yearTrackRef.value) {
    const idx = years.findIndex(y => y === selectedYear.value)
    const item = yearTrackRef.value.children[idx]
    if (item) item.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
}

function confirm() {
  const y = selectedYear.value
  const m = selectedMonth.value
  const d = String(selectedDay.value).padStart(2, '0')
  emit('update:modelValue', `${y}-${m}-${d}`)
  emit('update:visible', false)
}
</script>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.picker-modal {
  width: 100%;
  max-width: 500px;
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding-bottom: env(safe-area-inset-bottom, 16px);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.picker-body {
  display: flex;
  padding: 16px 12px 24px;
  gap: 12px;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
}

.scroll-column {
  flex: 1;
  max-width: 110px;
}

.column-label {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.scroll-track {
  max-height: 260px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: y mandatory;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 8px 0;
}

.scroll-item {
  padding: 14px 10px;
  text-align: center;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  scroll-snap-align: center;
  color: #94a3b8;
  transition: all 0.12s;
  border-radius: 4px;
  margin: 0 8px;
}

.scroll-item.active {
  color: #1e293b;
  font-weight: 700;
  font-size: 22px;
  background: #dbeafe;
  border-radius: 8px;
}
</style>
