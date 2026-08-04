<template>
  <div class="summary-page">
    <h2>📝 Summary for Edit</h2>
    <div class="info-bar">
      <span class="info-left">{{ infoSummary }}</span>
      <button
        v-if="lastEditSnapshot"
        class="btn-undo"
        title="Undo last edit"
        @click="undoLastEdit"
      >↩</button>
      <span class="info-right">{{ formattedDate }}</span>
    </div>

    <div v-if="sortedRows.length === 0" class="empty-msg">
      No entries yet. Go back to the Input page to add data.
    </div>

    <div v-else class="table-wrapper" ref="tableWrapperRef">
        <table>
          <thead>
            <tr>
              <th class="col-sn">S/N</th>
              <th class="col-activity">Activity</th>
              <th class="col-time">TIME<br>IN</th>
              <th class="col-time">TIME<br>OUT</th>
              <th class="col-depth">START<br>DEPTH (m)</th>
              <th class="col-depth">END<br>DEPTH (m)</th>
              <th class="col-chk">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  @change="toggleAll"
                  title="Select all"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in groupedRows" :key="item.key">
              <tr v-if="item.type === 'header'" class="group-header-row" @click="toggleGroup(item.groupKey)">
                <td :colspan="7" class="group-header-cell">
                  <span class="group-chevron">{{ collapsedGroups.has(item.groupKey) ? '▶' : '▼' }}</span>
                  📍 {{ item.workType }} — {{ item.refPoint }}
                  <span class="group-row-count">({{ item.rowCount }})</span>
                </td>
              </tr>
              <tr
                v-else-if="!collapsedGroups.has(item.headerKey)"
                :class="{ 'row-selected': selectedIds.has(item.data.id) }"
              >
                <td class="td-sn">{{ pad(item.sn) }}</td>
                <td>
                  <input
                    v-model="item.data.activityName"
                    type="text"
                    class="cell-input"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    readonly
                    :value="formatTime(item.data.timeIn)"
                    :class="['cell-input', 'time-cell', 'pickable-cell', { 'cell-mismatch': item.prevRow && item.data.timeIn && item.prevRow.timeOut && item.data.timeIn !== item.prevRow.timeOut }]"
                    placeholder="H:MMam"
                    @click="openTimePicker(item.data, 'timeIn')"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    readonly
                    :value="formatTime(item.data.timeOut)"
                    class="cell-input time-cell pickable-cell"
                    placeholder="H:MMpm"
                    @click="openTimePicker(item.data, 'timeOut')"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    readonly
                    :value="formatDepth(item.data.startDepth)"
                    :class="['cell-input', 'depth-cell', 'pickable-cell', { 'cell-mismatch': item.prevRow && item.data.startDepth !== '' && item.data.startDepth != null && item.prevRow.endDepth !== '' && item.prevRow.endDepth != null && Number(item.data.startDepth) !== Number(item.prevRow.endDepth) }]"
                    placeholder="—"
                    @click="openDepthPicker(item.data, 'startDepth')"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    readonly
                    :value="formatDepth(item.data.endDepth)"
                    class="cell-input depth-cell pickable-cell"
                    placeholder="—"
                    @click="openDepthPicker(item.data, 'endDepth')"
                  />
                </td>
                <td class="td-chk">
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(item.data.id)"
                    @change="toggleRow(item.data.id)"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
    </div>

    <!-- Custom scrollbar below table -->
    <div v-if="sortedRows.length > 0" class="custom-scrollbar">
      <button class="scroll-arrow" @pointerdown.prevent="startScroll(-150)" @pointerup="stopScroll" @pointerleave="stopScroll" aria-label="Scroll left">◀</button>
      <div class="scroll-track" ref="scrollTrackRef">
        <div class="scroll-thumb" ref="scrollThumbRef" @pointerdown.prevent="startThumbDrag"></div>
      </div>
      <button class="scroll-arrow" @pointerdown.prevent="startScroll(150)" @pointerup="stopScroll" @pointerleave="stopScroll" aria-label="Scroll right">▶</button>
    </div>

    <!-- Delete button — appears when any rows are selected -->
    <div v-if="someSelected" class="delete-bar">
      <button class="btn-delete" @click="deleteSelected">
        🗑 {{ allSelected ? 'Delete ALL' : `Delete Selected (${selectedIds.size})` }}
      </button>
    </div>

    <div class="action-bar">
      <button class="btn-outline" @click="router.push('/input')">← Back</button>
      <button class="btn-primary" @click="router.push('/chart')">Next → Chart</button>
    </div>

    <!-- Scroll-based time picker -->
    <ScrollTimePicker
      :model-value="timePickerValue"
      :visible="timePickerVisible"
      :title="timePickerTitle"
      :copy-label="timePickerCopyLabel"
      :copy-value="timePickerCopyValue"
      @update:model-value="onTimeConfirm"
      @update:visible="timePickerVisible = false"
    />

    <!-- Scroll-based depth picker -->
    <ScrollDepthPicker
      :model-value="depthPickerValue"
      :visible="depthPickerVisible"
      :title="depthPickerTitle"
      :copy-label="depthPickerCopyLabel"
      :copy-value="depthPickerCopyValue"
      @update:model-value="onDepthConfirm"
      @update:visible="depthPickerVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { appState } from '../store/appState.js'
