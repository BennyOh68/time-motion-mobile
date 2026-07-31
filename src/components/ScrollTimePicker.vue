<template>
  <Teleport to="body">
    <div v-if="visible" class="picker-overlay" @click.self="confirm">
      <div class="picker-modal">
        <div class="picker-body">
          <!-- Hour column: 07 am to 09 pm -->
          <div class="scroll-column hour-column">
            <div class="column-label">Hour</div>
            <div class="scroll-track" ref="hourTrackRef">
              <div
                v-for="h in hours"
                :key="h.value"
                class="scroll-item"
                :class="{ active: h.value === selectedHour }"
                @click="selectedHour = h.value"
              >
                {{ h.label }}
              </div>
            </div>
          </div>

          <!-- Minute column: 5-min intervals -->
          <div class="scroll-column minute-column">
            <div class="column-label">Min</div>
            <div class="scroll-track" ref="minTrackRef">
              <div
                v-for="m in minutes"
                :key="m"
                class="scroll-item"
                :class="{ active: String(m).padStart(2, '0') === selectedMinute }"
                @click="selectedMinute = String(m).padStart(2, '0')"
              >
                {{ String(m).padStart(2, '0') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'update:visible'])

// Generate hours 07–21 with am/pm labels
const hours = Array.from({ length: 15 }, (_, i) => {
  const val = i + 7 // 7..21
  const ampm = val < 12 ? 'am' : 'pm'
  const display = val <= 12 ? val : val - 12
  return {
    value: String(val).padStart(2, '0'),
    label: `${String(display).padStart(2, '0')} ${ampm}`,
  }
})

// Generate minutes 00, 05, 10, ..., 55
const minutes = Array.from({ length: 12 }, (_, i) => i * 5)

const selectedHour = ref('07')
const selectedMinute = ref('00')

const hourTrackRef = ref(null)
const minTrackRef = ref(null)

// Parse incoming modelValue on open
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      if (props.modelValue) {
        const [h, m] = props.modelValue.split(':')
        if (h && hours.some(x => x.value === h)) selectedHour.value = h
        if (m) selectedMinute.value = m
      } else {
        selectedHour.value = '07'
        selectedMinute.value = '00'
      }
      await nextTick()
      scrollToActive()
    }
  }
)

function scrollToActive() {
  if (hourTrackRef.value) {
    const idx = hours.findIndex(h => h.value === selectedHour.value)
    const item = hourTrackRef.value.children[idx]
    if (item) item.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  if (minTrackRef.value) {
    const idx = minutes.findIndex(m => String(m).padStart(2, '0') === selectedMinute.value)
    const item = minTrackRef.value.children[idx]
    if (item) item.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
}

function confirm() {
  const display = formatDisplay(selectedHour.value, selectedMinute.value)
  emit('update:modelValue', display) // HH:MM am/pm for display
  emit('update:visible', false)
}

/**
 * Convert internal 24h HH:MM to display HH:MM am/pm
 */
function formatDisplay(h, m) {
  const hh = parseInt(h, 10)
  const ampm = hh < 12 ? 'am' : 'pm'
  const displayHour = hh <= 12 ? hh : hh - 12
  return `${String(displayHour).padStart(2, '0')}:${m} ${ampm}`
}

// Expose for parent to get 24-hour format
defineExpose({
  getStorageValue: () => `${selectedHour.value}:${selectedMinute.value}`,
})
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
  max-width: 140px;
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
