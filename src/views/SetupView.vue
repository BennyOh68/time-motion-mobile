<template>
  <div class="setup-page">
    <h2>⚙ Dropdown Management</h2>
    <p class="desc">Toggle visibility and reorder activity items. Hidden items won't appear in the dropdown.</p>

    <!-- ── Tab bar ── -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ── Item list ── -->
    <div class="list-panel">
      <!-- Column headers -->
      <div class="list-row list-header">
        <span class="sn">S/N</span>
        <span class="list-label">List</span>
        <span class="rank-label">Rank</span>
        <button
          v-if="!undoSnapshot && focusedIndex !== null"
          class="header-arrow"
          title="Move up"
          :disabled="focusedIndex === 0"
          @mousedown.prevent="moveUp(focusedIndex)"
        >
          ▲
        </button>
        <button
          v-if="!undoSnapshot && focusedIndex !== null"
          class="header-arrow"
          title="Move down"
          :disabled="focusedIndex === currentList.length - 1"
          @mousedown.prevent="moveDown(focusedIndex)"
        >
          ▼
        </button>
        <button
          v-if="undoSnapshot"
          class="header-undo"
          title="Undo delete"
          @mousedown.prevent="undoDelete"
        >
          ↶
        </button>
        <button
          v-else-if="focusedIndex !== null"
          class="header-del"
          title="Delete item"
          @mousedown.prevent="deleteFocused"
        >
          🗑
        </button>
      </div>

      <div
        v-for="(item, i) in currentList"
        :key="tabConfig[activeTab].listKey + '-' + i"
        class="list-row"
        :class="{ hidden: isHidden(i) }"
      >
        <span class="sn">{{ i + 1 }}</span>
        <input
          type="checkbox"
          class="row-check"
          :checked="!isHidden(i)"
          @change="toggleVisible(i)"
        />
        <input
          v-model="currentList[i]"
          type="text"
          class="list-input"
          placeholder="Item name"
          :ref="(el) => { if (el) inputRefs[i] = el }"
          @focus="onInputFocus(i)"
          @blur="onInputBlur"
        />
      </div>

      <p v-if="currentList.length === 0" class="empty-msg">
        No items yet. Click "+ Add Item" below.
      </p>

      <button class="btn-add" @click="addItem">
        + Add Item
      </button>
    </div>

    <!-- ── Work Type labels ── -->
    <div class="worktype-panel">
      <h3 class="wt-title">Work Type Labels</h3>
      <p class="wt-desc">
        Edit the radio button labels on the input page. Whatever is inside
        the brackets ( ) becomes the prefix shown before the Ref. Point
        (e.g. <code>JGP - P1</code>).
      </p>
      <div class="wt-field">
        <span class="wt-key">{{ bracketOf(workTypeLabels.JGP) || 'JGP' }}</span>
        <input
          v-model="workTypeLabels.JGP"
          type="text"
          class="list-input"
          placeholder="Jet Grout Pile (JGP)"
        />
      </div>
      <div class="wt-field">
        <span class="wt-key">{{ bracketOf(workTypeLabels.GH) || 'GH' }}</span>
        <input
          v-model="workTypeLabels.GH"
          type="text"
          class="list-input"
          placeholder="Grout Hole (GH)"
        />
      </div>
    </div>

    <button class="btn-secondary" @click="resetAll">Reset All to Defaults</button>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { dropdowns, hiddenItems, resetDropdowns, workTypeLabels, bracketOf } from '../store/dropdowns.js'

const activeTab = ref('prep')
const focusedIndex = ref(null)
const undoSnapshot = ref(null)
const inputRefs = ref({})
let blurTimer = null

function onInputFocus(i) {
  clearTimeout(blurTimer)
  focusedIndex.value = i
  undoSnapshot.value = null
}

function onInputBlur() {
  blurTimer = setTimeout(() => {
    focusedIndex.value = null
  }, 150)
}

function deleteFocused() {
  clearTimeout(blurTimer)
  if (focusedIndex.value === null) return
  const key = tabConfig[activeTab.value].listKey
  const idx = focusedIndex.value
  const deletedValue = dropdowns[key][idx]
  const hiddenKey = tabConfig[activeTab.value].hiddenKey
  const wasHidden = hiddenItems[hiddenKey] && hiddenItems[hiddenKey][idx]

  dropdowns[key].splice(idx, 1)
  if (hiddenItems[hiddenKey]) {
    delete hiddenItems[hiddenKey][idx]
  }

  undoSnapshot.value = {
    listKey: key,
    hiddenKey,
    index: idx,
    value: deletedValue,
    wasHidden: !!wasHidden,
  }
  focusedIndex.value = null
}

