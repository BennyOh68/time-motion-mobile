<template>
  <Teleport to="body">
    <div v-if="show" class="crp-overlay" @click.self="onCancel">
      <div class="crp-sheet" @click.stop>
        <!-- Header: Cancel | Month Year | Done -->
        <div class="crp-header">
          <button class="crp-header-btn" @click="onCancel">Cancel</button>
          <div class="crp-title">
            <button class="crp-nav-btn" aria-label="Previous month" @click="prevMonth">‹</button>
            <button class="crp-title-btn" @click="yearMode = !yearMode">
              {{ yearMode ? 'Select Year' : monthLabel }}
            </button>
            <button class="crp-nav-btn" aria-label="Next month" @click="nextMonth">›</button>
          </div>
          <button class="crp-header-btn done" @click="onConfirm">Done</button>
        </div>

        <!-- Body: month grid or year grid -->
        <div class="crp-body" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
          <template v-if="!yearMode">
            <div class="crp-weekdays">
              <span v-for="d in weekdays" :key="d">{{ d }}</span>
            </div>
            <div class="crp-grid">
              <button
                v-for="cell in gridCells"
                :key="cell.key"
                class="crp-cell"
                :class="cellClass(cell)"
                :disabled="isCellDisabled(cell.date)"
                @click="onCellTap(cell)"
              >
                {{ cell.date.getDate() }}
              </button>
            </div>
          </template>
          <div v-else class="crp-years">
            <button
              v-for="y in yearsList"
              :key="y"
              class="crp-year"
              :class="{ selected: y === cursorYear }"
              @click="pickYear(y)"
            >{{ y }}</button>
          </div>
        </div>

        <!-- Footer: Start Date above End Date, with day count -->
        <div class="crp-footer">
          <div class="crp-range-row">
            <span class="crp-range-label">Start Date</span>
            <span class="crp-range-value" :class="{ empty: !startDate }">{{ startDisplay }}</span>
          </div>
          <div class="crp-range-row">
            <span class="crp-range-label">End Date</span>
            <span class="crp-range-value" :class="{ empty: !endDate }">{{ endDisplay }}</span>
          </div>
          <div class="crp-range-row day-count-row">
            <span class="crp-range-label">Number of Day</span>
            <span class="crp-range-value" :class="{ empty: !dayCount }">{{ dayCountText }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  // 'daily' | 'weekly' | 'monthly'
  mode: { type: String, default: 'daily' },
  // Date bounds (optional) — accepts Date objects or YYYY-MM-DD strings
  minDate: { type: [String, Date], default: null },
  maxDate: { type: [String, Date], default: null },
  // Current selection to pre-fill when opened (YYYY-MM-DD)
  modelStart: { type: String, default: '' },
  modelEnd: { type: String, default: '' },
})

const emit = defineEmits(['update:show', 'confirm'])

// ── Constants (English) ──
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ── State ──
const cursorYear = ref(new Date().getFullYear())
const cursorMonth = ref(new Date().getMonth()) // 0-based
const yearMode = ref(false)
const startDate = ref(null)
const endDate = ref(null)

const today = new Date()
today.setHours(0, 0, 0, 0)