import ScrollTimePicker from '../components/ScrollTimePicker.vue'
import ScrollDepthPicker from '../components/ScrollDepthPicker.vue'

const router = useRouter()

// ── Selection state ──
const selectedIds = ref(new Set())

const someSelected = computed(() => selectedIds.value.size > 0)

const allSelected = computed(() =>
  sortedRows.value.length > 0 &&
  selectedIds.value.size === sortedRows.value.length
)

// ── Collapsible group state ──
const collapsedGroups = ref(new Set())
const lastGroupFingerprint = ref('')

function toggleGroup(groupKey) {
  const next = new Set(collapsedGroups.value)
  if (next.has(groupKey)) {
    next.delete(groupKey)
  } else {
    next.add(groupKey)
  }
  collapsedGroups.value = next
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(sortedRows.value.map(r => r.id))
  }
}

function toggleRow(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function deleteSelected() {
  const ids = selectedIds.value
  const deletedRows = appState.logRows.filter(r => ids.has(r.id))
  lastEditSnapshot.value = { type: 'delete', deletedRows }
  appState.logRows = appState.logRows.filter(r => !ids.has(r.id))
  selectedIds.value = new Set()
}

// ── Sort ──
const sortedRows = computed(() => {
  return [...appState.logRows].sort((a, b) => {
    const ta = a.timeIn || '99:99'
    const tb = b.timeIn || '99:99'
    return ta.localeCompare(tb)
  })
})

// ── Grouped rows with ref. point headers ──
const groupedRows = computed(() => {
  const rows = sortedRows.value
  const items = []
  let lastRefPoint = null

  // First pass: collect group keys and row counts
  const groupKeys = []
  const groupRowCounts = {}
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.refPoint && row.refPoint !== lastRefPoint) {
      const gk = 'hdr-' + row.refPoint + '-' + (row.workType || '')
      groupKeys.push(gk)
      lastRefPoint = row.refPoint
    }
    const gk = 'hdr-' + row.refPoint + '-' + (row.workType || '')
    groupRowCounts[gk] = (groupRowCounts[gk] || 0) + 1
  }

  // Initialize collapsed once per unique group layout (avoids reactivity loop)
  if (groupKeys.length > 0) {
    const fingerprint = groupKeys.join('|')
    if (fingerprint !== lastGroupFingerprint.value) {
      lastGroupFingerprint.value = fingerprint
      collapsedGroups.value = new Set(groupKeys.slice(0, -1))
    }
  }

  // Second pass: push header BEFORE its data rows
  lastRefPoint = null
  let sn = 0
  let currentHeaderKey = ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.refPoint && row.refPoint !== lastRefPoint) {
      const prefix = row.workType || ''
      const gk = 'hdr-' + row.refPoint + '-' + prefix
      items.push({
        type: 'header',
        refPoint: row.refPoint,
        workType: prefix,
        groupKey: gk,
        key: gk,
        rowCount: groupRowCounts[gk] || 0
      })
      currentHeaderKey = gk
      lastRefPoint = row.refPoint
      sn = 0
    }
    sn++
    const prevRow = i > 0 ? rows[i - 1] : null
    items.push({ type: 'data', data: row, key: row.id, sn, prevRow, headerKey: currentHeaderKey })
  }

  return items
})

