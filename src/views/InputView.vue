<template>
  <div class="input-page">
    <h2>📋 Time & Motion Input <span class="step-badge">2/2</span></h2>
    <div class="info-bar">
      <span class="info-left">{{ infoSummary }}</span>
      <span class="info-right">{{ formattedDate }}</span>
    </div>

    <!-- ═══ Segment 1: Preparation ═══ -->
    <div class="segment">
      <div class="segment-header">
        <span>1. Preparation Work</span>
      </div>
      <div class="field">
        <label>Activity</label>
        <v-select
          v-model="appState.prepActivity"
          :options="prepOptions"
          placeholder="Select or type activity…"
          taggable
          push-tags
        />
      </div>
      <div class="field-row">
        <div class="field half">
          <label>Time In</label>
          <input
            type="text"
            readonly
            :value="appState.prepTimeIn"
            placeholder="Tap to select"
            class="time-input"
            @click="openPicker('prepTimeIn')"
          />
        </div>
        <div class="field half">
          <label>Time Out</label>
          <input
            type="text"
            readonly
            :value="appState.prepTimeOut"
            placeholder="Tap to select"
            class="time-input"
            @click="openPicker('prepTimeOut')"
          />
        </div>
      </div>
      <div class="field-row">
        <div class="field half">
          <label>Start Depth (m)</label>
          <input
            v-model="appState.prepStartDepth"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
          />
        </div>
        <div class="field half">
          <label>End Depth (m)</label>
          <input
            v-model="appState.prepEndDepth"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
          />
        </div>
      </div>
      <div class="segment-actions">
        <button class="btn-undo" @click="undoLastSegment('Preparation', 'prep')">↩ Undo</button>
        <button class="btn-add-segment" @click="submitSegment('prep')">+ Add</button>
      </div>
    </div>

    <hr class="separator-line" />

    <!-- ═══ Segment 2: Production ═══ -->
    <div class="segment">
      <div class="segment-header">
        <span>2. Production Work</span>
      </div>
      <div class="field">
        <label>Activity</label>
        <v-select
          v-model="appState.prodActivity"
          :options="prodOptions"
          placeholder="Select or type activity…"
          taggable
          push-tags
        />
      </div>
      <div class="field-row">
        <div class="field half">
          <label>Time In</label>
          <input
            type="text"
            readonly
            :value="appState.prodTimeIn"
            placeholder="Tap to select"
            class="time-input"
            @click="openPicker('prodTimeIn')"
          />
        </div>
        <div class="field half">
          <label>Time Out</label>
          <input
            type="text"
            readonly
            :value="appState.prodTimeOut"
            placeholder="Tap to select"
            class="time-input"
            @click="openPicker('prodTimeOut')"
          />
        </div>
      </div>
      <div class="field-row">
        <div class="field half">
          <label>Start Depth (m)</label>
          <input
            v-model="appState.prodStartDepth"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
          />
        </div>
        <div class="field half">
          <label>End Depth (m)</label>
          <input
            v-model="appState.prodEndDepth"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
          />
        </div>
      </div>
      <div class="segment-actions">
        <button class="btn-undo" @click="undoLastSegment('Production', 'prod')">↩ Undo</button>
        <button class="btn-add-segment" @click="submitSegment('prod')">+ Add</button>
      </div>
    </div>

    <hr class="separator-line" />

    <!-- ═══ Segment 3: Waits ═══ -->
    <div class="segment">
      <div class="segment-header">
        <span>3. The Waits</span>
      </div>
      <div class="field">
        <label>Activity</label>
        <v-select
          v-model="appState.waitActivity"
          :options="waitOptions"
          placeholder="Select or type activity…"
          taggable
          push-tags
        />
      </div>
      <div class="field-row">
        <div class="field half">
          <label>Time In</label>
          <input
            type="text"
            readonly
            :value="appState.waitTimeIn"
            placeholder="Tap to select"
            class="time-input"
            @click="openPicker('waitTimeIn')"
          />
        </div>
        <div class="field half">
          <label>Time Out</label>
          <input
            type="text"
            readonly
            :value="appState.waitTimeOut"
            placeholder="Tap to select"
            class="time-input"
            @click="openPicker('waitTimeOut')"
          />
        </div>
      </div>
      <div class="field-row">
        <div class="field half">
          <label>Start Depth (m)</label>
          <input
            v-model="appState.waitStartDepth"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
          />
        </div>
        <div class="field half">
          <label>End Depth (m)</label>
          <input
            v-model="appState.waitEndDepth"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
          />
        </div>
      </div>
      <div class="segment-actions">
        <button class="btn-undo" @click="undoLastSegment('Waits', 'wait')">↩ Undo</button>
        <button class="btn-add-segment" @click="submitSegment('wait')">+ Add</button>
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { appState, submitFormRows } from '../store/appState.js'
import { dropdowns } from '../store/dropdowns.js'
import ScrollTimePicker from '../components/ScrollTimePicker.vue'
import vSelect from 'vue-select'
import 'vue-select/dist/vue-select.css'

