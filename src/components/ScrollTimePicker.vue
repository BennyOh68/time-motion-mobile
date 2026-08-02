<template>
  <Teleport to="body">
    <div v-if="visible" class="picker-overlay" @click.self="confirm">
      <div class="picker-modal">
        <div v-if="title" class="picker-title">{{ title }}</div>
        <div class="picker-body">
          <!-- Hour column: 07 am to 09 pm -->
          <div class="scroll-column hour-column">
            <div class="column-label">Hour</div>
            <div class="scroll-column-inner">
              <div class="scroll-track" ref="hourTrackRef" @scroll="onHourScroll">
                <div
                  v-for="h in hours"
                  :key="h.value"
                  class="scroll-item"
                  :class="{ active: h.value === selectedHour }"
                  @click="selectHour(h.value)"
                >
                  {{ h.label }}
                </div>
              </div>
              <div class="highlight-bar"></div>
            </div>
          </div>

          <!-- Minute column: 5-min intervals -->
          <div class="scroll-column minute-column">
            <div class="column-label">Min</div>
            <div class="scroll-column-inner">
              <div class="scroll-track" ref="minTrackRef" @scroll="onMinScroll">
                <div
                  v-for="m in minutes"
                  :key="m"
                  class="scroll-item"
                  :class="{ active: String(m).padStart(2, '0') === selectedMinute }"
                  @click="selectMinute(String(m).padStart(2, '0'))"
                >
                  {{ String(m).padStart(2, '0') }}
                </div>
              </div>
              <div class="highlight-bar"></div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="copyValue" class="picker-footer">
        <button class="btn-copy-last" @click.stop="applyCopyValue">
          <span class="copy-label">Copy Last</span>
          <span class="copy-value">{{ copyLabel }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  copyLabel: { type: String, default: '' },
  copyValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'update:visible'])

// ── Copy-last button: apply copyValue as the selected time and confirm ──
function applyCopyValue() {
  if (!props.copyValue) return
  const [h, m] = props.copyValue.split(':')
  if (h && m) {
    selectedHour.value = h
    selectedMinute.value = m
    nextTick(() => {
      scrollToActive()
      // Emit after the scroll, using confirm logic
      const display = formatDisplay(selectedHour.value, selectedMinute.value)
      emit('update:modelValue', display)
      emit('update:visible', false)
    })
  }
}

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

// ── Debounce timers for scroll detection ──
let hourScrollTimer = null
let minScrollTimer = null

// ── Parse incoming modelValue on open ──
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
      // Wait for layout before scrolling into position
      requestAnimationFrame(() => {
        scrollToActive()
      })
    }
  }
)

function scrollToActive() {
  if (hourTrackRef.value) {
    const el = hourTrackRef.value
    const idx = hours.findIndex(h => h.value === selectedHour.value)
    const item = el.querySelectorAll('.scroll-item')[idx]
    if (item) {
      el.scrollTop = item.offsetTop - el.clientHeight / 2 + item.offsetHeight / 2
    }
  }
  if (minTrackRef.value) {
    const el = minTrackRef.value
    const idx = minutes.findIndex(m => String(m).padStart(2, '0') === selectedMinute.value)
    const item = el.querySelectorAll('.scroll-item')[idx]
    if (item) {
      el.scrollTop = item.offsetTop - el.clientHeight / 2 + item.offsetHeight / 2
    }
  }
}

// ── Scroll detection: find item closest to center after scroll stops ──
function getClosestItem(trackEl, values, valueKey) {
  if (!trackEl) return null
  const trackRect = trackEl.getBoundingClientRect()
  const centerY = trackRect.top + trackRect.height / 2
  const items = trackEl.querySelectorAll('.scroll-item')
  let closest = null
  let minDist = Infinity
  items.forEach((item, i) => {
    const rect = item.getBoundingClientRect()
    const itemCenter = rect.top + rect.height / 2
    const dist = Math.abs(centerY - itemCenter)
    if (dist < minDist) {
      minDist = dist
      closest = valueKey ? values[i][valueKey] : values[i]
    }
  })
  return closest
}

function onHourScroll() {
  clearTimeout(hourScrollTimer)
  hourScrollTimer = setTimeout(() => {
    const closest = getClosestItem(hourTrackRef.value, hours, 'value')
    if (closest !== null && closest !== selectedHour.value) {
      selectedHour.value = closest
    }
  }, 100)
}

function onMinScroll() {
  clearTimeout(minScrollTimer)
  minScrollTimer = setTimeout(() => {
    const closest = getClosestItem(minTrackRef.value, minutes, null)
    if (closest !== null) {
      const val = String(closest).padStart(2, '0')
      if (val !== selectedMinute.value) {
        selectedMinute.value = val
      }
    }
  }, 100)
}

function selectHour(value) {
  selectedHour.value = value
  scrollToActive()
}

function selectMinute(value) {
  selectedMinute.value = value
  scrollToActive()
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

.picker-title {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  padding: 16px 12px 0;
  user-select: none;
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

.scroll-column-inner {
  position: relative;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.scroll-track {
  position: relative;
  max-height: 260px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: y mandatory;
  background: transparent;
  /* Padding lets first/last items scroll to center: (260/2 - 48/2) = 106px */
  padding: 106px 0;
}

/* ── Fixed center highlight bar (behind numbers) ── */
.highlight-bar {
  position: absolute;
  top: 50%;
  left: 6px;
  right: 12px;
  transform: translateY(-50%);
  height: 48px;
  background: #dbeafe;
  border-radius: 8px;
  pointer-events: none;
  z-index: 0;
}

.scroll-item {
  position: relative;
  z-index: 1;
  padding: 14px 10px;
  text-align: center;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  scroll-snap-align: center;
  color: #94a3b8;
  transition: color 0.12s, font-weight 0.12s;
  border-radius: 4px;
  margin: 0 8px;
  background: transparent;
}

.scroll-item.active {
  color: #1e293b;
  font-weight: 700;
  font-size: 22px;
}

.time-input {
  cursor: pointer;
  caret-color: transparent;
  color: #3b82f6 !important;
  font-weight: 600;
  text-align: center;
  font-size: 14px !important;
}

.time-input::placeholder {
  color: #94a3b8;
  font-weight: 400;
  font-size: 16px;
}

/* ── Copy-last footer ── */
.picker-footer {
  padding: 0 12px 16px;
  display: flex;
  justify-content: center;
}

.btn-copy-last {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 24px;
  background: #f1f5f9;
  border: 1px dashed #94a3b8;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy-last:hover {
  background: #e2e8f0;
  border-color: #64748b;
}

.btn-copy-last:active {
  background: #dbeafe;
  border-color: #3b82f6;
}

.copy-label {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.copy-value {
  font-size: 16px;
  font-weight: 700;
  color: #3b82f6;
}
</style>