// ── Table wrapper ref ──
const tableWrapperRef = ref(null)

// ── Custom scrollbar synced to table ──
const scrollTrackRef = ref(null)
const scrollThumbRef = ref(null)

function syncScrollbar() {
  const table = tableWrapperRef.value
  const track = scrollTrackRef.value
  const thumb = scrollThumbRef.value
  if (!table || !track || !thumb) return
  const maxScroll = table.scrollWidth - table.clientWidth
  const trackWidth = track.clientWidth - thumb.clientWidth
  if (maxScroll <= 0) {
    thumb.style.display = 'none'
    return
  }
  thumb.style.display = 'block'
  const ratio = table.scrollLeft / maxScroll
  thumb.style.left = (ratio * trackWidth) + 'px'
}

function scrollTableBy(delta) {
  const el = tableWrapperRef.value
  if (!el) return
  el.scrollBy({ left: delta, behavior: 'smooth' })
}

function scrollTableTo(clientX) {
  const table = tableWrapperRef.value
  const track = scrollTrackRef.value
  const thumb = scrollThumbRef.value
  if (!table || !track || !thumb) return
  const maxScroll = table.scrollWidth - table.clientWidth
  if (maxScroll <= 0) return
  const trackRect = track.getBoundingClientRect()
  const clickX = clientX - trackRect.left - thumb.clientWidth / 2
  const trackWidth = track.clientWidth - thumb.clientWidth
  const ratio = Math.max(0, Math.min(1, clickX / trackWidth))
  table.scrollLeft = ratio * maxScroll
}

// ── Auto-scroll repeat when holding arrow ──
let scrollInterval = null
function startScroll(delta) {
  scrollTableBy(delta)
  scrollInterval = setInterval(() => scrollTableBy(delta), 80)
}
function stopScroll() {
  if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null }
}

