<template>
  <div class="input-setup-page">
    <h2>📋 Time & Motion Input</h2>
    <p class="desc">Enter project details and log activities.</p>

    <!-- ═══ Project Setup ═══ -->
    <form @submit.prevent class="setup-form">
      <!-- Project Name -->
      <div class="field-row setup-row">
        <div class="field field-half">
          <label for="projectName">Project Name</label>
          <input
            id="projectName"
            v-model="appState.projectName"
            type="text"
            placeholder="Enter project name"
            class="input-full"
            required
          />
        </div>
      </div>

      <!-- Team / Rig + Record Date (side-by-side) -->
      <div class="field-row setup-row">
        <div class="field field-half">
          <label for="teamRig">Team / Rig</label>
          <v-select
            v-model="appState.teamRig"
            :options="dropdowns.rigList"
            placeholder="Select or type rig…"
            taggable
            push-tags
            @open="onSelectOpen"
          />
        </div>
        <div class="field field-half">
          <label for="logDate">Record Date</label>
          <input
            type="text"
            readonly
            :value="logDateDisplay"
            placeholder="Tap to select date"
            class="input-full date-input"
            @click="openDatePicker"
          />
        </div>
      </div>

      <!-- Work Type + Ref. Point (side-by-side) -->
      <div class="field-row setup-row">
        <div class="field field-half">
          <label>Work Type</label>
          <div class="radio-group">
            <label class="radio-label" :class="{ active: appState.workType === 'JGP' }">
              <input type="radio" v-model="appState.workType" value="JGP" />
              Jet Grout Pile <span class="abbr">(JGP)</span>
            </label>
            <label class="radio-label" :class="{ active: appState.workType === 'GH' }">
              <input type="radio" v-model="appState.workType" value="GH" />
              Grout Hole <span class="abbr">(GH)</span>
            </label>
          </div>
        </div>
        <div class="field field-half">
          <label for="refPoint">Ref. Point</label>
          <input
            id="refPoint"
            v-model="appState.refPoint"
            type="text"
            placeholder="e.g. P1, P2…"
            class="input-full"
            required
          />
        </div>
      </div>
    </form>

    <!-- ═══ Tab Bar ═══ -->
    <div class="tab-bar">
      <button
        v-for="(tab, key) in TABS"
        :key="key"
        class="tab-btn"
        :class="{ active: activeTab === key }"
        @click="activeTab = key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ═══ Single Segment Panel ═══ -->
    <div class="segment">
      <div class="segment-header">
        <span>{{ TABS[activeTab].label }}</span>
      </div>

      <!-- Activity -->
      <div class="field">
        <label>Activity</label>
        <v-select
          :model-value="currentActivity"
          @update:model-value="onActivitySelected"
          :options="currentOptions"
          placeholder="Select or type activity…"
          taggable
          push-tags
          @search="onActivitySearch"
          @search:blur="confirmTypedActivity"
          @open="onSelectOpen"
          ref="selectRef"
        />
      </div>

      <!-- Time In / Time Out -->
      <div class="field-row">
        <div class="field half">
          <label>Time In</label>
          <input
            type="text"
            readonly
            :value="currentTimeIn"
            placeholder="Tap to select"
            class="time-input"
            @click="openPicker('timeIn')"
          />
        </div>
        <div class="field half">
          <label>Time Out</label>
          <input
            type="text"
            readonly
            :value="currentTimeOut"
            placeholder="Tap to select"
            class="time-input"
            @click="openPicker('timeOut')"
          />
        </div>
      </div>

      <!-- Start Depth / End Depth -->
      <div class="field-row">
        <div class="field half">
          <label>Start Depth (m)</label>
          <input
            v-model="currentStartDepth"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
          />
        </div>
        <div class="field half">
          <label>End Depth (m)</label>
          <input
            v-model="currentEndDepth"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
          />
        </div>
      </div>

      <!-- Segment actions -->
      <div class="segment-actions">
        <button class="btn-undo" @click="handleUndo">↩ Undo</button>
        <button class="btn-add-segment" @click="handleAdd">+ Add</button>
      </div>
    </div>

    <!-- ── Action Buttons ── -->
    <div class="action-bar">
      <button class="btn-primary" @click="handleNext">Next → Summary</button>
    </div>

    <p v-if="validationMsg" class="validation-msg">{{ validationMsg }}</p>

    <!-- ═══ Scroll Date Picker Modal ═══ -->
    <ScrollDatePicker
      :model-value="appState.logDate"
      :visible="datePickerVisible"
      @update:model-value="onDatePicked"
      @update:visible="datePickerVisible = false"
    />

    <!-- ═══ Scroll Time Picker Modal ═══ -->
    <ScrollTimePicker
      :model-value="pickerModelValue"
      :visible="pickerVisible"
      @update:model-value="onPickerConfirm"
      @update:visible="pickerVisible = false"
      ref="pickerRef"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { appState, submitFormRows } from '../store/appState.js'