// ── Date helpers (all local-midnight based) ──
function startOfDay(d) {
  const nd = new Date(d)
  nd.setHours(0, 0, 0, 0)
  return nd
}
function addDays(d, n) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseDateStr(s) {
  // Accept Date instances (e.g. the dashboard's calendarMinDate/calendarMaxDate)
  // or YYYY-MM-DD strings.
  if (s instanceof Date) {
    if (isNaN(s.getTime())) return null
    const nd = new Date(s)
    nd.setHours(0, 0, 0, 0)
    return nd
  }
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s || '')
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3])
}
function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function isSameMonth(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

const minDate = computed(() => parseDateStr(props.minDate))
const maxDate = computed(() => parseDateStr(props.maxDate))

// ── Computed: month label + year list ──
const monthLabel = computed(() => `${monthNames[cursorMonth.value]} ${cursorYear.value}`)

const yearsList = computed(() => {
  const y = cursorYear.value
  const out = []
  for (let i = -15; i <= 15; i++) out.push(y + i)
  return out
})

// ── Computed: 6x7 grid for the visible month ──
const gridCells = computed(() => {
  const first = new Date(cursorYear.value, cursorMonth.value, 1)
  const offset = first.getDay() // Sun = 0
  const cells = []
  for (let i = 0; i < 42; i++) {
    cells.push({ date: new Date(cursorYear.value, cursorMonth.value, i - offset + 1), key: i })
  }
  return cells
})

// ── Cell visual state ──
const monthlyPreviewEnd = computed(() => {
  // In monthly mode, once Start is picked (and End is pending) show the
  // full prospective range highlighted through the farthest End candidate.
  if (props.mode !== 'monthly' || !startDate.value || endDate.value) return null
  return addDays(startOfDay(startDate.value), 30)
})

function cellClass(cell) {
  const d = cell.date
  const isStart = isSameDay(d, startDate.value)
  const isEnd = isSameDay(d, endDate.value)
  const confirmedRange = startDate.value && endDate.value
    && d >= startOfDay(startDate.value) && d <= startOfDay(endDate.value)
    && !isStart && !isEnd
  const pEnd = monthlyPreviewEnd.value
  const previewRange = pEnd && !endDate.value
    && d > startOfDay(startDate.value) && d <= startOfDay(pEnd)
    && !isStart && !isEnd && !isEndCandidate(d)
  const cls = []
  if (d.getMonth() !== cursorMonth.value) cls.push('out-month')
  if (isStart) cls.push('start')
  if (isEnd) cls.push('end')
  if (confirmedRange) cls.push('in-range')
  if (previewRange) cls.push('preview-range')
  if (isSameDay(d, today)) cls.push('today')
  if (isEndCandidate(d)) cls.push('end-candidate')
  return cls
}

function isCellDisabled(d) {
  // End candidates in monthly mode may fall in the next month(s); keep them
  // tappable even when rendered as out-of-month cells.
  if (isEndCandidate(d)) return false
  if (d.getMonth() !== cursorMonth.value) return true
  const ds = startOfDay(d)
  if (minDate.value && ds < startOfDay(minDate.value)) return true
  if (maxDate.value && ds > startOfDay(maxDate.value)) return true
  return false
}

// Monthly mode: after Start is picked, the End Date must be exactly
// Start+27, +28, +29, or +30 days (a ~28-31 day month-length span).
// These candidates are real calendar dates relative to Start, so they may
// land in the following month(s); the user can navigate there to tap them.
const MONTHLY_END_OFFSETS = [27, 28, 29, 30]
function isEndCandidate(d) {
  if (props.mode !== 'monthly') return false
  if (!startDate.value || endDate.value) return false
  const ds = startOfDay(d)
  if (minDate.value && ds < startOfDay(minDate.value)) return false
  if (maxDate.value && ds > startOfDay(maxDate.value)) return false
  const start = startOfDay(startDate.value)
  return MONTHLY_END_OFFSETS.some((n) => isSameDay(ds, addDays(start, n)))
}

// ── Selection logic per mode ──
function onCellTap(cell) {
  const d = cell.date
  if (isCellDisabled(d)) return

  if (props.mode === 'weekly') {
    // Fixed 7-day window: Start → Start + 6
    startDate.value = d
    endDate.value = addDays(d, 6)
    return
  }

  if (props.mode === 'monthly') {
    if (!startDate.value || endDate.value) {
      // Anchor (or re-anchor) the Start
      startDate.value = d
      endDate.value = null
      return
    }
    if (isEndCandidate(d)) {
      endDate.value = d
      return
    }
    // Tapping any other day re-anchors Start
    startDate.value = d
    endDate.value = null
    return
  }

  // Daily: single-day selection — tapping a date picks that day (start = end)
  startDate.value = d
  endDate.value = d
  return
}

// ── Footer display ──
function formatLong(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
const startDisplay = computed(() => (startDate.value ? formatLong(startDate.value) : '—'))
const endDisplay = computed(() => (endDate.value ? formatLong(endDate.value) : '—'))

// Number of days in the selected range (inclusive of both start and end)
const dayCount = computed(() => {
  if (!startDate.value || !endDate.value) return 0
  const diff = startOfDay(endDate.value) - startOfDay(startDate.value)
  return Math.round(diff / 86400000) + 1
})
const dayCountText = computed(() => (dayCount.value > 0 ? `${dayCount.value} Day${dayCount.value > 1 ? 's' : ''}` : '—'))

// ── Month / year navigation ──
function prevMonth() {
  if (yearMode.value) return
  if (cursorMonth.value === 0) {
    cursorMonth.value = 11
    cursorYear.value -= 1
  } else {
    cursorMonth.value -= 1
  }
}
function nextMonth() {
  if (yearMode.value) return
  if (cursorMonth.value === 11) {
    cursorMonth.value = 0
    cursorYear.value += 1
  } else {
    cursorMonth.value += 1
  }
}
function pickYear(y) {
  cursorYear.value = y
  yearMode.value = false
}

// ── Swipe left/right to change month ──
let touchX = 0
let touchY = 0
function onTouchStart(e) {
  touchX = e.touches[0].clientX
  touchY = e.touches[0].clientY
}
function onTouchEnd(e) {
  if (yearMode.value) return
  const t = e.changedTouches[0]
  const dx = t.clientX - touchX
  const dy = t.clientY - touchY
  // Only treat as a month swipe when horizontal movement dominates
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) nextMonth()
    else prevMonth()
  }
}