// ── Thumb dragging ──
let dragging = false
function startThumbDrag(e) {
  dragging = true
  const onMove = (ev) => {
    if (!dragging) return
    scrollTableTo(ev.clientX)
  }
  const onUp = () => {
    dragging = false
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}

// Watch table scroll and sync thumb position
watch(tableWrapperRef, (el) => {
  if (!el) return
  el.addEventListener('scroll', syncScrollbar)
  nextTick(() => syncScrollbar())
}, { immediate: false })

onMounted(() => {
  nextTick(() => {
    const el = tableWrapperRef.value
    if (el) {
      el.addEventListener('scroll', syncScrollbar)
      syncScrollbar()
    }
  })
})

onUnmounted(() => {
  stopScroll()
  const el = tableWrapperRef.value
  if (el) el.removeEventListener('scroll', syncScrollbar)
})

// ── One-level undo ──
const lastEditSnapshot = ref(null)

function saveSnapshot(row, field) {
  lastEditSnapshot.value = {
    type: 'edit',
    row,
    field,
    oldValue: row[field],
  }
}

function undoLastEdit() {
  const snap = lastEditSnapshot.value
  if (!snap) return
  if (snap.type === 'edit') {
    snap.row[snap.field] = snap.oldValue
  } else if (snap.type === 'delete') {
    // Re-insert deleted rows, maintaining original order by timeIn
    const restoredIds = new Set(snap.deletedRows.map(r => r.id))
    appState.logRows = [...appState.logRows, ...snap.deletedRows]
    selectedIds.value = new Set()
  }
  lastEditSnapshot.value = null
}

// ── Time picker state ──
const timePickerVisible = ref(false)
const timePickerValue = ref('')
const timePickerRow = ref(null)
const timePickerField = ref('')
const timePickerTitle = ref('')
const timePickerCopyLabel = ref('')
const timePickerCopyValue = ref('')

function openTimePicker(row, field) {
  timePickerRow.value = row
  timePickerField.value = field
  timePickerValue.value = row[field] || ''
  timePickerTitle.value = row.activityName || ''
  // Find preceding row in sortedRows for copy-last button
  const idx = sortedRows.value.findIndex(r => r.id === row.id)
  if (idx > 0) {
    const prev = sortedRows.value[idx - 1]
    timePickerCopyLabel.value = formatTime(prev.timeOut)
    timePickerCopyValue.value = prev.timeOut || ''
  } else {
    timePickerCopyLabel.value = ''
    timePickerCopyValue.value = ''
  }
  timePickerVisible.value = true
}

function onTimeConfirm(displayValue) {
  // displayValue is "HH:MM am/pm" from ScrollTimePicker
  const row = timePickerRow.value
  const field = timePickerField.value
  if (!row) return
  saveSnapshot(row, field)
  const match = (displayValue || '').match(/^(\d{2}):(\d{2})\s*(am|pm)$/i)
  if (match) {
    let hh = parseInt(match[1], 10)
    const mm = match[2]
    const ampm = match[3].toLowerCase()
    if (ampm === 'pm' && hh < 12) hh += 12
    if (ampm === 'am' && hh === 12) hh = 0
    row[field] = `${String(hh).padStart(2, '0')}:${mm}`
  } else {
    row[field] = displayValue
  }
  timePickerVisible.value = false
}

// ── Depth picker state ──
const depthPickerVisible = ref(false)
const depthPickerValue = ref('')
const depthPickerRow = ref(null)
const depthPickerField = ref('')
const depthPickerTitle = ref('')
const depthPickerCopyLabel = ref('')
const depthPickerCopyValue = ref('')

function openDepthPicker(row, field) {
  depthPickerRow.value = row
  depthPickerField.value = field
  depthPickerValue.value = row[field] || ''
  depthPickerTitle.value = (row.activityName || '') + (field === 'startDepth' ? ' - Start Depth (m)' : ' - End Depth (m)')
  // Find preceding row in sortedRows for copy-last button
  const idx = sortedRows.value.findIndex(r => r.id === row.id)
  if (idx > 0) {
    const prev = sortedRows.value[idx - 1]
    depthPickerCopyLabel.value = formatDepth(prev.endDepth)
    depthPickerCopyValue.value = prev.endDepth != null ? String(prev.endDepth) : ''
  } else {
    depthPickerCopyLabel.value = ''
    depthPickerCopyValue.value = ''
  }
  depthPickerVisible.value = true
}

function onDepthConfirm(value) {
  const row = depthPickerRow.value
  const field = depthPickerField.value
  if (!row) return
  saveSnapshot(row, field)
  row[field] = value || ''
  depthPickerVisible.value = false
}

// ── Time formatting (24h ↔ 12h am/pm) ──
function formatTime(hhmm) {
  if (!hhmm) return ''
  let raw = String(hhmm).replace(/\./g, ':').replace(/(am|pm)$/i, '').trim()
  if (!raw.includes(':')) {
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 3) {
      raw = digits[0] + ':' + digits.slice(1)
    } else if (digits.length === 4) {
      raw = digits.slice(0, 2) + ':' + digits.slice(2)
    } else {
      return hhmm
    }
  }
  const parts = raw.split(':')
  if (parts.length !== 2) return hhmm
  const [hStr, mStr] = parts
  if (!/^\d{1,2}$/.test(hStr) || !/^\d{2}$/.test(mStr)) return hhmm
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (h > 23 || m > 59) return hhmm
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

// ── Depth formatting (always show 1 decimal place; blank → 0.0) ──
function formatDepth(val) {
  if (val === undefined || val === null || val === '') return '0.0m'
  const num = parseFloat(String(val))
  if (isNaN(num)) return '0.0m'
  return num.toFixed(1) + 'm'
}

// ── Info bar ──
const infoSummary = computed(() => {
  const typeRef = [appState.workType, appState.refPoint].filter(Boolean).join(' - ')
  const parts = [appState.projectName, typeRef, appState.teamRig].filter(Boolean)
  return parts.join(' · ') || '—'
})

const formattedDate = computed(() => {
  const d = appState.logRows[0]?.logDate
  if (!d) {
    const today = new Date()
    const day = String(today.getDate()).padStart(2, '0')
    const month = String(today.getMonth() + 1).padStart(2, '0')
    return `${day}-${month}-${today.getFullYear()}`
  }
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
})

function pad(n) {
  return String(n).padStart(2, '0')
}
</script>

<style scoped>
.summary-page {
  margin: 0 auto;
  padding: 0 8px 40px;
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

.btn-undo {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  font-size: 20px;
  color: #92400e;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  margin: 0 8px;
  padding: 0;
  line-height: 1;
}

.btn-undo:active {
  background: #fde68a;
}

.empty-msg {
  text-align: center;
  color: #94a3b8;
  padding: 40px;
}

/* ── Table scroll wrapper (scrollbar below) ── */
.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 10px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
  background: #fff;
  margin-bottom: 8px;
}

table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f1f5f9;
}