function undoDelete() {
  clearTimeout(blurTimer)
  if (!undoSnapshot.value) return
  const s = undoSnapshot.value
  dropdowns[s.listKey].splice(s.index, 0, s.value)
  if (s.wasHidden) {
    if (!hiddenItems[s.hiddenKey]) hiddenItems[s.hiddenKey] = {}
    hiddenItems[s.hiddenKey][s.index] = true
  }
  undoSnapshot.value = null
}

const tabs = [
  { key: 'rig', label: 'Team / Rig' },
  { key: 'prep', label: '1. Preparation' },
  { key: 'prod', label: '2. Production' },
  { key: 'wait', label: '3. Waits' },
]

const tabConfig = {
  rig: { listKey: 'rigList', hiddenKey: 'rigList' },
  prep: { listKey: 'preparationList', hiddenKey: 'preparationList' },
  prod: { listKey: 'productionList', hiddenKey: 'productionList' },
  wait: { listKey: 'waitsList', hiddenKey: 'waitsList' },
}

const currentList = computed({
  get: () => dropdowns[tabConfig[activeTab.value].listKey],
  set: () => {},
})

function isHidden(idx) {
  const key = tabConfig[activeTab.value].hiddenKey
  return hiddenItems[key] && hiddenItems[key][idx] === true
}

function toggleVisible(idx) {
  const key = tabConfig[activeTab.value].hiddenKey
  if (!hiddenItems[key]) hiddenItems[key] = {}
  if (hiddenItems[key][idx]) {
    delete hiddenItems[key][idx]
  } else {
    hiddenItems[key][idx] = true
  }
}

function addItem() {
  const key = tabConfig[activeTab.value].listKey
  dropdowns[key].push('')
}

function moveUp(idx) {
  if (idx === 0) return
  const key = tabConfig[activeTab.value].listKey
  const list = dropdowns[key]
  const [item] = list.splice(idx, 1)
  list.splice(idx - 1, 0, item)
  swapHidden(key, idx, idx - 1)
  clearTimeout(blurTimer)
  focusedIndex.value = idx - 1
}

function moveDown(idx) {
  const key = tabConfig[activeTab.value].listKey
  const list = dropdowns[key]
  if (idx >= list.length - 1) return
  const [item] = list.splice(idx, 1)
  list.splice(idx + 1, 0, item)
  swapHidden(key, idx, idx + 1)
  clearTimeout(blurTimer)
  focusedIndex.value = idx + 1
}

function swapHidden(hiddenKey, a, b) {
  const hidden = hiddenItems[hiddenKey]
  const hasA = hidden[a] === true
  const hasB = hidden[b] === true
  if (hasB) hidden[a] = true
  else delete hidden[a]
  if (hasA) hidden[b] = true
  else delete hidden[b]
}

function resetAll() {
  if (confirm('Reset all dropdown lists to factory defaults?')) {
    resetDropdowns()
  }
}
</script>

<style scoped>
.setup-page {
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
  margin-bottom: 16px;
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

/* ── List panel ── */
.list-panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  margin-bottom: 12px;
}

.list-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}

.list-row.hidden {
  opacity: 0.45;
}

.list-row.hidden .list-input {
  text-decoration: line-through;
}

.list-header {
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}

.sn {
  width: 24px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  flex-shrink: 0;
}

.list-label {
  width: 24px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  flex-shrink: 0;
}

.rank-label {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.header-del {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: #fef2f2;
  color: #ef4444;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.12s;
  line-height: 1;
}

.header-del:hover {
  background: #fee2e2;
}

.header-undo {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: #eff6ff;
  color: #3b82f6;
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.12s;
  line-height: 1;
}

.header-undo:hover {
  background: #dbeafe;
}

.row-check {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
  flex-shrink: 0;
  margin: 0;
}

.list-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  min-width: 0;
  transition: border-color 0.15s;
}

.list-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.header-arrow {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
  line-height: 1;
}

.header-arrow:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #3b82f6;
}

.header-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.empty-msg {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  padding: 12px 0;
  margin: 0;
}

.btn-add {
  background: #dbeafe;
  color: #2563eb;
  border: 1px dashed #3b82f6;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin-top: 4px;
  transition: all 0.12s;
}

.btn-add:hover {
  background: #bfdbfe;
  border-style: solid;
}

.btn-secondary {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  cursor: pointer;
  width: 100%;
  margin-top: 8px;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

/* ── Work Type labels panel ── */
.worktype-panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  margin-bottom: 12px;
}

.wt-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 4px;
  color: #1e293b;
}

.wt-desc {
  color: #64748b;
  font-size: 12px;
  margin: 0 0 12px;
  line-height: 1.5;
}

.wt-desc code {
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
  color: #2563eb;
}

.wt-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.wt-field:last-child {
  margin-bottom: 0;
}

.wt-key {
  flex-shrink: 0;
  min-width: 34px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  text-align: center;
}
</style>
