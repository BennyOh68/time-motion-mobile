a<template>
  <div class="input-setup-page">
    <h2>📋 Time & Motion Input <span class="step-badge">1/2</span></h2>
    <p class="desc">Enter project details before logging activities.</p>

    <form @submit.prevent="handleNext" class="setup-form">
      <!-- Project Name -->
      <div class="field">
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

      <!-- Team / Rig -->
      <div class="field">
        <label for="teamRig">Team / Rig</label>
        <v-select
          v-model="appState.teamRig"
          :options="dropdowns.rigList"
          placeholder="Select or type rig…"
          taggable
          push-tags
          required
        />
      </div>

      <!-- Work Type -->
      <div class="field">
        <label>Work Type</label>
        <div class="radio-group">
          <label class="radio-label" :class="{ active: appState.workType === 'JGP' }">
            <input type="radio" v-model="appState.workType" value="JGP" />
            Jet Grout Pile (JGP)
          </label>
          <label class="radio-label" :class="{ active: appState.workType === 'GH' }">
            <input type="radio" v-model="appState.workType" value="GH" />
            Grout Hole (GH)
          </label>
        </div>
      </div>

      <!-- Ref. Point -->
      <div class="field">
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

      <!-- Record Date -->
      <div class="field">
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

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <button type="submit" class="btn-primary">Next → Activities</button>
    </form>

    <!-- ═══ Setup: Manage Activity Dropdowns ═══ -->
    <div class="setup-section">
      <h3 class="setup-title">⚙️ Setup</h3>
      <p class="setup-desc">Edit the dropdown list and their order.</p>

      <!-- 0. Team / Rig -->
      <div class="setup-panel">
        <div class="setup-panel-header" @click="togglePanel('rig')">
          <span>0. Team / Rig</span>
          <span class="panel-arrow" :class="{ open: openPanels.rig }">▼</span>
        </div>
        <div class="setup-panel-body" v-show="openPanels.rig">
          <div class="tag-list">
            <span
              v-for="(item, i) in dropdowns.rigList"
              :key="'rig-' + i"
              class="tag"
              :class="{
                'tag-dragging': dragListKey === 'rigList' && dragOverIndex === i,
                'tag-active-drag': dragListKey === 'rigList' && draggedIndex === i,
              }"
              draggable="true"
              @dragstart="onDragStart($event, 'rigList', i)"
              @dragover.prevent="onDragOver('rigList', i)"
              @dragenter="onDragEnter('rigList', i)"
              @dragleave="onDragLeave"
              @drop="onDrop('rigList')"
              @dragend="onDragEnd"
            >
              {{ item }}
              <button class="tag-del" @click="removeItem('rigList', i)">×</button>
            </span>
          </div>
          <div class="add-row">
            <input
              v-model="newItems.rig"
              type="text"
              placeholder="Add rig…"
              class="add-input"
              @keyup.enter="addItem('rigList', 'rig')"
            />
            <button class="btn-add" @click="addItem('rigList', 'rig')">+ Add</button>
            <button class="btn-reset" @click="resetList('rigList')">Reset</button>
          </div>
        </div>
      </div>

      <!-- 1. Preparation -->
      <div class="setup-panel">
        <div class="setup-panel-header" @click="togglePanel('prep')">
          <span>1. Preparation Work Activity</span>
          <span class="panel-arrow" :class="{ open: openPanels.prep }">▼</span>
        </div>
        <div class="setup-panel-body" v-show="openPanels.prep">
          <div class="tag-list">
            <span
              v-for="(item, i) in dropdowns.preparationList"
              :key="'prep-' + i"
              class="tag"
              :class="{
                'tag-dragging': dragListKey === 'preparationList' && dragOverIndex === i,
                'tag-active-drag': dragListKey === 'preparationList' && draggedIndex === i,
              }"
              draggable="true"
              @dragstart="onDragStart($event, 'preparationList', i)"
              @dragover.prevent="onDragOver('preparationList', i)"
              @dragenter="onDragEnter('preparationList', i)"
              @dragleave="onDragLeave"
              @drop="onDrop('preparationList')"
              @dragend="onDragEnd"
            >
              {{ item }}
              <button class="tag-del" @click="removeItem('preparationList', i)">×</button>
            </span>
          </div>
          <div class="add-row">
            <input
              v-model="newItems.prep"
              type="text"
              placeholder="Add activity…"
              class="add-input"
              @keyup.enter="addItem('preparationList', 'prep')"
            />
            <button class="btn-add" @click="addItem('preparationList', 'prep')">+ Add</button>
            <button class="btn-reset" @click="resetList('preparationList')">Reset</button>
          </div>
        </div>
      </div>

      <!-- 2. Production -->
      <div class="setup-panel">
        <div class="setup-panel-header" @click="togglePanel('prod')">
          <span>2. Production Work Activity</span>
          <span class="panel-arrow" :class="{ open: openPanels.prod }">▼</span>
        </div>
        <div class="setup-panel-body" v-show="openPanels.prod">
          <div class="tag-list">
            <span
              v-for="(item, i) in dropdowns.productionList"
              :key="'prod-' + i"
              class="tag"
              :class="{
                'tag-dragging': dragListKey === 'productionList' && dragOverIndex === i,
                'tag-active-drag': dragListKey === 'productionList' && draggedIndex === i,
              }"
              draggable="true"
              @dragstart="onDragStart($event, 'productionList', i)"
              @dragover.prevent="onDragOver('productionList', i)"
              @dragenter="onDragEnter('productionList', i)"
              @dragleave="onDragLeave"
              @drop="onDrop('productionList')"
              @dragend="onDragEnd"
            >
              {{ item }}
              <button class="tag-del" @click="removeItem('productionList', i)">×</button>
            </span>
          </div>
          <div class="add-row">
            <input
              v-model="newItems.prod"
              type="text"
              placeholder="Add activity…"
              class="add-input"
              @keyup.enter="addItem('productionList', 'prod')"
            />
            <button class="btn-add" @click="addItem('productionList', 'prod')">+ Add</button>
            <button class="btn-reset" @click="resetList('productionList')">Reset</button>
          </div>
        </div>
      </div>

      <!-- 3. Waits -->
      <div class="setup-panel">
        <div class="setup-panel-header" @click="togglePanel('wait')">
          <span>3. The Waits Activity</span>
          <span class="panel-arrow" :class="{ open: openPanels.wait }">▼</span>
        </div>
        <div class="setup-panel-body" v-show="openPanels.wait">
          <div class="tag-list">
            <span
              v-for="(item, i) in dropdowns.waitsList"
              :key="'wait-' + i"
              class="tag"
              :class="{
                'tag-dragging': dragListKey === 'waitsList' && dragOverIndex === i,
                'tag-active-drag': dragListKey === 'waitsList' && draggedIndex === i,
              }"
              draggable="true"
              @dragstart="onDragStart($event, 'waitsList', i)"
              @dragover.prevent="onDragOver('waitsList', i)"
              @dragenter="onDragEnter('waitsList', i)"
              @dragleave="onDragLeave"
              @drop="onDrop('waitsList')"
              @dragend="onDragEnd"
            >
              {{ item }}
              <button class="tag-del" @click="removeItem('waitsList', i)">×</button>
            </span>
          </div>
          <div class="add-row">
            <input
              v-model="newItems.wait"
              type="text"
              placeholder="Add activity…"
              class="add-input"
              @keyup.enter="addItem('waitsList', 'wait')"
            />
            <button class="btn-add" @click="addItem('waitsList', 'wait')">+ Add</button>
            <button class="btn-reset" @click="resetList('waitsList')">Reset</button>
          </div>
        </div>
      </div>
    </div>
  </div>

    <!-- Scroll Date Picker Modal -->
    <ScrollDatePicker
      :model-value="appState.logDate"
      :visible="datePickerVisible"
      @update:model-value="onDatePicked"
      @update:visible="datePickerVisible = false"
    />
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { appState } from '../store/appState.js'
import { dropdowns } from '../store/dropdowns.js'
import ScrollDatePicker from '../components/ScrollDatePicker.vue'
import vSelect from 'vue-select'
import 'vue-select/dist/vue-select.css'