const router = useRouter()
const validationMsg = ref('')

// Per-segment undo snapshots (keyed by prefix: prep/prod/wait)
const segmentSnapshots = ref({
  prep: null,
  prod: null,
  wait: null,
})
const pickerVisible = ref(false)
const pickerTarget = ref('')
const pickerModelValue = ref('')
const pickerRef = ref(null)

const prepOptions = computed(() => dropdowns.preparationList)
const prodOptions = computed(() => dropdowns.productionList)
const waitOptions = computed(() => dropdowns.waitsList)

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

// ── Time Picker ──
function openPicker(target) {
  pickerTarget.value = target
  pickerModelValue.value = appState[target] || ''
  pickerVisible.value = true
}

function onPickerConfirm(displayValue) {
  // displayValue is "HH:MM am/pm"
  // Store as 24-hour HH:MM for Supabase
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

// ── Navigation ──
function handleNext() {
  validationMsg.value = ''
  // Collect any unsaved form entries (silently, don't block on empty)
  submitFormRows()
  // Allow navigation if rows exist (from + Add or just submitted)
  if (appState.logRows.length === 0) {
    validationMsg.value = 'Add at least one segment entry before proceeding.'
    return
  }
  router.push('/summary')
}

function submitSegment(prefix) {
  validationMsg.value = ''

  const segMap = {
    prep: {
      category: 'Preparation',
      activity: appState.prepActivity,
      timeIn: appState.prepTimeIn,
      timeOut: appState.prepTimeOut,
      startDepth: appState.prepStartDepth,
      endDepth: appState.prepEndDepth,
    },
    prod: {
      category: 'Production',
      activity: appState.prodActivity,
      timeIn: appState.prodTimeIn,
      timeOut: appState.prodTimeOut,
      startDepth: appState.prodStartDepth,
      endDepth: appState.prodEndDepth,
    },
    wait: {
      category: 'Waits',
      activity: appState.waitActivity,
      timeIn: appState.waitTimeIn,
      timeOut: appState.waitTimeOut,
      startDepth: appState.waitStartDepth,
      endDepth: appState.waitEndDepth,
    },
  }

  const seg = segMap[prefix]
  if (!seg || !seg.activity || !seg.timeIn || !seg.timeOut) {
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

  // Take undo snapshot (the row we're about to push)
  segmentSnapshots.value[prefix] = newRow

  appState.logRows.push(newRow)

  // Capture the submitted values before resetting
  const savedTimeOut = seg.timeOut
  const savedEndDepth = seg.endDepth

  // Reset only this segment's fields
  appState[prefix + 'Activity'] = ''
  appState[prefix + 'TimeIn'] = ''
  appState[prefix + 'TimeOut'] = ''
  appState[prefix + 'StartDepth'] = ''
  appState[prefix + 'EndDepth'] = ''

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

function undoLastSegment(category, prefix) {
  const snap = segmentSnapshots.value[prefix]
  if (!snap) {
    validationMsg.value = 'Nothing to undo for this segment.'
    return
  }

  // Remove the last matching row from logRows (find by id, searching from the end)
  const idx = appState.logRows.map(r => r.id).lastIndexOf(snap.id)
  if (idx !== -1) {
    appState.logRows.splice(idx, 1)
  }

  // Restore the snapshot data back into the form fields
  appState[prefix + 'Activity'] = snap.activityName

  appState[prefix + 'TimeIn'] = snap.timeIn
  appState[prefix + 'TimeOut'] = snap.timeOut
  appState[prefix + 'StartDepth'] = snap.startDepth
  appState[prefix + 'EndDepth'] = snap.endDepth

  // Clear the undo snapshot
  segmentSnapshots.value[prefix] = null

  validationMsg.value = `Undone: ${snap.activityName}`
}
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

.separator-line {
  border: none;
  height: 2px;
  background: #e2e8f0;
  margin: 14px 0;
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