th {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 10px 6px;
  text-align: left;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

td {
  padding: 4px 6px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.row-selected {
  background: #eff6ff;
}

/* ── Group header row (ref. point separator) ── */
.group-header-row {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.group-header-row td {
  padding: 8px 12px;
  background: #f0f9ff;
  border-bottom: 2px solid #bae6fd;
}

.group-header-cell {
  font-size: 13px;
  font-weight: 700;
  color: #0369a1;
  text-align: left;
}

.group-chevron {
  display: inline-block;
  margin-right: 6px;
  font-size: 10px;
  transition: transform 0.15s;
}

.group-row-count {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 400;
  color: #64748b;
}

.col-sn {
  width: 20px;
  text-align: center;
}

.td-sn {
  text-align: center;
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.col-activity {
  width: 120px;
}

.col-time {
  width: 71px;
  text-align: center;
}

.col-depth {
  width: 42px;
  text-align: center;
}

.col-chk {
  width: 32px;
  text-align: center;
}

.td-chk {
  text-align: center;
}

.col-chk input[type="checkbox"],
.td-chk input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.cell-input {
  width: 100%;
  padding: 8px 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  background: transparent;
  transition: all 0.12s;
}

.cell-input:hover {
  border-color: #cbd5e1;
}

.cell-input:focus {
  border-color: #3b82f6;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
}

.time-cell {
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.depth-cell {
  font-variant-numeric: tabular-nums;
  text-align: center;
}

/* ── Pickable cell (readonly, tap to open picker) ── */
.pickable-cell {
  cursor: pointer;
  caret-color: transparent;
  color: #3b82f6 !important;
  font-weight: 600;
}

.pickable-cell::placeholder {
  color: #94a3b8;
  font-weight: 400;
}

.cell-mismatch {
  color: #ef4444 !important;
}

/* ── Custom scrollbar ── */
.custom-scrollbar {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 4px 0 8px;
  height: 24px;
}

.scroll-arrow {
  flex-shrink: 0;
  width: 28px;
  height: 24px;
  border: none;
  background: #e2e8f0;
  cursor: pointer;
  border-radius: 4px;
  font-size: 11px;
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  touch-action: manipulation;
  transition: background 0.12s;
}

.scroll-arrow:hover {
  background: #cbd5e1;
}

.scroll-arrow:active {
  background: #94a3b8;
  color: #1e293b;
}

.scroll-track {
  flex: 1;
  height: 10px;
  background: #e2e8f0;
  border-radius: 5px;
  margin: 0 6px;
  position: relative;
  cursor: pointer;
}

.scroll-thumb {
  position: absolute;
  top: -1px;
  height: 12px;
  background: #64748b;
  border-radius: 6px;
  cursor: grab;
  min-width: 36px;
  width: 40%;
  transition: background 0.12s;
}

.scroll-thumb:hover {
  background: #475569;
}

.scroll-thumb:active {
  background: #334155;
  cursor: grabbing;
}

/* ── Delete bar ── */
.delete-bar {
  margin-bottom: 8px;
}

.btn-delete {
  width: 100%;
  padding: 14px;
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-delete:hover {
  background: #b91c1c;
}

/* ── Action bar ── */
.action-bar {
  display: flex;
  gap: 10px;
  margin-top: 16px;
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
.btn-outline {
  background: #fff;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.btn-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