const router = useRouter()
const errorMsg = ref('')
// ── Setup: collapsible panels for dropdown editing ──
const openPanels = reactive({ rig: false, prep: false, prod: false, wait: false })
const newItems = reactive({ rig: '', prep: '', prod: '', wait: '' })

// ── Drag-and-drop state ──
const draggedIndex = ref(null)
const dragOverIndex = ref(null)
const dragListKey = ref(null)

const DEFAULT_LISTS = {
  rigList: [
    'Rig 1', 'Rig 2', 'Rig 3', 'Rig 4', 'Rig 5', 'Rig 6',
  ],
  preparationList: [
    'Toolbox meeting', 'Platform leveling', 'Rig shifting',
    'Peg setting', 'Casing installation',
  ],
  productionList: [
    'Drilling', 'Grouting', 'Hard drilling', 'Obstruction drilling',
  ],
  waitsList: [
    'Lunch', 'Main contractor confirmation', 'NCE permit',
    'Singtel permit', 'Netlink Trust permit', 'PUB permit', 'SPPG permit',
    'Permits to work', 'RE/RTO inspection', 'Material clearance', 'Soil clearance',
    '3rd party clearance', 'Safety PGI', 'Safety Time Out',
    'Rig repair / maintenance', 'Tool damaged', 'Dinner',
  ],
}

