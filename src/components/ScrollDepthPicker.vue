<template>
  <Teleport to="body">
    <div v-if="visible" class="picker-overlay" @click.self="confirm">
      <div class="picker-modal">
        <div v-if="title" class="picker-title">{{ title }}</div>
        <div class="picker-body">
          <!-- Tens digit column: infinite drum 0–9 -->
          <div class="scroll-column">
            <div class="scroll-column-inner">
              <div class="scroll-track" ref="tensTrackRef" @scroll="onTensScroll">
                <div
                  v-for="(_, idx) in drumArray"
                  :key="'t' + idx"
                  class="scroll-item"
                  :class="{ active: String(idx % 10) === selectedTens && isInMiddleCycle(idx) }"
                  @click="selectTensByIndex(idx)"
                >
                  {{ idx % 10 }}
                </div>
              </div>
              <div class="highlight-bar"></div>
            </div>
          </div>

          <!-- Units digit column: infinite drum 0–9 -->
          <div class="scroll-column">
            <div class="scroll-column-inner">
              <div class="scroll-track" ref="unitsTrackRef" @scroll="onUnitsScroll">
                <div
                  v-for="(_, idx) in drumArray"
                  :key="'u' + idx"
                  class="scroll-item"
                  :class="{ active: String(idx % 10) === selectedUnits && isInMiddleCycle(idx) }"
                  @click="selectUnitsByIndex(idx)"
                >
                  {{ idx % 10 }}
                </div>
              </div>
              <div class="highlight-bar"></div>
            </div>
          </div>

          <!-- Decimal point separator -->
          <div class="decimal-dot">.</div>

          <!-- Decimal digit column: infinite drum 0–9 -->
          <div class="scroll-column">
            <div class="scroll-column-inner">
              <div class="scroll-track" ref="decTrackRef" @scroll="onDecScroll">
                <div
                  v-for="(_, idx) in drumArray"
                  :key="'d' + idx"
                  class="scroll-item"
                  :class="{ active: String(idx % 10) === selectedDecimal && isInMiddleCycle(idx) }"
                  @click="selectDecimalByIndex(idx)"
                >
                  {{ idx % 10 }}
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

// ── Copy-last button: apply copyValue as the selected depth and confirm ──
function applyCopyValue() {
  if (!props.copyValue) return
  const parts = String(props.copyValue).split('.')
  const intPart = parts[0] || '0'
  const decPart = parts[1] || '0'
  selectedTens.value = intPart.length >= 2 ? intPart[0] : '0'
  selectedUnits.value = intPart.length >= 2 ? intPart[1] : intPart[0] || '0'
  selectedDecimal.value = decPart[0] || '0'
  nextTick(() => {
    scrollToActive()
    const val = `${selectedTens.value}${selectedUnits.value}.${selectedDecimal.value}`
    emit('update:modelValue', val)
    emit('update:visible', false)
  })
}

// ── Infinite drum-roll configuration ──
const CYCLE_COUNT = 30 // total cycles of 0-9
const MID_CYCLE = Math.floor(CYCLE_COUNT / 2) // = 15, the "home" cycle
const EDGE_CYCLES = 3 // reset when within this many cycles of either edge
const ITEM_HEIGHT = 52 // approximate px height per scroll-item

// Generate a long flat array of 300 items (30 cycles × 10 digits)
const drumArray = Array.from({ length: CYCLE_COUNT * 10 }, (_, i) => i)

// ── Selected digit values (0-9 strings) ──
const selectedTens = ref('0')
const selectedUnits = ref('0')
const selectedDecimal = ref('0')

// ── Which cycle each column is currently anchored in ──
const tensCycle = ref(MID_CYCLE)
const unitsCycle = ref(MID_CYCLE)
const decCycle = ref(MID_CYCLE)

const tensTrackRef = ref(null)
const unitsTrackRef = ref(null)
const decTrackRef = ref(null)

// ── Guards to prevent scroll-reset feedback loops ──
const tensResetting = ref(false)
const unitsResetting = ref(false)
const decResetting = ref(false)

// ── Debounce timers ──
let tensTimer = null
let unitsTimer = null
let decTimer = null

// ── Helpers ──
function isInMiddleCycle(idx) {
  const cycle = Math.floor(idx / 10)
  return cycle >= MID_CYCLE - 1 && cycle <= MID_CYCLE + 1
}

/** Compute the drum-array index for a digit in a given cycle */
function indexFor(digit, cycle) {
  return cycle * 10 + parseInt(digit, 10)
}

/** Find the closest item index (not digit) to the center of a track */
function getClosestIndex(trackEl) {
  if (!trackEl) return null
  const rect = trackEl.getBoundingClientRect()
  const centerY = rect.top + rect.height / 2
  const items = trackEl.querySelectorAll('.scroll-item')
  let closestIdx = null
  let minDist = Infinity
  items.forEach((item, i) => {
    const r = item.getBoundingClientRect()
    const dist = Math.abs(centerY - (r.top + r.height / 2))
    if (dist < minDist) {
      minDist = dist
      closestIdx = i
    }
  })
  return closestIdx
}

