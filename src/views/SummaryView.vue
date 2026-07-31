<template>
  <div class="summary-page">
    <h2>📝 Summary for Edit</h2>
    <div class="info-bar">
      <span class="info-left">{{ infoSummary }}</span>
      <span class="info-right">{{ formattedDate }}</span>
    </div>

    <div v-if="sortedRows.length === 0" class="empty-msg">
      No entries yet. Go back to the Input page to add data.
    </div>

    <div v-else class="table-wrapper">
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
          <tr
            v-for="(row, i) in sortedRows"
            :key="row.id"
            :class="{ 'row-selected': selectedIds.has(row.id) }"
          >
            <td class="td-sn">{{ pad(i + 1) }}</td>
            <td>
              <input
                v-model="row.activityName"
                type="text"
                class="cell-input"
              />
            </td>
            <td>
              <input
                :value="formatTime(row.timeIn)"
                @input="row.timeIn = unformatTime($event.target.value)"
                @focus="onTimeFocus($event, row.timeIn)"
                @blur="onTimeBlur($event)"
                type="text"
                class="cell-input time-cell"
                placeholder="H:MMam"
              />
            </td>
            <td>
              <input
                :value="formatTime(row.timeOut)"
                @input="row.timeOut = unformatTime($event.target.value)"
                @focus="onTimeFocus($event, row.timeOut)"
                @blur="onTimeBlur($event)"
                type="text"
                class="cell-input time-cell"
                placeholder="H:MMpm"
              />
            </td>
            <td>
              <input
                v-model="row.startDepth"
                type="text"
                class="cell-input depth-cell"
                placeholder="0.0"
              />
            </td>
            <td>
              <input
                v-model="row.endDepth"
                type="text"
                class="cell-input depth-cell"
                placeholder="0.0"
              />
            </td>
            <td class="td-chk">
              <input
                type="checkbox"
                :checked="selectedIds.has(row.id)"
                @change="toggleRow(row.id)"
              />
            </td>
          </tr>
        </tbody>
      </table>
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { appState } from '../store/appState.js'

const router = useRouter()

// ── Selection state ──
const selectedIds = ref(new Set())

const someSelected = computed(() => selectedIds.value.size > 0)

const allSelected = computed(() =>
  sortedRows.value.length > 0 &&
  selectedIds.value.size === sortedRows.value.length
)

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
  // Remove from logRows (original unsorted array)
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

// ── Time formatting (24h ↔ 12h am/pm) ──
function formatTime(hhmm) {
  if (!hhmm) return ''
  // Normalize: replace dots with colons, strip trailing am/pm fragments
  let raw = String(hhmm).replace(/\./g, ':').replace(/[ap]m?$/i, '').trim()
  // If still no colon, try to infer from digit-only string (e.g. "800" → "8:00")
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
  const [hStr, mStr] = raw.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return hhmm
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function unformatTime(val) {
  if (!val) return ''
  // Normalize: replace dots with colons
  const normalized = String(val).replace(/\./g, ':').trim()
  // Try standard H:MM am/pm pattern
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (match) {
    let h = parseInt(match[1], 10)
    const m = match[2]
    const ampm = match[3].toLowerCase()
    if (ampm === 'pm' && h < 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${m}`
  }
  // Try raw 24h H:MM format (no am/pm)
  const rawMatch = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (rawMatch) {
    let h = parseInt(rawMatch[1], 10)
    const m = rawMatch[2]
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:${m}`
    }
  }
  return val
}

// Show raw 24h value on focus for easier editing
function onTimeFocus(e, hhmm) {
  e.target.value = hhmm || ''
}

// Re-format on blur
function onTimeBlur(e) {
  e.target.value = formatTime(unformatTime(e.target.value))
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

.empty-msg {
  text-align: center;
  color: #94a3b8;
  padding: 40px;
}

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