function togglePanel(key) {
  openPanels[key] = !openPanels[key]
}

function addItem(listKey, newKey) {
  const val = newItems[newKey].trim()
  if (!val) return
  dropdowns[listKey].push(val)
  newItems[newKey] = ''
}

function removeItem(listKey, index) {
  dropdowns[listKey].splice(index, 1)
}

function resetList(listKey) {
  dropdowns[listKey] = [...DEFAULT_LISTS[listKey]]
}

// ── Drag-and-drop handlers ──
function onDragStart(e, listKey, index) {
  draggedIndex.value = index
  dragListKey.value = listKey
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', index)
}

function onDragOver(listKey, index) {
  if (dragListKey.value !== listKey) return
  dragOverIndex.value = index
}

function onDragEnter(listKey, index) {
  if (dragListKey.value !== listKey) return
  dragOverIndex.value = index
}

function onDragLeave() {
  dragOverIndex.value = null
}

function onDrop(listKey) {
  if (dragListKey.value !== listKey) return
  const from = draggedIndex.value
  const to = dragOverIndex.value
  if (from !== null && to !== null && from !== to) {
    // Splice out the dragged item and insert at target position
    const [item] = dropdowns[listKey].splice(from, 1)
    dropdowns[listKey].splice(to, 0, item)
  }
  onDragEnd()
}

function onDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
  dragListKey.value = null
}

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

function handleNext() {
  errorMsg.value = ''
  if (!appState.projectName.trim()) {
    errorMsg.value = 'Project Name is required.'
    return
  }
  if (!appState.teamRig.trim()) {
    errorMsg.value = 'Team / Rig is required.'
    return
  }
  if (!appState.refPoint.trim()) {
    errorMsg.value = 'Ref. Point is required.'
    return
  }
  if (!appState.logDate) {
    errorMsg.value = 'Record Date is required.'
    return
  }
  router.push('/input')
}
</script>

<style scoped>
.input-setup-page {
  max-width: 500px;
  margin: 0 auto;
  padding-bottom: 40px;
}

h2 {
  font-size: 20px;
  margin-bottom: 4px;
}

.step-badge {
  font-size: 12px;
  color: #3b82f6;
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.desc {
  color: #64748b;
  font-size: 13px;
  margin-bottom: 12px;
  padding: 0 16px;
}

.setup-form {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #334155;
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

.radio-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.radio-label {
  flex: 1;
  max-width: calc(50% - 5px);
  padding: 14px 10px;
  text-align: center;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}

.radio-label input {
  display: none;
}

.radio-label.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #2563eb;
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #2563eb;
}

.error {
  color: #dc2626;
  font-size: 13px;
  margin-bottom: 12px;
  text-align: center;
}

.date-input {
  cursor: pointer;
  caret-color: transparent;
  color: #3b82f6 !important;
  font-weight: 600;
  text-align: center;
  font-size: 18px !important;
}

.date-input::placeholder {
  color: #94a3b8;
  font-weight: 400;
  font-size: 16px;
}

/* ── Setup Section ── */
.setup-section {
  margin-top: 12px;
  background: #fff;
  border-radius: 14px;
  padding: 16px 24px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

.setup-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 12px;
  text-align: center;
}

.setup-desc {
  color: #64748b;
  font-size: 12px;
  margin: 0 0 12px 0;
  text-align: center;
}

.setup-panel {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
}

.setup-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: #f8fafc;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
}

.setup-panel-header:hover {
  background: #f1f5f9;
}

.panel-arrow {
  font-size: 10px;
  color: #94a3b8;
  transition: transform 0.2s;
}

.panel-arrow.open {
  transform: rotate(180deg);
  color: #3b82f6;
}

.setup-panel-body {
  padding: 12px 14px;
  background: #fff;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  justify-content: center;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: grab;
  user-select: none;
  transition: opacity 0.15s, transform 0.15s;
}

.tag:active {
  cursor: grabbing;
}

.tag-dragging {
  opacity: 0.4;
  transform: scale(0.95);
}

.tag-active-drag {
  opacity: 0.4;
}

.tag-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.12s;
  line-height: 1;
  padding: 0;
}

.tag-del:hover {
  background: #fee2e2;
  color: #ef4444;
}

.add-row {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.add-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.add-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.btn-add {
  padding: 8px 14px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s;
}

.btn-add:hover {
  background: #2563eb;
}

.btn-reset {
  padding: 8px 12px;
  background: #fef2f2;
  color: #ef4444;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}

.btn-reset:hover {
  background: #fee2e2;
  border-color: #fca5a5;
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