// ── Silent infinite-scroll reset ──
function checkAndReset(trackEl, cycleRef, digitRef, resetFlag) {
  const idx = getClosestIndex(trackEl)
  if (idx === null) return

  const cycle = Math.floor(idx / 10)
  const digit = String(idx % 10)

  // Update the selected digit
  digitRef.value = digit

  // If we're near the edges, silently jump to the middle
  if (cycle <= EDGE_CYCLES || cycle >= CYCLE_COUNT - EDGE_CYCLES - 1) {
    resetFlag.value = true
    const newIdx = indexFor(digit, MID_CYCLE)
    cycleRef.value = MID_CYCLE
    // Calculate scrollTop to position the item at center
    const targetScrollTop = newIdx * ITEM_HEIGHT - trackEl.clientHeight / 2 + ITEM_HEIGHT / 2
    trackEl.scrollTop = targetScrollTop
    // Reset flag after a tick so subsequent scroll events are processed normally
    nextTick(() => {
      resetFlag.value = false
    })
  } else {
    cycleRef.value = cycle
  }
}

// ── Scroll handlers ──
function onTensScroll() {
  if (tensResetting.value) return
  clearTimeout(tensTimer)
  tensTimer = setTimeout(() => {
    checkAndReset(tensTrackRef.value, tensCycle, selectedTens, tensResetting)
  }, 100)
}

function onUnitsScroll() {
  if (unitsResetting.value) return
  clearTimeout(unitsTimer)
  unitsTimer = setTimeout(() => {
    checkAndReset(unitsTrackRef.value, unitsCycle, selectedUnits, unitsResetting)
  }, 100)
}

function onDecScroll() {
  if (decResetting.value) return
  clearTimeout(decTimer)
  decTimer = setTimeout(() => {
    checkAndReset(decTrackRef.value, decCycle, selectedDecimal, decResetting)
  }, 100)
}

// ── Click-to-select (snaps to that index) ──
function selectTensByIndex(idx) {
  selectedTens.value = String(idx % 10)
  const el = tensTrackRef.value
  if (!el) return
  const targetScrollTop = idx * ITEM_HEIGHT - el.clientHeight / 2 + ITEM_HEIGHT / 2
  el.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
}

function selectUnitsByIndex(idx) {
  selectedUnits.value = String(idx % 10)
  const el = unitsTrackRef.value
  if (!el) return
  const targetScrollTop = idx * ITEM_HEIGHT - el.clientHeight / 2 + ITEM_HEIGHT / 2
  el.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
}

function selectDecimalByIndex(idx) {
  selectedDecimal.value = String(idx % 10)
  const el = decTrackRef.value
  if (!el) return
  const targetScrollTop = idx * ITEM_HEIGHT - el.clientHeight / 2 + ITEM_HEIGHT / 2
  el.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
}

// ── Initial scroll to selected digit in middle cycle ──
function scrollToActive() {
  const columns = [
    { trackRef: tensTrackRef, digit: selectedTens.value, cycleRef: tensCycle },
    { trackRef: unitsTrackRef, digit: selectedUnits.value, cycleRef: unitsCycle },
    { trackRef: decTrackRef, digit: selectedDecimal.value, cycleRef: decCycle },
  ]
  columns.forEach(({ trackRef, digit, cycleRef }) => {
    const el = trackRef.value
    if (!el) return
    cycleRef.value = MID_CYCLE
    const idx = indexFor(digit, MID_CYCLE)
    const items = el.querySelectorAll('.scroll-item')
    const item = items[idx]
    if (item) {
      // Use offsetTop — scrolls item center to track center, independent of viewport
      el.scrollTop = item.offsetTop - el.clientHeight / 2 + item.offsetHeight / 2
    }
  })
}

// ── Parse incoming modelValue on open ──
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      if (props.modelValue) {
        const parts = String(props.modelValue).split('.')
        const intPart = parts[0] || '0'
        const decPart = parts[1] || '0'
        selectedTens.value = intPart.length >= 2 ? intPart[0] : '0'
        selectedUnits.value = intPart.length >= 2 ? intPart[1] : intPart[0] || '0'
        selectedDecimal.value = decPart[0] || '0'
      } else {
        selectedTens.value = '0'
        selectedUnits.value = '0'
        selectedDecimal.value = '0'
      }
      await nextTick()
      // Wait for the 300-item drum lists to fully layout before scrolling
      requestAnimationFrame(() => {
        scrollToActive()
      })
    }
  }
)

// ── Confirm and emit ──
function confirm() {
  const val = `${selectedTens.value}${selectedUnits.value}.${selectedDecimal.value}`
  emit('update:modelValue', val)
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
  max-width: 100px;
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
  /* Padding lets first/last items scroll to center: (260/2 - 52/2) = 104px */
  padding: 104px 0;
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
  font-size: 24px;
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
  font-size: 26px;
}

.decimal-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: #1e293b;
  padding: 0 2px;
  user-select: none;
  -webkit-user-select: none;
  align-self: center;
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