// ── Pre-fill from model on open ──
watch(() => props.show, (v) => {
  if (!v) return
  const s = parseDateStr(props.modelStart)
  const e = parseDateStr(props.modelEnd)
  startDate.value = s
  endDate.value = e
  const base = s || e || new Date()
  cursorYear.value = base.getFullYear()
  cursorMonth.value = base.getMonth()
  yearMode.value = false
})

// ── Confirm / cancel ──
function onConfirm() {
  const s = startDate.value
  let e = endDate.value
  if (s && !e) e = s // single-day fallback so Done always yields a range
  if (s && e) emit('confirm', { start: toDateStr(s), end: toDateStr(e) })
  emit('update:show', false)
}
function onCancel() {
  emit('update:show', false)
}
</script>

<style scoped>
.crp-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: crpFade 0.2s ease;
}
@keyframes crpFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.crp-sheet {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding-bottom: env(safe-area-inset-bottom, 16px);
  display: flex;
  flex-direction: column;
  max-height: 92vh;
  user-select: none;
  -webkit-user-select: none;
  animation: crpSlideUp 0.25s ease;
}
@keyframes crpSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* ── Header ── */
.crp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 4px;
}
.crp-header-btn {
  background: none;
  border: none;
  color: #007aff;
  font-size: 16px;
  padding: 6px 4px;
  cursor: pointer;
}
.crp-header-btn.done {
  font-weight: 600;
}
.crp-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.crp-title-btn {
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 600;
  color: #111;
  padding: 6px 8px;
  cursor: pointer;
}
.crp-nav-btn {
  background: #f2f2f7;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 20px;
  line-height: 1;
  color: #007aff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.crp-nav-btn:active {
  background: #e5e5ea;
}

/* ── Body / weekdays / grid ── */
.crp-body {
  overflow-y: auto;
  touch-action: pan-y;
}
.crp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 8px 12px 2px;
}
.crp-weekdays span {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #8e8e93;
  text-transform: uppercase;
}
.crp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding: 4px 12px 8px;
}
.crp-cell {
  height: 44px;
  border: none;
  background: transparent;
  font-size: 16px;
  color: #111;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}
.crp-cell:disabled {
  cursor: default;
}
.crp-cell.out-month {
  color: #d1d1d6;
}
.crp-cell:disabled.out-month {
  color: #f0f0f3;
}
.crp-cell.today {
  color: #ff3b30;
}
.crp-cell.today.start,
.crp-cell.today.end {
  color: #fff;
}
.crp-cell.in-range {
  background: #d8e9ff;
  border-radius: 12px;
}
.crp-cell.preview-range {
  background: #eef4ff;
  border-radius: 12px;
  color: #6a8fd6;
}
.crp-cell.start,
.crp-cell.end {
  background: #007aff;
  color: #fff;
  font-weight: 600;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  justify-self: center;
  align-self: center;
}
.crp-cell.end-candidate {
  box-shadow: inset 0 0 0 1.5px #007aff;
  color: #007aff;
}
.crp-cell:active:not(:disabled) {
  background: #eef5ff;
}

/* ── Year grid ── */
.crp-years {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 12px 16px 16px;
  max-height: 300px;
  overflow-y: auto;
}
.crp-year {
  padding: 10px 0;
  border: none;
  border-radius: 10px;
  text-align: center;
  font-size: 15px;
  color: #111;
  background: #f2f2f7;
  cursor: pointer;
}
.crp-year.selected {
  background: #007aff;
  color: #fff;
  font-weight: 600;
}

/* ── Footer: Start Date above End Date ── */
.crp-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px 20px;
  border-top: 1px solid #e5e5ea;
  background: #fafafa;
  border-radius: 0 0 20px 20px;
}
.crp-range-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.crp-range-row.day-count-row {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px dashed #e5e5ea;
}
.crp-range-row.day-count-row .crp-range-value {
  color: #007aff;
}
.crp-range-label {
  font-size: 13px;
  color: #8e8e93;
  font-weight: 600;
  flex-shrink: 0;
}
.crp-range-value {
  font-size: 15px;
  font-weight: 600;
  color: #111;
  text-align: right;
}
.crp-range-value.empty {
  color: #b0b0b6;
  font-weight: 400;
}
</style>
