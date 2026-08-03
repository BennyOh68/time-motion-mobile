<template>
  <div class="input-page">
    <h2>📋 Time & Motion Input <span class="step-badge">2/2</span></h2>
    <div class="info-bar">
      <span class="info-left">{{ infoSummary }}</span>
      <span class="info-right">{{ formattedDate }}</span>
    </div>

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

    <!-- ═══ Single Segment Panel (content switches per tab) ═══ -->
    <div class="segment">
      <div class="segment-header">
        <span>{{ TABS[activeTab].label }}</span>
      </div>

      <!-- Activity — taggable combo dropdown -->
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
      <button class="btn-outline" @click="router.push('/input-setup')">← Back</button>
      <button class="btn-primary" @click="handleNext">Next → Summary</button>
    </div>

    <p v-if="validationMsg" class="validation-msg">{{ validationMsg }}</p>

    <!-- ═══ Time Picker Modal ═══ -->
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { appState, submitFormRows } from '../store/appState.js'
import { dropdowns } from '../store/dropdowns.js'
import ScrollTimePicker from '../components/ScrollTimePicker.vue'
import vSelect from 'vue-select'
import 'vue-select/dist/vue-select.css'

const router = useRouter()
const validationMsg = ref('')

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
const prepOptions = computed(() => dropdowns.preparationList)
const prodOptions = computed(() => dropdowns.productionList)
const waitOptions = computed(() => dropdowns.waitsList)

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
  pickerTarget.value = target
  const tab = TABS[activeTab.value]

  // Time Out default: if empty, pre-fill with the current tab's Time In
  if (target === 'timeOut') {
    const timeOutKey = tab.timeOutKey
    if (!appState[timeOutKey] && appState[tab.timeInKey]) {
      pickerModelValue.value = appState[tab.timeInKey]
    } else {
      pickerModelValue.value = appState[timeOutKey] || ''
    }
  } else {
    pickerModelValue.value = appState[target] || ''
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
.input-page {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 40px;
}

h2 {
  font-size: 20px;
  margin-bottom: 4px;
}

.info-bar {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
  padding: 0 16px;
  color: #64748b;
  font-size: 13px;
}

.info-left {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}

.info-right {
  flex-shrink: 0;
}

.step-badge {
  font-size: 12px;
  color: #3b82f6;
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
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

.field-row {
  display: flex;
  gap: 10px;
  overflow: hidden;
  box-sizing: border-box;
}

.field.half {
  flex: 1;
  min-width: 0;
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

.action-bar {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary,
.btn-secondary,
.btn-outline {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}
.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-outline {
  background: #fff;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-outline:hover {
  background: #f8fafc;
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

.validation-msg {
  color: #dc2626;
  font-size: 13px;
  text-align: center;
  margin-top: 12px;
}

/* ── vue-select overrides ── */
.vs__dropdown-toggle {
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  min-height: 48px;
}

.vs__dropdown-toggle:hover {
  border-color: #94a3b8;
}

.vs--open .vs__dropdown-toggle {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.vs__search,
.vs__search:focus {
  font-size: 16px;
  padding: 0;
  margin: 0;
  color: #1e293b;
}

.vs__selected-options {
  padding: 0;
  flex-wrap: nowrap;
}

.vs__selected {
  margin: 0;
  padding: 0;
  font-size: 16px;
  color: #1e293b;
}

.vs__actions {
  padding: 0;
}

.vs__open-indicator {
  fill: #94a3b8;
  transform: scale(0.8);
}

.vs--open .vs__open-indicator {
  transform: scale(0.8) rotate(180deg);
  fill: #3b82f6;
}

.vs__clear {
  fill: #94a3b8;
}

.vs__dropdown-menu {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  font-size: 16px;
}

.vs__dropdown-option {
  padding: 10px 14px;
  color: #1e293b;
  cursor: pointer;
}

.vs__dropdown-option--highlight {
  background: #eff6ff;
  color: #3b82f6;
}

.vs__dropdown-option--selected {
  background: #dbeafe;
  color: #1e40af;
}

.vs__no-options {
  padding: 10px 14px;
  color: #94a3b8;
  font-size: 14px;
}
</style>