import { dropdowns, hiddenItems } from '../store/dropdowns.js'
import ScrollDatePicker from '../components/ScrollDatePicker.vue'
import ScrollTimePicker from '../components/ScrollTimePicker.vue'
import vSelect from 'vue-select'
import 'vue-select/dist/vue-select.css'

const router = useRouter()
const validationMsg = ref('')

// ── Scroll Date Picker ──
const datePickerVisible = ref(false)

const logDateDisplay = computed(() => {
  if (!appState.logDate) return ''
  const [y, m, d] = appState.logDate.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`
})

function openDatePicker() {
  datePickerVisible.value = true
}

function onDatePicked(val) {
  if (val) appState.logDate = val
  datePickerVisible.value = false
}

// ── Tab configuration ──────────────────────────────────────────
const activeTab = ref('prep')

const TABS = {
  prep: {
    label: '1. Preparation Work',
    activityKey: 'prepActivity',
    timeInKey: 'prepTimeIn',
    timeOutKey: 'prepTimeOut',
    startDepthKey: 'prepStartDepth',
    endDepthKey: 'prepEndDepth',
    category: 'Preparation',
    optionsKey: 'prepOptions',
  },
  prod: {
    label: '2. Production Work',
    activityKey: 'prodActivity',
    timeInKey: 'prodTimeIn',
    timeOutKey: 'prodTimeOut',
    startDepthKey: 'prodStartDepth',
    endDepthKey: 'prodEndDepth',
    category: 'Production',
    optionsKey: 'prodOptions',
  },
  wait: {
    label: '3. The Waits',
    activityKey: 'waitActivity',
    timeInKey: 'waitTimeIn',
    timeOutKey: 'waitTimeOut',
    startDepthKey: 'waitStartDepth',
    endDepthKey: 'waitEndDepth',
    category: 'Waits',
    optionsKey: 'waitOptions',
  },
}

// ── Computed bindings: read/write active tab's fields ────────
const currentTab = computed(() => TABS[activeTab.value])

const currentActivity = computed({
  get: () => appState[currentTab.value.activityKey],
  set: (v) => { appState[currentTab.value.activityKey] = v },
})

const currentTimeIn = computed(() => appState[currentTab.value.timeInKey])
const currentTimeOut = computed(() => appState[currentTab.value.timeOutKey])

const currentStartDepth = computed({
  get: () => appState[currentTab.value.startDepthKey],
  set: (v) => { appState[currentTab.value.startDepthKey] = v },
})

const currentEndDepth = computed({
  get: () => appState[currentTab.value.endDepthKey],
  set: (v) => { appState[currentTab.value.endDepthKey] = v },
})

// ── Dropdown options per tab ──────────────────────────────────
const prepOptions = computed(() =>
  dropdowns.preparationList.filter((_, i) => !hiddenItems.preparationList[i])
)
const prodOptions = computed(() =>
  dropdowns.productionList.filter((_, i) => !hiddenItems.productionList[i])
)
const waitOptions = computed(() =>
  dropdowns.waitsList.filter((_, i) => !hiddenItems.waitsList[i])
)

const currentOptions = computed(() => {
  switch (activeTab.value) {
    case 'prep': return prepOptions.value
    case 'prod': return prodOptions.value
    case 'wait': return waitOptions.value
    default: return []
  }
})

// ── v-select type-to-add: confirm on blur or Enter ────────────
const selectRef = ref(null)
const typedActivity = ref('')

// ── Prevent mobile keyboard on initial v-select open ──────────
function onSelectOpen() {
  nextTick(() => {
    // Set search input to readonly so mobile keyboard doesn't pop up on first tap.
    // Using readonly instead of blur() — blur() closes the dropdown on some browsers.
    // Double-tap (dblclick) removes readonly and focuses for typing.
    const root = selectRef.value?.$el?.parentElement?.querySelector('.vs__search')
    const searchInput = root || document.querySelector('.vs--open .vs__search')
    if (searchInput instanceof HTMLInputElement) {
      searchInput.setAttribute('readonly', 'readonly')
      searchInput.addEventListener('dblclick', () => {
        searchInput.removeAttribute('readonly')
        searchInput.focus()
      }, { once: true })
    }
  })
}

function onActivitySearch(val) {
  typedActivity.value = val
}

function confirmTypedActivity() {
  if (typedActivity.value && !currentActivity.value) {
    currentActivity.value = typedActivity.value
    typedActivity.value = ''
  }
}

function onActivitySelected(val) {
  currentActivity.value = val
  typedActivity.value = ''
}

// ── Pre-fill TimeIn / StartDepth from last logged row on mount ─
onMounted(() => {
  const rows = appState.logRows
  if (rows.length === 0) return
  const last = rows[rows.length - 1]
  if (last.timeOut && !appState.prepTimeIn && !appState.prodTimeIn && !appState.waitTimeIn) {
    appState.prepTimeIn = last.timeOut
    appState.prodTimeIn = last.timeOut
    appState.waitTimeIn = last.timeOut
  }
  if (last.endDepth && !appState.prepStartDepth && !appState.prodStartDepth && !appState.waitStartDepth) {
    appState.prepStartDepth = last.endDepth
    appState.prodStartDepth = last.endDepth
    appState.waitStartDepth = last.endDepth
  }
})

// ── Per-segment undo snapshots ────────────────────────────────
const segmentSnapshots = ref({
  prep: null,
  prod: null,
  wait: null,
})

// ── Time Picker ───────────────────────────────────────────────
const pickerVisible = ref(false)
const pickerTarget = ref('')
const pickerModelValue = ref('')
const pickerRef = ref(null)

function openPicker(target) {
  const tab = TABS[activeTab.value]
  const stateKey = target === 'timeIn' ? tab.timeInKey : tab.timeOutKey
  pickerTarget.value = stateKey

  // Time Out default: if empty, pre-fill with the current tab's Time In
  if (target === 'timeOut') {
    if (!appState[stateKey] && appState[tab.timeInKey]) {
      pickerModelValue.value = appState[tab.timeInKey]
    } else {
      pickerModelValue.value = appState[stateKey] || ''
    }
  } else {
    pickerModelValue.value = appState[stateKey] || ''
  }
  pickerVisible.value = true
}

function onPickerConfirm(displayValue) {
  const match = displayValue.match(/^(\d{2}):(\d{2})\s*(am|pm)$/i)
  if (match) {
    let hh = parseInt(match[1], 10)
    const mm = match[2]
    const ampm = match[3].toLowerCase()
    if (ampm === 'pm' && hh < 12) hh += 12
    if (ampm === 'am' && hh === 12) hh = 0
    appState[pickerTarget.value] = `${String(hh).padStart(2, '0')}:${mm}`
  } else {
    appState[pickerTarget.value] = displayValue
  }
  pickerVisible.value = false
}

// ── Navigation ────────────────────────────────────────────────
function handleNext() {
  validationMsg.value = ''

  if (!appState.projectName.trim()) {
    validationMsg.value = 'Project Name is required.'
    return
  }
  if (!appState.teamRig.trim()) {
    validationMsg.value = 'Team / Rig is required.'
    return
  }
  if (!appState.refPoint.trim()) {
    validationMsg.value = 'Ref. Point is required.'
    return
  }
  if (!appState.logDate) {
    validationMsg.value = 'Record Date is required.'
    return
  }

  submitFormRows()
  if (appState.logRows.length === 0) {
    validationMsg.value = 'Add at least one segment entry before proceeding.'
    return
  }
  router.push('/summary')
}

// ── Add segment ───────────────────────────────────────────────
function handleAdd() {
  const tab = TABS[activeTab.value]
  const prefix = activeTab.value
  submitSegment(prefix)
}

function submitSegment(prefix) {
  validationMsg.value = ''

  const tab = TABS[prefix]

  const seg = {
    category: tab.category,
    activity: appState[tab.activityKey],
    timeIn: appState[tab.timeInKey],
    timeOut: appState[tab.timeOutKey],
    startDepth: appState[tab.startDepthKey],
    endDepth: appState[tab.endDepthKey],
  }

  if (!seg.activity || !seg.timeIn || !seg.timeOut) {
    validationMsg.value = 'Please fill Activity, Time In, and Time Out before adding.'
    return
  }

  const newRow = {
    id: crypto.randomUUID(),
    category: seg.category,
    activityName: seg.activity,
    timeIn: seg.timeIn,
    timeOut: seg.timeOut,
    projectName: appState.projectName,
    teamRig: appState.teamRig,
    workType: appState.workType,
    refPoint: appState.refPoint,
    startDepth: seg.startDepth,
    endDepth: seg.endDepth,
    logDate: appState.logDate || new Date().toISOString().slice(0, 10),
  }

  // Take undo snapshot
  segmentSnapshots.value[prefix] = newRow

  appState.logRows.push(newRow)

  // Capture submitted values before reset
  const savedTimeOut = seg.timeOut
  const savedEndDepth = seg.endDepth

  // Reset only this segment's fields
  appState[tab.activityKey] = ''
  appState[tab.timeInKey] = ''
  appState[tab.timeOutKey] = ''
  appState[tab.startDepthKey] = ''
  appState[tab.endDepthKey] = ''

  // Cascade: copy timeOut → all timeIn, endDepth → all startDepth
  if (savedTimeOut) {
    appState.prepTimeIn = savedTimeOut
    appState.prodTimeIn = savedTimeOut
    appState.waitTimeIn = savedTimeOut
  }
  if (savedEndDepth) {
    appState.prepStartDepth = savedEndDepth
    appState.prodStartDepth = savedEndDepth
    appState.waitStartDepth = savedEndDepth
  }

  validationMsg.value = `Added: ${newRow.activityName}`
}

// ── Undo ──────────────────────────────────────────────────────
function handleUndo() {
  undoLastSegment(TABS[activeTab.value].category, activeTab.value)
}

function undoLastSegment(category, prefix) {
  const snap = segmentSnapshots.value[prefix]
  if (!snap) {
    validationMsg.value = 'Nothing to undo for this segment.'
    return
  }

  const idx = appState.logRows.map(r => r.id).lastIndexOf(snap.id)
  if (idx !== -1) {
    appState.logRows.splice(idx, 1)
  }

  const tab = TABS[prefix]
  appState[tab.activityKey] = snap.activityName
  appState[tab.timeInKey] = snap.timeIn
  appState[tab.timeOutKey] = snap.timeOut
  appState[tab.startDepthKey] = snap.startDepth
  appState[tab.endDepthKey] = snap.endDepth

  segmentSnapshots.value[prefix] = null

  validationMsg.value = `Undone: ${snap.activityName}`
}

// ── Info bar helpers ──────────────────────────────────────────
const infoSummary = computed(() => {
  const typeRef = [appState.workType, appState.refPoint].filter(Boolean).join(' - ')
  const parts = [appState.projectName, typeRef, appState.teamRig].filter(Boolean)
  return parts.join(' · ') || '—'
})

const formattedDate = computed(() => {
  if (!appState.logDate) return ''
  const [y, m, d] = appState.logDate.split('-')
  return `${d}-${m}-${y}`
})
</script>

<style scoped>
.input-setup-page {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 40px;
}

h2 {
  font-size: 20px;
  margin-bottom: 4px;
}

.desc {
  color: #64748b;
  font-size: 13px;
  margin-bottom: 12px;
  padding: 0 16px;
}

/* ── Setup form (project details) ── */
.setup-form {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  margin-bottom: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #475569;
}

.field input,
.field select {
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  background: #fff;
  -webkit-appearance: none;
}

.field input:focus,
.field select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.input-full {
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  width: 100%;
  transition: border-color 0.15s;
}

.input-full:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.field-row {
  display: flex;
  gap: 10px;
  overflow: visible;
  box-sizing: border-box;
}

.setup-row {
  gap: 16px;
  align-items: flex-start;
  position: relative;
  z-index: 10;
}

.setup-row:nth-child(2) {
  z-index: 20;
}

.field-half {
  flex: 1;
  min-width: 0;
}

.field.half {
  flex: 1;
  min-width: 0;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: #334155;
  transition: color 0.15s;
}

.radio-label input[type="radio"] {
  appearance: none;
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  min-width: 22px;
  border: 2px solid #cbd5e1;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  flex-shrink: 0;
  margin: 0;
}

.radio-label input[type="radio"]::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #3b82f6;
  transition: transform 0.15s ease;
}

.radio-label.active {
  color: #2563eb;
}

.radio-label.active input[type="radio"] {
  border-color: #3b82f6;
}

.radio-label.active input[type="radio"]::after {
  transform: translate(-50%, -50%) scale(1);
}

.radio-label .abbr {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
}

.radio-label.active .abbr {
  color: #3b82f6;
}

.date-input {
  cursor: pointer;
  caret-color: transparent;
  color: #3b82f6 !important;
  font-weight: 600;
  text-align: center;
  font-size: 14px !important;
  height: 40px;
  box-sizing: border-box;
}

.date-input::placeholder {
  color: #94a3b8;
  font-weight: 400;
  font-size: 14px;
}

/* ── Tab bar ── */
.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.tab-btn {
  flex: 1;
  padding: 10px 4px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
  border-right: 1px solid #e2e8f0;
}

.tab-btn:last-child {
  border-right: none;
}

.tab-btn.active {
  background: #3b82f6;
  color: #fff;
}

.tab-btn:not(.active):hover {
  background: #f1f5f9;
  color: #1e293b;
}

/* ── Segment ── */
.segment {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 4px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

.segment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #1e293b;
  padding-bottom: 8px;
  border-bottom: 2px solid #3b82f6;
}

.segment-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.btn-undo {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-undo:hover {
  color: #ef4444;
  border-color: #fca5a5;
  background: #fef2f2;
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

/* ── Action bar ── */
.action-bar {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary {
  flex: 1;
  padding: 14px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-add-segment {
  background: #f1f5f9;
  color: #3b82f6;
  border: 1px dashed #3b82f6;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-add-segment:hover {
  background: #eff6ff;
  border-color: #2563eb;
  color: #2563eb;
}

.error {
  color: #dc2626;
  font-size: 13px;
  margin-bottom: 12px;
  text-align: center;
}

.validation-msg {
  color: #dc2626;
  font-size: 13px;
  text-align: center;
  margin-top: 12px;
}

/* ── vue-select overrides ── */
:deep(.vs__dropdown-toggle) {
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  min-height: 48px;
}

:deep(.vs__dropdown-toggle:hover) {
  border-color: #94a3b8;
}

:deep(.vs--open .vs__dropdown-toggle) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

:deep(.vs__search),
:deep(.vs__search:focus) {
  font-size: 16px;
  padding: 0;
  margin: 0;
  color: #1e293b;
}

:deep(.vs__selected-options) {
  padding: 0;
  flex-wrap: nowrap;
}

:deep(.vs__selected) {
  margin: 0;
  padding: 0;
  font-size: 16px;
  color: #1e293b;
}

:deep(.vs__actions) {
  padding: 0;
}

:deep(.vs__open-indicator) {
  fill: #94a3b8;
  transform: scale(0.8);
}

:deep(.vs--open .vs__open-indicator) {
  transform: scale(0.8) rotate(180deg);
  fill: #3b82f6;
}

:deep(.vs__clear) {
  fill: #94a3b8;
}

:deep(.vs__dropdown-menu) {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  font-size: 16px;
  background: #fff;
}

:deep(.vs__dropdown-option) {
  padding: 10px 14px;
  color: #1e293b;
  cursor: pointer;
  background: #fff;
}

:deep(.vs__dropdown-option--highlight) {
  background: #eff6ff;
  color: #3b82f6;
}

:deep(.vs__dropdown-option--selected) {
  background: #dbeafe;
  color: #1e40af;
}

:deep(.vs__no-options) {
  padding: 10px 14px;
  color: #94a3b8;
  font-size: 14px;
}
</style>
